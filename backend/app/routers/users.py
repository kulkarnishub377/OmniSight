from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import require_min_role
from app.db.session import get_db
from app.models import User
from app.schemas import UserOut

router = APIRouter(prefix='/api/users', tags=['user-service'])


@router.get('', response_model=list[UserOut], dependencies=[Depends(require_min_role('Admin'))])
def list_users(db: Session = Depends(get_db), limit: int = Query(100, ge=1, le=500)):
    return db.query(User).order_by(User.created_at.desc()).limit(limit).all()
