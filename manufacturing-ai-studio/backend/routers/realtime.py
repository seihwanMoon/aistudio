from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services import file_watcher

router = APIRouter()
_connections: list[WebSocket] = []


async def broadcast_prediction(data: dict):
    if not _connections:
        return
    message = json.dumps(data, ensure_ascii=False)
    disconnected = []
    for ws in _connections:
        try:
            await ws.send_text(message)
        except Exception:  # noqa: BLE001
            disconnected.append(ws)
    for ws in disconnected:
        if ws in _connections:
            _connections.remove(ws)


file_watcher.set_broadcast_fn(broadcast_prediction)


@router.websocket('/ws/predictions')
async def ws_predictions(websocket: WebSocket):
    await websocket.accept()
    _connections.append(websocket)
    try:
        while True:
            text = await websocket.receive_text()
            if text == 'ping':
                await websocket.send_text(json.dumps({'type': 'pong'}))
    except WebSocketDisconnect:
        if websocket in _connections:
            _connections.remove(websocket)
