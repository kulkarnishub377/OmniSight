from fastapi import APIRouter

from app.services.event_service import TOPICS

router = APIRouter(tags=['health'])


@router.get('/health')
def health():
    return {'status': 'ok', 'service': 'amif-backend'}


@router.get('/api/topics')
def topics():
    return TOPICS
