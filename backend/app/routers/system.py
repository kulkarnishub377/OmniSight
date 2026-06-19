from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_min_role
from app.db.session import get_db
from app.models import AgentRun, Alert, AuditLog, Document, Event, Incident
from app.schemas import SystemStats
from app.services.event_service import TOPICS

router = APIRouter(prefix='/api/system', tags=['system'])


@router.get('/stats', response_model=SystemStats, dependencies=[Depends(require_min_role('Viewer'))])
def stats(db: Session = Depends(get_db)):
    return {
        'events': db.query(Event).count(),
        'incidents': db.query(Incident).count(),
        'alerts': db.query(Alert).count(),
        'documents': db.query(Document).count(),
        'agent_runs': db.query(AgentRun).count(),
        'audit_logs': db.query(AuditLog).count(),
        'topics': TOPICS,
    }
