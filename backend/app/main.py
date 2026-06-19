from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.core.security import limiter
from app.db.init_db import ensure_admin, init_db
from app.db.session import SessionLocal
from app.routers import actions, alerts, audit, audio, auth, demo, documents, events, health, incidents, knowledge, notifications, system, users

try:
    from prometheus_fastapi_instrumentator import Instrumentator
except Exception:  # pragma: no cover
    Instrumentator = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        ensure_admin(db)
    finally:
        db.close()
    yield


settings = get_settings()
app = FastAPI(
    title='OmniSight v1.0 API',
    description='Autonomous Multi-Modal Incident Intelligence Fabric',
    version='1.0.0',
    lifespan=lifespan,
    docs_url='/api-docs',
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(events.router)
app.include_router(audio.router)
app.include_router(incidents.router)
app.include_router(alerts.router)
app.include_router(documents.router)
app.include_router(notifications.router)
app.include_router(actions.router)
app.include_router(audit.router)
app.include_router(knowledge.router)
app.include_router(system.router)
app.include_router(demo.router)

if Instrumentator:
    Instrumentator().instrument(app).expose(app, endpoint='/metrics')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app.mount('/static', StaticFiles(directory=os.path.join(BASE_DIR, 'static')), name='static')
app.mount('/reports', StaticFiles(directory=os.path.join(BASE_DIR, 'reports')), name='reports')
app.mount('/docs', StaticFiles(directory=os.path.join(BASE_DIR, 'docs')), name='docs')

@app.get('/')
def read_root():
    return FileResponse(os.path.join(BASE_DIR, 'index.html'))
