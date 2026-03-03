from __future__ import annotations

import hashlib
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import SessionLocal
from middleware.auth import create_access_token, get_current_user
from models import User

router = APIRouter()


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def _verify(password: str, password_hash: str) -> bool:
    return _hash_password(password) == password_hash


class LoginPayload(BaseModel):
    username: str
    password: str


class RegisterPayload(BaseModel):
    username: str
    password: str
    role: Literal['admin', 'operator', 'viewer'] = 'viewer'


@router.post('/register')
def register(payload: RegisterPayload):
    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == payload.username).first():
            raise HTTPException(status_code=400, detail='이미 존재하는 사용자입니다.')
        user = User(username=payload.username, password_hash=_hash_password(payload.password), role=payload.role)
        db.add(user)
        db.commit()
        db.refresh(user)
        return {'id': user.id, 'username': user.username, 'role': user.role}
    finally:
        db.close()


@router.post('/login')
def login(payload: LoginPayload):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == payload.username).first()
        if not user or not _verify(payload.password, user.password_hash):
            raise HTTPException(status_code=401, detail='아이디 또는 비밀번호가 올바르지 않습니다.')
        token = create_access_token(subject=user.username, role=user.role)
        return {'access_token': token, 'token_type': 'bearer', 'role': user.role, 'username': user.username}
    finally:
        db.close()


@router.get('/me')
def me(user: dict = Depends(get_current_user)):
    return user
