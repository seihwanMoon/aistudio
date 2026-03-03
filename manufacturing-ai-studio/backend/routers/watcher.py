from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.file_watcher import get_watcher_status, start_watching, stop_watching

router = APIRouter()


class WatcherPayload(BaseModel):
    watch_dir: str
    model_id: int
    threshold: float = 0.7


@router.post('/config')
def configure_watcher(payload: WatcherPayload):
    if not Path(payload.watch_dir).exists():
        raise HTTPException(status_code=400, detail='감시 폴더가 존재하지 않습니다.')
    watcher_id = start_watching(payload.watch_dir, payload.model_id, payload.threshold)
    return {'watcher_id': watcher_id, 'message': '감시 시작'}


@router.post('/stop/{watcher_id}')
def stop_watcher(watcher_id: str):
    stop_watching(watcher_id)
    return {'message': '감시 중지'}


@router.get('/status')
def status():
    return {"watchers": get_watcher_status()}
