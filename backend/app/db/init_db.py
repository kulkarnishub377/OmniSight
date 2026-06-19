from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.session import Base, engine
from app.models import User


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def ensure_admin(db: Session) -> None:
    settings = get_settings()
    existing = db.query(User).filter(User.email == settings.admin_email).first()
    if existing:
        return
    admin = User(
        email=settings.admin_email,
        hashed_password=get_password_hash(settings.admin_password),
        role='Admin',
        is_active=True,
    )
    db.add(admin)
    db.commit()
