from fastapi import FastAPI, HTTPException, Depends, status, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
import csv
import io
import os
import lasio
import numpy as np

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

# Database imports
import models
from database import engine, get_db

# Initialize Database Tables
models.Base.metadata.create_all(bind=engine)

# Import external routers if present
try:
    from payments import payment_router
except ImportError:
    payment_router = None
# Route uploads to ephemeral /tmp storage on Vercel to avoid Read-Only filesystem errors
UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="AKZ Petroleum Engineering Forum API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

if payment_router:
    app.include_router(payment_router)


# Request Schemas
class AuthRequest(BaseModel):
    email: str
    password: str


class PaymentSubmitRequest(BaseModel):
    user_email: str
    plan_name: Optional[str] = "Pro Subscription"
    payment_method: str
    sender_full_name: Optional[str] = None
    sender_country: Optional[str] = None
    mtcn: Optional[str] = None
    tx_hash: Optional[str] = None
    network: Optional[str] = None


class PaymentStatusUpdate(BaseModel):
    status: str


# Helper Functions
def safe_float(val: Any) -> Optional[float]:
    if val is None or np.isnan(val):
        return None
    return float(val)


def fetch_or_create_user_info(db: Session, email: str) -> Dict[str, Any]:
    """Retrieves user info via SQLAlchemy or auto-creates user if missing."""
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if not user:
        # Create user record automatically on first check
        user = models.User(
            email=email,
            password="default_hash_or_placeholder",
            is_paid=False,
            trial_ends_at=datetime.utcnow() + timedelta(days=14)
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    remaining_days = 0
    if user.trial_ends_at:
        delta = user.trial_ends_at - datetime.utcnow()
        remaining_days = max(0, delta.days)

    return {
        "is_paid": user.is_paid,
        "has_access": bool(user.is_paid or remaining_days > 0),
        "trial_days_remaining": remaining_days,
    }


# Root Health Check
@app.get("/")
def read_root():
    return {"status": "AKZ Petroleum Engineering Forum API running"}


# Authentication Endpoints
@app.post("/api/auth/register")
async def register(data: AuthRequest, db: Session = Depends(get_db)):
    if not data.email or not data.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required",
        )

    user_info = fetch_or_create_user_info(db, data.email)

    return {
        "user_email": data.email,
        "is_paid": user_info["is_paid"],
        "has_access": user_info["has_access"],
        "trial_days_remaining": user_info["trial_days_remaining"],
        "message": "User registered successfully",
    }


@app.post("/api/auth/login")
async def login(data: AuthRequest, db: Session = Depends(get_db)):
    if not data.email or not data.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required",
        )

    user_info = fetch_or_create_user_info(db, data.email)

    return {
        "user_email": data.email,
        "is_paid": user_info["is_paid"],
        "has_access": user_info["has_access"],
        "trial_days_remaining": user_info["trial_days_remaining"],
        "message": "Login successful",
    }


# Payment Management Endpoints
@app.post("/api/auth/submit-payment")
async def submit_payment(payment_data: PaymentSubmitRequest, db: Session = Depends(get_db)):
    new_submission = models.PaymentSubmission(
        user_email=payment_data.user_email,
        plan_name=payment_data.plan_name,
        payment_method=payment_data.payment_method,
        sender_full_name=payment_data.sender_full_name,
        sender_country=payment_data.sender_country,
        mtcn=payment_data.mtcn,
        tx_hash=payment_data.tx_hash,
        network=payment_data.network,
        status="pending",
    )

    db.add(new_submission)
    db.commit()
    db.refresh(new_submission)

    return {
        "status": "success",
        "message": "Payment proof submitted successfully! Your account will be upgraded upon manual verification.",
    }


@app.get("/api/admin/payments")
def get_all_payments(admin_secret_key: str = "123456", db: Session = Depends(get_db)):
    if admin_secret_key != "123456":
        raise HTTPException(status_code=403, detail="Unauthorized access")

    payments = db.query(models.PaymentSubmission).all()
    return payments


@app.put("/api/admin/payments/{payment_id}/status")
def update_payment_status(
    payment_id: int,
    payload: PaymentStatusUpdate,
    admin_secret_key: str = "123456",
    db: Session = Depends(get_db),
):
    if admin_secret_key != "123456":
        raise HTTPException(status_code=403, detail="Unauthorized access")

    submission = db.query(models.PaymentSubmission).filter(models.PaymentSubmission.id == payment_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Payment record not found")

    new_status = payload.status.lower()
    submission.status = new_status

    # Elevate User in Database via SQLAlchemy
    if new_status == "approved":
        user = db.query(models.User).filter(models.User.email == submission.user_email).first()
        if user:
            user.is_paid = True
        else:
            # Create the user directly if missing and grant access
            user = models.User(
                email=submission.user_email,
                password="default_hash_or_placeholder",
                is_paid=True
            )
            db.add(user)

    db.commit()
    db.refresh(submission)
    return {"status": "success", "message": f"Payment #{payment_id} updated to {payload.status}"}


# File Processing & Analysis Endpoints
@app.post("/api/upload-las")
async def upload_las(file: UploadFile = File(...)):
    if not file.filename.endswith(".las"):
        raise HTTPException(status_code=400, detail="Only .las files are accepted.")

    file_path = os.path.join(UPLOAD_DIR, file.filename)

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    return {
        "status": "success",
        "filename": file.filename,
        "size_bytes": len(content),
        "message": "LAS log file received successfully.",
    }


@app.post("/api/analyze-las")
async def analyze_las(
    file: UploadFile = File(...),
    user_email: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    if user_email:
        user_info = fetch_or_create_user_info(db, user_email)
        if not user_info["has_access"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your trial period has expired. Please upgrade to Pro.",
            )

    try:
        content = await file.read()
        las = lasio.read(content.decode("utf-8", errors="ignore"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read LAS file: {str(e)}")

    depths = [safe_float(d) for d in las.index]
    if not depths or all(d is None for d in depths):
        raise HTTPException(status_code=400, detail="No depth data found in LAS file.")

    def get_curve(possible_names: List[str]) -> List[Optional[float]]:
        for name in possible_names:
            if name in las.curves:
                return [safe_float(x) for x in las[name]]
        return [None] * len(depths)

    gr = get_curve(["GR", "GAPI"])
    vsh = get_curve(["VSH", "VCL"])
    phid = get_curve(["PHID", "DPHI", "PORO"])
    rhob = get_curve(["RHOB", "DEN"])
    nphi = get_curve(["NPHI", "TNPH"])
    rt = get_curve(["RT", "RD", "LLD", "ILD", "RES"])

    if all(v is None for v in phid) and any(r is not None for r in rhob):
        phid = []
        for r in rhob:
            if r is not None:
                phi_d_calc = (2.65 - r) / (2.65 - 1.0)
                phid.append(safe_float(max(0.0, min(1.0, phi_d_calc))))
            else:
                phid.append(None)

    valid_gr = [g for g in gr if g is not None]
    if all(v is None for v in vsh) and valid_gr:
        gr_min, gr_max = min(valid_gr), max(valid_gr)
        if gr_max > gr_min:
            vsh = [safe_float((g - gr_min) / (gr_max - gr_min)) if g is not None else 0.0 for g in gr]

    phi_e_list = []
    sw_list = []
    net_pay_feet = 0.0

    valid_depths = [d for d in depths if d is not None]
    total_feet = max(valid_depths) - min(valid_depths) if len(valid_depths) > 1 else 0.0
    step = abs(valid_depths[1] - valid_depths[0]) if len(valid_depths) > 1 else 0.5

    for i in range(len(depths)):
        v_val = vsh[i] if vsh[i] is not None else 0.0
        pd_val = phid[i] if phid[i] is not None else 0.0
        rt_val = rt[i] if (rt[i] is not None and rt[i] > 0) else 10.0

        phi_e = max(0.0, pd_val * (1.0 - v_val))
        phi_e_list.append(safe_float(phi_e))

        if phi_e > 0.001 and rt_val > 0:
            sw_val = min(1.0, max(0.0, float(((1.0 * 0.05) / ((phi_e**2.0) * rt_val)) ** 0.5)))
        else:
            sw_val = 1.0
        sw_list.append(safe_float(sw_val))

        if v_val < 0.30 and phi_e > 0.10 and sw_val < 0.50:
            net_pay_feet += step

    well_name = str(las.well.WELL.value) if ("WELL" in las.well and las.well.WELL.value) else "TEST-WELL-01"

    return {
        "well_name": well_name,
        "summary": {
            "total_interval_ft": round(total_feet, 1),
            "net_pay_ft": round(net_pay_feet, 1),
            "is_commercial": net_pay_feet >= 5.0,
        },
        "depths": depths,
        "curves": {
            "GR": gr,
            "VSH": vsh,
            "PHID": phid,
            "NPHI": nphi,
            "RT": rt,
            "PHIE": phi_e_list,
            "SW": sw_list,
        },
    }


# Export Endpoints
@app.post("/api/export-pdf")
async def export_pdf(data: dict):
    try:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )
        styles = getSampleStyleSheet()
        story = []

        well_name = data.get("well_name", "Well_Analysis")
        title_style = ParagraphStyle(
            "TitleStyle",
            parent=styles["Heading1"],
            fontSize=18,
            spaceAfter=12,
            textColor=colors.HexColor("#0f172a"),
        )
        story.append(Paragraph(f"Petrophysical Evaluation Report: {well_name}", title_style))
        story.append(Spacer(1, 10))

        summary = data.get("summary", {})
        table_data = [
            ["Parameter", "Calculated Value"],
            ["Total Analyzed Interval", f"{summary.get('total_interval_ft', 0)} FT"],
            ["Net Pay Thickness", f"{summary.get('net_pay_ft', 0)} FT"],
            [
                "Commercial Evaluation",
                "Commercial Pay Zone" if summary.get("is_commercial") else "Non-Commercial / Barrier",
            ],
        ]

        t = Table(table_data, colWidths=[200, 250])
        t.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ])
        )
        story.append(t)

        doc.build(story)

        pdf_bytes = buffer.getvalue()
        buffer.close()

        if len(pdf_bytes) == 0:
            raise HTTPException(status_code=500, detail="Generated PDF file is empty.")

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={well_name}_report.pdf",
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation error: {str(e)}")


@app.post("/api/export-csv")
async def export_csv(data: dict):
    try:
        depths = data.get("depths", [])
        curves = data.get("curves", {})
        well_name = data.get("well_name", "well_log")

        output = io.StringIO()
        writer = csv.writer(output)

        curve_keys = list(curves.keys())
        headers = ["DEPTH"] + curve_keys
        writer.writerow(headers)

        num_rows = len(depths)
        for i in range(num_rows):
            row = [depths[i]]
            for key in curve_keys:
                curve_vals = curves.get(key, [])
                row.append(curve_vals[i] if i < len(curve_vals) else "")
            writer.writerow(row)

        csv_bytes = output.getvalue().encode("utf-8")

        return StreamingResponse(
            io.BytesIO(csv_bytes),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={well_name}_calculated.csv",
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV export error: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
