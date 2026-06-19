from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import require_min_role
from app.db.session import get_db
from app.models import AuditLog
from app.schemas import AuditLogOut
from app.services.formatters import audit_to_dict

router = APIRouter(prefix='/api/audit', tags=['audit-governance'])


@router.get('/logs', response_model=list[AuditLogOut], dependencies=[Depends(require_min_role('Admin'))])
def list_audit_logs(db: Session = Depends(get_db), tenant_id: str = 'demo_tenant', limit: int = Query(100, ge=1, le=500)):
    rows = db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [audit_to_dict(row) for row in rows]
