from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_min_role
from app.db.session import get_db
from app.models import Event, User
from app.schemas import AMIFEventIn, EventOut, TemperatureSensorRequest, VisionMockRequest
from app.services.event_service import event_service
from app.services.formatters import event_to_dict

router = APIRouter(prefix='/api', tags=['events'])


@router.post('/events', response_model=EventOut, dependencies=[Depends(require_min_role('Analyst'))])
def ingest_event(payload: AMIFEventIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    event = event_service.ingest(db, payload, actor=user.email)
    return event_to_dict(event)


@router.get('/events', response_model=list[EventOut], dependencies=[Depends(require_min_role('Viewer'))])
def list_events(
    db: Session = Depends(get_db),
    tenant_id: str = 'demo_tenant',
    event_type: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
):
    query = db.query(Event).filter(Event.tenant_id == tenant_id)
    if event_type:
        query = query.filter(Event.event_type == event_type)
    events = query.order_by(Event.created_at.desc()).limit(limit).all()
    return [event_to_dict(event) for event in events]


@router.post('/vision/mock-detect', response_model=EventOut, dependencies=[Depends(require_min_role('Analyst'))])
def mock_vision(payload: VisionMockRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    event_type = f'{payload.object_name.lower()}_detected' if payload.object_name.lower() == 'forklift' else 'object_detected'
    event = event_service.ingest(db, AMIFEventIn(
        source_id=payload.source_id,
        source_type='camera',
        event_type=event_type,
        severity='medium',
        location={'site': payload.site, 'building': payload.building, 'zone': payload.zone},
        payload={'object': payload.object_name, 'confidence': payload.confidence, 'bbox': [120, 84, 420, 360], 'frame_uri': 'evidence/demo-frame.jpg'},
        trace={'producer': 'vision-service-mock'},
    ), actor=user.email)
    return event_to_dict(event)


@router.post('/sensors/temperature', response_model=EventOut, dependencies=[Depends(require_min_role('Analyst'))])
def temperature(payload: TemperatureSensorRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    severity = 'high' if payload.temperature_celsius > payload.threshold_celsius else 'low'
    event = event_service.ingest(db, AMIFEventIn(
        source_id=payload.source_id,
        source_type='iot_sensor',
        event_type='temperature_reading',
        severity=severity,
        location={'site': payload.site, 'zone': payload.zone},
        payload={
            'machine_id': payload.machine_id,
            'temperature_celsius': payload.temperature_celsius,
            'threshold_celsius': payload.threshold_celsius,
        },
        trace={'producer': 'sensor-service'},
    ), actor=user.email)
    return event_to_dict(event)
