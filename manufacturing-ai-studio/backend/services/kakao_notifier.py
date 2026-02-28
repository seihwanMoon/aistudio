from __future__ import annotations


def send_kakao_alert(phone: str, message: str) -> dict:
    # 실제 카카오 API 연동 대신 MVP 로그 응답
    return {"channel": "kakao", "phone": phone, "message": message, "sent": True}
