from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pathlib import Path
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/manufacturing_ai.db")

# SQLite 파일이 저장될 data/ 폴더 생성
Path("data").mkdir(exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite 전용 설정
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """FastAPI Depends 주입용 DB 세션 제공"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
