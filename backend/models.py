from sqlalchemy import Column, Integer, String, DateTime, Boolean
from datetime import datetime, timedelta
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    is_paid = Column(Boolean, default=False)
    trial_ends_at = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(days=14))
    created_at = Column(DateTime, default=datetime.utcnow)

class PaymentSubmission(Base):
    __tablename__ = "payment_submissions"

    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, nullable=False)
    plan_name = Column(String, default="Pro Subscription")
    payment_method = Column(String, nullable=False)
    sender_full_name = Column(String, nullable=True)
    sender_country = Column(String, nullable=True)
    mtcn = Column(String, nullable=True)
    tx_hash = Column(String, nullable=True)
    network = Column(String, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)