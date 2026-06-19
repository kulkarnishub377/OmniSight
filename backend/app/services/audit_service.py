from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog
from app.services.serde import dumps


def audit(db: Session, actor: str, action: str, target_type: str | None = None, target_id: str | None = None, metadata: dict[str, Any] | None = None, tenant_id: str = 'demo_tenant') -> None:
    db.add(AuditLog(
        tenant_id=tenant_id,
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata_json=dumps(metadata or {}),
    ))
