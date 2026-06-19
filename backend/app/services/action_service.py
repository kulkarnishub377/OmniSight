from sqlalchemy.orm import Session

from app.models import ActionResult
from app.services.audit_service import audit
from app.services.serde import dumps


class ActionService:
    def create_notification(self, db: Session, incident_id: str, message: str, actor: str = 'system') -> ActionResult:
        result = ActionResult(
            incident_id=incident_id,
            action_type='dashboard_notification',
            status='completed',
            payload_json=dumps({'message': message}),
        )
        db.add(result)
        audit(db, actor=actor, action='action.dashboard_notification', target_type='incident', target_id=incident_id)
        return result

    def create_ticket_stub(self, db: Session, incident_id: str, title: str, actor: str = 'system') -> ActionResult:
        result = ActionResult(
            incident_id=incident_id,
            action_type='ticket.create_stub',
            status='completed',
            payload_json=dumps({'ticket_title': title, 'external_ticket_id': f'DEMO-{incident_id[-6:]}'}),
        )
        db.add(result)
        audit(db, actor=actor, action='action.ticket_created_stub', target_type='incident', target_id=incident_id)
        return result


action_service = ActionService()
