from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_min_role
from app.db.session import get_db
from app.models import Alert, User
from app.schemas import AcknowledgeRequest, AlertOut
from app.services.audit_service import audit
from app.services.formatters import alert_to_dict

router = APIRouter(prefix='/api/alerts', tags=['alerts'])


@router.get('', response_model=list[AlertOut], dependencies=[Depends(require_min_role('Viewer'))])
def list_alerts(db: Session = Depends(get_db), tenant_id: str = 'demo_tenant', limit: int = Query(100, ge=1, le=500)):
    alerts = db.query(Alert).filter(Alert.tenant_id == tenant_id).order_by(Alert.created_at.desc()).limit(limit).all()
    return [alert_to_dict(alert) for alert in alerts]


@router.post('/{alert_id}/acknowledge', response_model=AlertOut, dependencies=[Depends(require_min_role('Operator'))])
def acknowledge(alert_id: str, payload: AcknowledgeRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail='Alert not found')
    alert.status = 'acknowledged'
    alert.acknowledged_at = datetime.now(timezone.utc)
    alert.acknowledged_by = user.email
    audit(db, actor=user.email, action='alert.acknowledged', target_type='alert', target_id=alert_id, metadata={'note': payload.note})
    db.commit()
    db.refresh(alert)
    return alert_to_dict(alert)
