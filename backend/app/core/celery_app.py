from celery import Celery
from app.config.settings import settings

# Initialize Celery app with Redis as both broker and backend
celery_app = Celery(
    "omnisight_playbooks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.playbook_worker"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
)
