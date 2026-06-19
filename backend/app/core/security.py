from datetime import datetime, timedelta, timezone
from typing import Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
import jwt
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/auth/login')

ROLE_RANK = {
    'Viewer': 1,
    'Analyst': 2,
    'Operator': 3,
    'Admin': 4,
    'ServiceAccount': 4,
}


pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

def get_password_hash(password: str) -> str:
    """Return a bcrypt password hash."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def create_access_token(subject: str, role: str, expires_delta: timedelta | None = None) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    payload = {'sub': subject, 'role': role, 'exp': expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    settings = get_settings()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Could not validate credentials',
        headers={'WWW-Authenticate': 'Bearer'},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str | None = payload.get('sub')
        if email is None:
            raise credentials_exception
    except jwt.InvalidTokenError as exc:
        raise credentials_exception from exc
    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_min_role(min_role: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if ROLE_RANK.get(user.role, 0) < ROLE_RANK.get(min_role, 99):
            raise HTTPException(status_code=403, detail=f'{min_role}+ role required')
        return user
    return dependency


def require_any_role(roles: Iterable[str]):
    allowed = set(roles)

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(status_code=403, detail=f'One of {sorted(allowed)} required')
        return user
    return dependency
