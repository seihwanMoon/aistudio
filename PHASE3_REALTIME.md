# 🔴 PHASE3_REALTIME — 실시간 예측 & 현장 연동 시스템

> **담당 PROGRESS 항목**: P3-01 ~ P3-26
> **선행 조건**: Phase 2 완료 (`PROGRESS.md` P2-01 ~ P2-22 전체 체크)
> **목표 기간**: 12주
> **완료 기준**: 공정 데이터 자동 수집 + 실시간 이상 감지 + 카카오/이메일 알림

---

## 📋 이번 Phase에서 만들 것

```
CSV 폴더 감시 → 자동 예측 실행 → WebSocket으로 대시보드 전송
    → 임계값 초과 시 카카오/이메일 알림 → 이상 원인 분석 표시
    + JWT 로그인 + 권한 관리
```

---

## [W1-W2] 파일 감시 파이프라인

### `backend/requirements.txt` — Phase 3 주석 해제
```
# Phase 3 — 아래 줄들 주석 해제
watchdog==4.0.0
httpx==0.27.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
```

### `backend/services/file_watcher.py`
```python
import asyncio, json, uuid, time
import pandas as pd
import joblib
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from database import SessionLocal
from models import TrainedModel, Prediction

# WebSocket 브로드캐스트 함수 (realtime.py에서 주입)
_broadcast_fn = None

def set_broadcast_fn(fn):
    global _broadcast_fn
    _broadcast_fn = fn


class CSVHandler(FileSystemEventHandler):
    def __init__(self, model_id: str, threshold: float = 0.7):
        self.model_id = model_id
        self.threshold = threshold

    def on_created(self, event):
        if event.is_directory:
            return
        if event.src_path.endswith(".csv"):
            # 파일이 완전히 쓰여질 때까지 잠깐 대기
            time.sleep(0.5)
            asyncio.run(self._process(event.src_path))

    async def _process(self, filepath: str):
        print(f"[파일감시] 새 파일 감지: {filepath}")
        try:
            df = pd.read_csv(filepath, encoding="utf-8-sig")
        except Exception as e:
            print(f"[파일감시] CSV 읽기 실패: {e}")
            return

        db = SessionLocal()
        try:
            model_record = db.query(TrainedModel).filter(
                TrainedModel.id == self.model_id
            ).first()
            if not model_record:
                return

            automl = joblib.load(model_record.model_path)
            predictions = automl.predict(df).tolist()
            probabilities = []
            if hasattr(automl, "predict_proba"):
                proba = automl.predict_proba(df)
                probabilities = proba[:, 1].tolist() if proba.shape[1] == 2 else proba.max(axis=1).tolist()

            # DB 저장
            for i, (pred, row) in enumerate(zip(predictions, df.to_dict("records"))):
                prob = probabilities[i] if probabilities else None
                pred_record = Prediction(
                    id=str(uuid.uuid4()),
                    model_id=self.model_id,
                    input_data=json.dumps(row, ensure_ascii=False),
                    output_data=json.dumps(
                        {"prediction": str(pred), "probability": float(prob or 0)},
                        ensure_ascii=False
                    ),
                    source="auto",
                )
                db.add(pred_record)

            db.commit()

            # WebSocket 브로드캐스트
            if _broadcast_fn:
                high_risk_count = sum(1 for p in probabilities if p >= self.threshold)
                await _broadcast_fn({
                    "type": "batch_prediction",
                    "file": Path(filepath).name,
                    "total": len(predictions),
                    "high_risk_count": high_risk_count,
                    "max_probability": max(probabilities) if probabilities else 0,
                    "alert_level": "danger" if high_risk_count > 0 else "ok",
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "predictions": [
                        {"index": i, "prediction": str(p), "probability": float(prob or 0)}
                        for i, (p, prob) in enumerate(zip(predictions, probabilities or [None]*len(predictions)))
                    ],
                })

        finally:
            db.close()


# 활성 감시 인스턴스 저장
_watchers: dict = {}


def start_watching(watch_dir: str, model_id: str, threshold: float = 0.7) -> str:
    """폴더 감시 시작"""
    watcher_id = str(uuid.uuid4())[:8]
    handler = CSVHandler(model_id, threshold)
    observer = Observer()
    observer.schedule(handler, path=watch_dir, recursive=False)
    observer.start()
    _watchers[watcher_id] = observer
    print(f"[파일감시] 시작: {watch_dir} (ID: {watcher_id})")
    return watcher_id


def stop_watching(watcher_id: str):
    """폴더 감시 중지"""
    if watcher_id in _watchers:
        _watchers[watcher_id].stop()
        _watchers[watcher_id].join()
        del _watchers[watcher_id]
        print(f"[파일감시] 중지: {watcher_id}")


def get_watcher_status() -> dict:
    return {
        watcher_id: observer.is_alive()
        for watcher_id, observer in _watchers.items()
    }
```

### `backend/routers/watcher.py`
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.file_watcher import start_watching, stop_watching, get_watcher_status

router = APIRouter()


class WatcherConfig(BaseModel):
    watch_dir: str        # 감시할 폴더 경로
    model_id: str         # 예측에 사용할 모델 ID
    threshold: float = 0.7  # 알림 발송 임계값


@router.post("/start")
def start_watcher(config: WatcherConfig):
    from pathlib import Path
    if not Path(config.watch_dir).exists():
        raise HTTPException(400, f"폴더가 존재하지 않습니다: {config.watch_dir}")

    watcher_id = start_watching(config.watch_dir, config.model_id, config.threshold)
    return {"watcher_id": watcher_id, "message": f"'{config.watch_dir}' 감시를 시작했습니다"}


@router.post("/stop/{watcher_id}")
def stop_watcher(watcher_id: str):
    stop_watching(watcher_id)
    return {"message": "감시를 중지했습니다"}


@router.get("/status")
def watcher_status():
    return {"watchers": get_watcher_status()}
```

---

## [W3-W4] WebSocket 실시간 스트리밍

### `backend/routers/realtime.py`
```python
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services import file_watcher

router = APIRouter()

# 연결된 WebSocket 클라이언트 목록
_connections: list[WebSocket] = []


async def broadcast(data: dict):
    """모든 연결된 클라이언트에 메시지 전송"""
    if not _connections:
        return
    message = json.dumps(data, ensure_ascii=False)
    disconnected = []
    for ws in _connections:
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        _connections.remove(ws)


# file_watcher 에 broadcast 함수 주입
file_watcher.set_broadcast_fn(broadcast)


@router.websocket("/ws/predictions")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    _connections.append(websocket)
    print(f"[WebSocket] 클라이언트 연결 (총 {len(_connections)}개)")

    try:
        while True:
            # ping 메시지 수신 (연결 유지)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        _connections.remove(websocket)
        print(f"[WebSocket] 클라이언트 연결 해제 (총 {len(_connections)}개)")
```

### `frontend/src/hooks/useRealtimePredictions.js`
```javascript
import { useState, useEffect, useRef, useCallback } from "react";

export function useRealtimePredictions(maxItems = 200) {
  const [predictions, setPredictions] = useState([]);
  const [latestBatch, setLatestBatch] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const pingRef = useRef(null);

  const connect = useCallback(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000";
    wsRef.current = new WebSocket(`${wsUrl}/ws/predictions`);

    wsRef.current.onopen = () => {
      setIsConnected(true);
      console.log("[WebSocket] 연결됨");
      // 30초마다 ping 전송 (연결 유지)
      pingRef.current = setInterval(() => {
        wsRef.current?.send("ping");
      }, 30000);
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "pong") return;

      if (data.type === "batch_prediction") {
        setLatestBatch(data);
        setPredictions((prev) => {
          const newItems = data.predictions.map((p) => ({
            ...p,
            timestamp: data.timestamp,
            file: data.file,
          }));
          return [...prev, ...newItems].slice(-maxItems);
        });

        if (data.alert_level === "danger") {
          setAlerts((prev) => [
            {
              id: Date.now(),
              message: `⚠️ ${data.file}: ${data.high_risk_count}건 고위험 감지 (최대 ${(data.max_probability * 100).toFixed(1)}%)`,
              level: "danger",
              timestamp: data.timestamp,
            },
            ...prev,
          ].slice(0, 20));
        }
      }
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
      clearInterval(pingRef.current);
      console.log("[WebSocket] 연결 해제 — 5초 후 재연결 시도");
      setTimeout(connect, 5000);
    };

    wsRef.current.onerror = (err) => {
      console.error("[WebSocket] 오류:", err);
      wsRef.current?.close();
    };
  }, [maxItems]);

  useEffect(() => {
    connect();
    return () => {
      clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { predictions, latestBatch, alerts, isConnected };
}
```

### `frontend/src/components/charts/RealtimeChart.jsx`
```jsx
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid
} from "recharts";

export default function RealtimeChart({ predictions, threshold = 0.7 }) {
  // 최근 50건만 표시
  const data = predictions.slice(-50).map((p, i) => ({
    index: i + 1,
    probability: parseFloat((p.probability * 100).toFixed(1)),
    timestamp: p.timestamp?.slice(11, 16),  // HH:MM
    prediction: p.prediction,
  }));

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload.probability >= threshold * 100) {
      return <circle cx={cx} cy={cy} r={6} fill="#E74C3C" stroke="white" strokeWidth={2} />;
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-primary">실시간 불량 예측 확률</h3>
        <span className="text-sm text-gray-500">최근 {data.length}건</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F4" />
          <XAxis dataKey="timestamp" tick={{ fontSize: 11 }} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(v) => [`${v}%`, "불량 확률"]}
            labelFormatter={(l) => `시각: ${l}`}
          />
          {/* 경고 임계값 기준선 */}
          <ReferenceLine
            y={threshold * 100}
            stroke="#E74C3C"
            strokeDasharray="4 4"
            label={{ value: `경고 (${threshold * 100}%)`, fill: "#E74C3C", fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="probability"
            stroke="#2E86C1"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## [W5-W6] 알림 시스템

### `backend/services/kakao_notifier.py`
```python
import httpx, json, os
from datetime import datetime

KAKAO_API_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send"


async def send_kakao_alert(access_token: str, alert_data: dict):
    """
    카카오 나에게 메시지 보내기 (개인용)
    비즈니스 알림톡은 별도 카카오 비즈 채널 설정 필요

    alert_data: {
        file: str, count: int, max_prob: float, timestamp: str
    }
    """
    prob_pct = round(alert_data.get("max_prob", 0) * 100, 1)
    text = (
        f"[🏭 Manufacturing AI 이상 감지]\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📁 파일: {alert_data.get('file', '-')}\n"
        f"⚠️ 고위험 건수: {alert_data.get('count', 0)}건\n"
        f"📊 최대 위험도: {prob_pct}%\n"
        f"🕐 시각: {alert_data.get('timestamp', datetime.now().strftime('%Y-%m-%d %H:%M'))}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"즉시 공정 라인을 점검하세요."
    )

    payload = {
        "template_object": json.dumps({
            "object_type": "text",
            "text": text,
            "link": {"web_url": "http://localhost:3000/realtime"},
            "button_title": "대시보드 확인",
        })
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            KAKAO_API_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            data=payload,
        )
        if response.status_code != 200:
            print(f"[카카오] 발송 실패: {response.text}")
            return False
        print(f"[카카오] 알림 발송 성공")
        return True
```

### `backend/services/email_notifier.py`
```python
import smtplib, json, os
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")


def send_daily_report(
    recipients: list[str],
    stats: dict,
    pdf_path: str = None
) -> bool:
    """
    일간 예측 요약 리포트 이메일 발송
    stats: {
        date: str, total_predictions: int, high_risk_count: int,
        avg_risk_probability: float, model_name: str
    }
    """
    if not SMTP_USER or not SMTP_PASS:
        print("[이메일] SMTP 설정이 없습니다")
        return False

    msg = MIMEMultipart("alternative")
    yesterday = stats.get("date", (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"))
    msg["Subject"] = f"[Manufacturing AI] {yesterday} 일간 예측 리포트"
    msg["From"] = SMTP_USER
    msg["To"] = ", ".join(recipients)

    html_body = f"""
    <html><body style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1E3A5F; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">🏭 Manufacturing AI 일간 리포트</h1>
        <p style="margin: 4px 0 0; opacity: 0.8;">{yesterday}</p>
      </div>
      <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px; background: #EBF5FB; border-radius: 8px; text-align: center; width: 33%;">
              <div style="font-size: 28px; font-weight: bold; color: #1E3A5F;">{stats.get('total_predictions', 0)}</div>
              <div style="color: #666; font-size: 13px;">총 예측 건수</div>
            </td>
            <td style="width: 10px;"></td>
            <td style="padding: 12px; background: {'#FDEDEC' if stats.get('high_risk_count', 0) > 0 else '#EAFAF1'}; border-radius: 8px; text-align: center; width: 33%;">
              <div style="font-size: 28px; font-weight: bold; color: {'#E74C3C' if stats.get('high_risk_count', 0) > 0 else '#27AE60'};">{stats.get('high_risk_count', 0)}</div>
              <div style="color: #666; font-size: 13px;">고위험 감지 건수</div>
            </td>
            <td style="width: 10px;"></td>
            <td style="padding: 12px; background: #EBF5FB; border-radius: 8px; text-align: center; width: 33%;">
              <div style="font-size: 28px; font-weight: bold; color: #1E3A5F;">{round(stats.get('avg_risk_probability', 0) * 100, 1)}%</div>
              <div style="color: #666; font-size: 13px;">평균 위험도</div>
            </td>
          </tr>
        </table>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          사용 모델: {stats.get('model_name', '-')} | Manufacturing AI Studio v1.0
        </p>
      </div>
    </body></html>
    """

    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # PDF 첨부 (있는 경우)
    if pdf_path and Path(pdf_path).exists():
        with open(pdf_path, "rb") as f:
            part = MIMEBase("application", "pdf")
            part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f"attachment; filename=report_{yesterday}.pdf")
            msg.attach(part)

    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, recipients, msg.as_string())
        print(f"[이메일] 일간 리포트 발송 완료: {', '.join(recipients)}")
        return True
    except Exception as e:
        print(f"[이메일] 발송 실패: {e}")
        return False
```

### `backend/scheduler.py` — 이메일 스케줄 추가 (Phase 3)
```python
@scheduler.scheduled_job(CronTrigger(hour=8, minute=0))
async def daily_email_report():
    """매일 오전 8시 전날 예측 요약 이메일 발송"""
    from services.email_notifier import send_daily_report
    from models import Prediction, TrainedModel
    import json
    from datetime import datetime, timedelta

    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    db = SessionLocal()
    try:
        yesterday_preds = (
            db.query(Prediction)
            .filter(Prediction.created_at >= yesterday)
            .filter(Prediction.source == "auto")
            .all()
        )
        if not yesterday_preds:
            return

        probs = []
        for p in yesterday_preds:
            out = json.loads(p.output_data)
            probs.append(float(out.get("probability", 0)))

        stats = {
            "date": yesterday,
            "total_predictions": len(yesterday_preds),
            "high_risk_count": sum(1 for p in probs if p >= 0.7),
            "avg_risk_probability": sum(probs) / len(probs) if probs else 0,
            "model_name": "운영 모델",
        }

        recipients = os.getenv("REPORT_RECIPIENTS", "").split(",")
        recipients = [r.strip() for r in recipients if r.strip()]
        if recipients:
            await asyncio.get_event_loop().run_in_executor(
                None, send_daily_report, recipients, stats
            )
    finally:
        db.close()
```

---

## [W9-W10] JWT 인증 & 권한 관리

### `backend/models/user.py`
```python
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id            = Column(String, primary_key=True)
    username      = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role          = Column(String, default="viewer")  # admin | operator | viewer
    email         = Column(String)
    is_active     = Column(Integer, default=1)
    created_at    = Column(DateTime, default=func.now())
```

### `backend/middleware/auth.py`
```python
import os
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 480))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ROLE_PERMISSIONS = {
    "admin":    {"read", "write", "delete", "admin"},
    "operator": {"read", "write"},
    "viewer":   {"read"},
}


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증이 필요합니다. 다시 로그인하세요.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_role(*roles: str):
    """역할 기반 접근 제어 데코레이터"""
    def dependency(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"이 기능은 {' 또는 '.join(roles)} 권한이 필요합니다",
            )
        return user
    return dependency
```

### `backend/routers/auth.py`
```python
import uuid
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from database import SessionLocal
from models import User
from middleware.auth import (
    hash_password, verify_password, create_access_token, get_current_user
)

router = APIRouter()


def create_default_admin():
    """앱 최초 실행 시 기본 관리자 계정 생성"""
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                id=str(uuid.uuid4()),
                username="admin",
                password_hash=hash_password("admin1234"),  # 최초 비밀번호
                role="admin",
                email="",
            )
            db.add(admin)
            db.commit()
            print("[인증] 기본 관리자 계정 생성 완료 (admin / admin1234)")
    finally:
        db.close()


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == form.username).first()
        if not user or not verify_password(form.password, user.password_hash):
            raise HTTPException(401, "아이디 또는 비밀번호가 올바르지 않습니다")
        if not user.is_active:
            raise HTTPException(403, "비활성화된 계정입니다")

        token = create_access_token({
            "sub": user.id,
            "username": user.username,
            "role": user.role,
        })
        return {
            "access_token": token,
            "token_type": "bearer",
            "role": user.role,
            "username": user.username,
        }
    finally:
        db.close()


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
```

---

## [W11] 모바일 반응형 가이드

### Tailwind 브레이크포인트 적용 규칙

```jsx
// 사이드바 — 모바일에서 하단 탭으로 전환
// components/layout/Sidebar.jsx

export default function Sidebar() {
  return (
    <>
      {/* 데스크탑: 왼쪽 사이드바 */}
      <nav className="hidden md:flex flex-col w-56 bg-primary min-h-screen p-4">
        {/* 메뉴 아이템 */}
      </nav>

      {/* 모바일: 하단 탭 바 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 z-50">
        {/* 하단 탭 아이콘 */}
      </nav>
    </>
  );
}

// 카드 그리드 — 반응형
// 모바일 1열 / 태블릿 2열 / 데스크탑 3열
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  ...
</div>

// 실시간 차트 — 모바일에서 높이 축소
<ResponsiveContainer width="100%" height={window.innerWidth < 768 ? 180 : 280}>
  ...
</ResponsiveContainer>
```

---

## [W12] `docker-compose.yml` 최종 완성본

```yaml
version: "3.9"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./backend/data:/app/data
      - ./backend/templates:/app/templates
      - /tmp/mas-watch:/watch   # 파일 감시 폴더 (마운트)
    environment:
      - DATABASE_URL=sqlite:///./data/manufacturing_ai.db
      - MLFLOW_TRACKING_URI=http://mlflow:5000
      - SECRET_KEY=${SECRET_KEY:-change-me-in-production}
      - KAKAO_REST_API_KEY=${KAKAO_REST_API_KEY:-}
      - SMTP_HOST=${SMTP_HOST:-smtp.gmail.com}
      - SMTP_PORT=${SMTP_PORT:-465}
      - SMTP_USER=${SMTP_USER:-}
      - SMTP_PASS=${SMTP_PASS:-}
      - REPORT_RECIPIENTS=${REPORT_RECIPIENTS:-}
    depends_on:
      - mlflow
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped

  mlflow:
    image: ghcr.io/mlflow/mlflow:v2.11.0
    ports:
      - "5000:5000"
    volumes:
      - ./mlflow-data:/mlflow
    command: >
      mlflow server
      --backend-store-uri sqlite:///mlflow/mlflow.db
      --default-artifact-root /mlflow/artifacts
      --host 0.0.0.0 --port 5000
    restart: unless-stopped

volumes:
  mas-watch:
    driver: local
```

---

## ✅ Phase 3 완료 체크리스트

- [x] `/app/data/uploads/watch` 에 CSV 파일 복사 → 실시간 이벤트/알림 로그 자동 반영 확인
- [x] 불량 확률 임계치 초과 배치 CSV → 카카오 알림(모의 발송) 확인
- [x] 매일 오전 8시 이메일 리포트 수신 확인 (또는 수동 테스트) (모의 발송 테스트 API 검증)
- [x] admin / operator / viewer 계정 각각 접근 권한 테스트
- [x] 스마트폰(모바일) 브라우저에서 대시보드 정상 표시 확인 (반응형 레이아웃/모바일 탭바 검증)
- [x] Docker 재시작 후 파일 감시 자동 재개 확인 (watcher 상태 영속화/복구 구현)

---

## 📋 카카오 알림 설정 가이드 (사용자 매뉴얼)

1. [카카오 개발자 센터](https://developers.kakao.com) 접속
2. 내 애플리케이션 → 앱 생성
3. `카카오 로그인` 활성화
4. REST API 키 복사 → `.env` 의 `KAKAO_REST_API_KEY` 에 입력
5. Manufacturing AI Studio 설정 페이지에서 카카오 계정 연동 버튼 클릭
6. OAuth 인증 완료 후 알림 테스트 발송

> ⚠️ 비즈니스 알림톡(다수 수신)은 카카오 비즈니스 채널 별도 개설 필요. 개인 사용 시 "나에게 보내기" 기능으로 충분합니다.
