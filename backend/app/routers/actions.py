from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import require_min_role
from app.db.session import get_db
from app.models import ActionResult
from app.schemas import ActionOut
from app.services.formatters import action_to_dict

router = APIRouter(prefix='/api/actions', tags=['action-engine'])


@router.get('', response_model=list[ActionOut], dependencies=[Depends(require_min_role('Viewer'))])
def list_actions(db: Session = Depends(get_db), incident_id: str | None = None, limit: int = Query(100, ge=1, le=500)):
    query = db.query(ActionResult)
    if incident_id:
        query = query.filter(ActionResult.incident_id == incident_id)
    rows = query.order_by(ActionResult.created_at.desc()).limit(limit).all()
    return [action_to_dict(row) for row in rows]
