from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_min_role
from app.db.session import get_db
from app.models import User
from app.schemas import AMIFEventIn, AudioMockRequest, EventOut
from app.services.event_service import event_service
from app.services.formatters import event_to_dict

router = APIRouter(prefix='/api/audio', tags=['audio-service'])


@router.post('/mock-transcribe', response_model=EventOut, dependencies=[Depends(require_min_role('Analyst'))])
def mock_transcribe(payload: AudioMockRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    severity = 'medium' if any(word in payload.text.lower() for word in ['noise', 'alarm', 'help', 'leak']) else 'low'
    event = event_service.ingest(db, AMIFEventIn(
        source_id=payload.source_id,
        source_type='microphone',
        event_type='speech_detected',
        severity=severity,
        location={'site': payload.site, 'zone': payload.zone},
        payload={'speaker': payload.speaker, 'text': payload.text, 'confidence': payload.confidence, 'model': 'whisper-mock'},
        trace={'producer': 'audio-service-mock'},
    ), actor=user.email)
    return event_to_dict(event)
