from __future__ import annotations


def send_email_report(recipient: str, subject: str, body: str) -> dict:
    # 실제 SMTP 연동 대신 MVP 로그 응답
    return {"channel": "email", "recipient": recipient, "subject": subject, "sent": True}
