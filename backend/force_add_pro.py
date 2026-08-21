import models, database
from datetime import datetime

models.Base.metadata.create_all(bind=database.engine)
db = database.SessionLocal()

try:
    cols = [c.name for c in models.PaymentSubmission.__table__.columns]
    print(f"Detected columns in PaymentSubmission: {cols}")

    # Build entry dynamically matching available columns
    data = {}
    for email_col in ['email', 'user_email']:
        if email_col in cols:
            data[email_col] = "zayzayaung034@gmail.com"

    for status_col in ['status', 'payment_status', 'state']:
        if status_col in cols:
            data[status_col] = "approved"

    for bool_col in ['is_approved', 'is_paid', 'verified', 'approved']:
        if bool_col in cols:
            data[bool_col] = True

    if 'transaction_id' in cols:
        data['transaction_id'] = "MANUAL_PRO_OVERRIDE"
    if 'payment_method' in cols:
        data['payment_method'] = "admin"
    if 'amount' in cols:
        data['amount'] = "PRO"

    submission = models.PaymentSubmission(**data)
    db.add(submission)
    db.commit()
    print("✅ Success: Manual PRO payment approval record created for 'zayzayaung034@gmail.com'!")

except Exception as e:
    db.rollback()
    print(f"❌ Error: {e}")
finally:
    db.close()