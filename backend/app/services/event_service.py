from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Event
from app.schemas import AMIFEventIn
from app.services.audit_service import audit
from app.services.event_processor import event_processor
from app.services.serde import dumps


TOPICS = {
    'raw_events': 'raw.events',
    'processed_events': 'processed.events',
    'incident_events': 'incident.events',
    'alert_events': 'alert.events',
    'agent_tasks': 'agent.tasks',
    'agent_results': 'agent.results',
    'dead_letter_events': 'dead_letter.events',
    'audit_events': 'audit.events',
}


class EventService:
    def ingest(self, db: Session, payload: AMIFEventIn, actor: str = 'system') -> Event:
        existing = None
        if payload.source_sequence is not None:
            existing = db.query(Event).filter(
                Event.tenant_id == payload.tenant_id,
                Event.source_id == payload.source_id,
                Event.source_sequence == payload.source_sequence,
            ).first()
        if existing:
            return existing

        event = Event(
            event_id=payload.event_id,
            schema_version=payload.schema_version,
            tenant_id=payload.tenant_id,
            source_id=payload.source_id,
            source_type=payload.source_type,
            source_sequence=payload.source_sequence,
            event_type=payload.event_type,
            severity=payload.severity,
            timestamp=payload.timestamp,
            location_json=dumps(payload.location),
            payload_json=dumps(payload.payload),
            trace_json=dumps(payload.trace),
            status='raw',
        )
        db.add(event)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            duplicate = db.query(Event).filter(Event.event_id == payload.event_id).first()
            if duplicate:
                return duplicate
            raise
        audit(db, actor=actor, action='event.ingested', target_type='event', target_id=event.event_id, tenant_id=payload.tenant_id)
        event_processor.process(db, event)
        db.commit()
        db.refresh(event)
        return event


event_service = EventService()
