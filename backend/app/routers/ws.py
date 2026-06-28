from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import asyncio

router = APIRouter(tags=["WebSockets"])

# Simple Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, job_id: str, websocket: WebSocket):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = []
        self.active_connections[job_id].append(websocket)
        print(f"[WS] Client connected to job {job_id}. Active connection count: {len(self.active_connections[job_id])}")

    def disconnect(self, job_id: str, websocket: WebSocket):
        if job_id in self.active_connections:
            if websocket in self.active_connections[job_id]:
                self.active_connections[job_id].remove(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]
        print(f"[WS] Client disconnected from job {job_id}.")

    async def broadcast_to_job(self, job_id: str, message: dict):
        if job_id in self.active_connections:
            print(f"[WS] Broadcasting update for job {job_id}: {message}")
            for connection in self.active_connections[job_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

@router.websocket("/ws/jobs/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await manager.connect(job_id, websocket)
    try:
        while True:
            # Keep connection alive, listen for messages if client sends any
            data = await websocket.receive_text()
            # Just echo back or ignore
            await websocket.send_json({"echo": data})
    except WebSocketDisconnect:
        manager.disconnect(job_id, websocket)
    except Exception as e:
        print(f"[WS] WebSocket error: {e}")
        manager.disconnect(job_id, websocket)
