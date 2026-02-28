from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
TOKEN_EXPIRE_MINUTES = 60 * 8

try:
    from jose import JWTError, jwt
except Exception:  # noqa: BLE001
    JWTError = Exception
    jwt = None

bearer_scheme = HTTPBearer(auto_error=False)


def _fallback_encode(payload: dict) -> str:
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    sig = hmac.new(SECRET_KEY.encode('utf-8'), body, hashlib.sha256).hexdigest().encode('utf-8')
    return base64.urlsafe_b64encode(body + b'.' + sig).decode('utf-8')


def _fallback_decode(token: str) -> dict:
    raw = base64.urlsafe_b64decode(token.encode('utf-8'))
    body, sig = raw.rsplit(b'.', 1)
    expected = hmac.new(SECRET_KEY.encode('utf-8'), body, hashlib.sha256).hexdigest().encode('utf-8')
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=401, detail='유효하지 않은 토큰입니다.')
    payload = json.loads(body.decode('utf-8'))
    if payload.get('exp_ts', 0) < int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status_code=401, detail='토큰이 만료되었습니다.')
    return payload


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "role": role, "exp_ts": int(expire.timestamp())}
    if jwt is not None:
        return jwt.encode(payload, SECRET_KEY, algorithm='HS256')
    return _fallback_encode(payload)


def decode_token(token: str) -> dict:
    if jwt is not None:
        try:
            return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        except JWTError as exc:
            raise HTTPException(status_code=401, detail='유효하지 않은 토큰입니다.') from exc
    return _fallback_decode(token)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail='인증 정보가 필요합니다.')
    return decode_token(credentials.credentials)


def require_roles(roles: list[str]):
    def _checker(user: dict = Depends(get_current_user)):
        if user.get('role') not in roles:
            raise HTTPException(status_code=403, detail='권한이 없습니다.')
        return user

    return _checker
