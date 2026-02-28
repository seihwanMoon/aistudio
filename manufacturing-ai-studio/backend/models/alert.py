from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, func

from database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False, index=True)
    drift_score = Column(Float, nullable=False, default=0.0)
    level = Column(String(20), nullable=False, default="ok")
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
