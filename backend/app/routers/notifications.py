from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_min_role
from app.db.session import get_db
from app.models import Incident, User
from app.schemas import ActionOut, NotificationRequest
from app.services.action_service import action_service
from app.services.formatters import action_to_dict

router = APIRouter(prefix='/api/notifications', tags=['notification-service'])


@router.post('/send', response_model=ActionOut, dependencies=[Depends(require_min_role('Operator'))])
def send_notification(payload: NotificationRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    incident = db.query(Incident).filter(Incident.incident_id == payload.incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail='Incident not found')
    action = action_service.create_notification(db, incident.incident_id, f'[{payload.channel}] {payload.message}', actor=user.email)
    db.commit()
    db.refresh(action)
    return action_to_dict(action)
