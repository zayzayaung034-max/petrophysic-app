import csv
from datetime import datetime, timedelta
import io
import os
import sqlite3
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
import lasio
import numpy as np
from pydantic import BaseModel

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

# Import external routers if present
try:
    from payments import payment_router
except ImportError:
    payment_router = None

# Ensure upload directory exists
UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="AKZ Petroleum Engineering Forum API")

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production frontend (e.g., ["http://localhost:5173"])
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],  # Critical for browser file downloads
)

if payment_router:
    app.include_router(payment_router)


# Request Models
class AuthRequest(BaseModel):
    email: str
    password: str


class PaymentSubmitRequest(BaseModel):
    user_email: str
    plan_name: Optional[str] = "Pro Subscription"
    payment_method: str  # 'Western Union', 'USDT', or 'BTC'
    sender_full_name: Optional[str] = None
    sender_country: Optional[str] = None
    mtcn: Optional[str] = None
    tx_hash: Optional[str] = None
    network: Optional[str] = None


# Helper Functions
def safe_float(val: Any) -> Optional[float]:
    if val is None or np.isnan(val):
        return None
    return float(val)


def get_user_trial_info(email: str) -> Dict[str, Any]:
    """Queries SQLite database to fetch remaining trial days and access status."""
    db_path = "instance/forum.db" if os.path.exists("instance/forum.db") else "forum.db"

    if not os.path.exists(db_path):
        return {"is_paid": False, "has_access": True, "trial_days_remaining": 14}

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Find table name ('user' or 'users')
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        table_name = "users" if "users" in tables else ("user" if "user" in tables else None)

        if not table_name:
            conn.close()
            return {"is_paid": False, "has_access": True, "trial_days_remaining": 14}

        # Query user record
        cursor.execute(f"SELECT * FROM {table_name} WHERE email = ?", (email,))
        row = cursor.fetchone()

        if not row:
            conn.close()
            return {"is_paid": False, "has_access": True, "trial_days_remaining": 14}

        # Check column index for trial_ends_at
        cursor.execute(f"PRAGMA table_info({table_name});")
        columns = [col[1] for col in cursor.fetchall()]

        trial_days = 14
        if "trial_ends_at" in columns:
            idx = columns.index("trial_ends_at")
            expiry_val = row[idx]
            if expiry_val:
                expiry_str = str(expiry_val).split(".")[0]
                try:
                    expiry_dt = datetime.strptime(expiry_str, "%Y-%m-%d %H:%M:%S")
                    delta = expiry_dt - datetime.utcnow()
                    trial_days = max(0, delta.days)
                except ValueError:
                    trial_days = 14

        is_paid = False
        if "is_paid" in columns:
            is_paid = bool(row[columns.index("is_paid")])

        conn.close()
        return {
            "is_paid": is_paid,
            "has_access": is_paid or (trial_days > 0),
            "trial_days_remaining": trial_days,
        }

    except Exception as e:
        print(f"Database query error: {e}")
        return {"is_paid": False, "has_access": True, "trial_days_remaining": 14}


# Root Health Check
@app.get("/")
def read_root():
    return {"status": "AKZ Petroleum Engineering Forum API running"}


# Authentication Endpoints
@app.post("/api/auth/register")
async def register(data: AuthRequest):
    if not data.email or not data.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required",
        )

    user_info = get_user_trial_info(data.email)

    return {
        "user_email": data.email,
        "is_paid": user_info["is_paid"],
        "has_access": user_info["has_access"],
        "trial_days_remaining": user_info["trial_days_remaining"],
        "message": "User registered successfully",
    }


@app.post("/api/auth/login")
async def login(data: AuthRequest):
    if not data.email or not data.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required",
        )

    user_info = get_user_trial_info(data.email)

    return {
        "user_email": data.email,
        "is_paid": user_info["is_paid"],
        "has_access": user_info["has_access"],
        "trial_days_remaining": user_info["trial_days_remaining"],
        "message": "Login successful",
    }


# Payment Submission Endpoint
@app.post("/api/auth/submit-payment")
async def submit_payment(payment_data: PaymentSubmitRequest):
    """Processes incoming Western Union, USDT, or BTC proof of payments."""
    print("=== NEW PAYMENT SUBMISSION RECEIVED ===")
    print(f"User Email: {payment_data.user_email}")
    print(f"Plan: {payment_data.plan_name}")
    print(f"Payment Method: {payment_data.payment_method}")

    if payment_data.payment_method == "Western Union":
        print(f"Sender Name: {payment_data.sender_full_name}")
        print(f"Sender Country: {payment_data.sender_country}")
        print(f"MTCN: {payment_data.mtcn}")
    elif payment_data.payment_method in ["USDT", "BTC"]:
        print(f"Network: {payment_data.network or 'Default'}")
        print(f"TxHash: {payment_data.tx_hash}")

    return {
        "status": "success",
        "message": "Payment proof submitted successfully! Your account will be upgraded upon manual verification.",
    }


# File Upload Endpoint
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


# Petrophysical LAS Analysis Endpoint
@app.post("/api/analyze-las")
async def analyze_las(
    file: UploadFile = File(...),
    user_email: Optional[str] = Form(None),
):
    if user_email:
        user_info = get_user_trial_info(user_email)
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

    # Compute PHID from RHOB if PHID is missing (Sandstone matrix rho_ma = 2.65, fluid rho_f = 1.0)
    if all(v is None for v in phid) and any(r is not None for r in rhob):
        phid = []
        for r in rhob:
            if r is not None:
                phi_d_calc = (2.65 - r) / (2.65 - 1.0)
                phid.append(safe_float(max(0.0, min(1.0, phi_d_calc))))
            else:
                phid.append(None)

    # Fallback Vsh calculation from GR if VSH is missing
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
        rt_val = rt[i] if (rt[i] is not None and rt[i] > 0) else 10.0  # Fallback RT

        # Effective Porosity
        phi_e = max(0.0, pd_val * (1.0 - v_val))
        phi_e_list.append(safe_float(phi_e))

        # Archie Water Saturation
        if phi_e > 0.001 and rt_val > 0:
            sw_val = min(1.0, max(0.0, float(((1.0 * 0.05) / ((phi_e**2.0) * rt_val)) ** 0.5)))
        else:
            sw_val = 1.0
        sw_list.append(safe_float(sw_val))

        # Net Pay Cutoffs: Vsh < 30%, Phi_e > 10%, Sw < 50%
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


# PDF Report Generation Endpoint
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


# CSV Export Endpoint
@app.post("/api/export-csv")
async def export_csv(data: dict):
    try:
        depths = data.get("depths", [])
        curves = data.get("curves", {})
        well_name = data.get("well_name", "well_log")

        output = io.StringIO()
        writer = csv.writer(output)

        # Write Header Row
        curve_keys = list(curves.keys())
        headers = ["DEPTH"] + curve_keys
        writer.writerow(headers)

        # Write Data Rows
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