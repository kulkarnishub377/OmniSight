from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_min_role
from app.db.session import get_db
from app.models import AgentRun, Incident, User
from app.schemas import AgentRunOut, IncidentOut, IncidentUpdate
from app.services.agent_service import agent_service
from app.services.formatters import agent_run_to_dict, incident_to_dict

router = APIRouter(prefix='/api/incidents', tags=['incidents'])


@router.get('', response_model=list[IncidentOut], dependencies=[Depends(require_min_role('Viewer'))])
def list_incidents(db: Session = Depends(get_db), tenant_id: str = 'demo_tenant', limit: int = Query(100, ge=1, le=500)):
    incidents = db.query(Incident).filter(Incident.tenant_id == tenant_id).order_by(Incident.created_at.desc()).limit(limit).all()
    return [incident_to_dict(incident) for incident in incidents]


@router.get('/{incident_id}', response_model=IncidentOut, dependencies=[Depends(require_min_role('Viewer'))])
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.incident_id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail='Incident not found')
    return incident_to_dict(incident)


@router.patch('/{incident_id}', response_model=IncidentOut, dependencies=[Depends(require_min_role('Operator'))])
def update_incident(incident_id: str, payload: IncidentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    incident = db.query(Incident).filter(Incident.incident_id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail='Incident not found')
    if payload.status is not None:
        incident.status = payload.status
    if payload.severity is not None:
        incident.severity = payload.severity
    if payload.risk_score is not None:
        incident.risk_score = payload.risk_score
    if payload.summary is not None:
        incident.summary = payload.summary
    from datetime import datetime, timezone
    from app.services.audit_service import audit
    incident.updated_at = datetime.now(timezone.utc)
    audit(db, actor=user.email, action='incident.updated', target_type='incident', target_id=incident_id, metadata=payload.model_dump(exclude_none=True), tenant_id=incident.tenant_id)
    db.commit()
    db.refresh(incident)
    return incident_to_dict(incident)


@router.post('/{incident_id}/investigate', response_model=AgentRunOut, dependencies=[Depends(require_min_role('Analyst'))])
def investigate(incident_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    incident = db.query(Incident).filter(Incident.incident_id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail='Incident not found')
    run = agent_service.run_investigation(db, incident_id, actor=user.email)
    return agent_run_to_dict(run)


@router.get('/{incident_id}/agent-runs', response_model=list[AgentRunOut], dependencies=[Depends(require_min_role('Viewer'))])
def agent_runs(incident_id: str, db: Session = Depends(get_db)):
    runs = db.query(AgentRun).filter(AgentRun.incident_id == incident_id).order_by(AgentRun.created_at.desc()).all()
    return [agent_run_to_dict(run) for run in runs]
