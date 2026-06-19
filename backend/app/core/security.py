from datetime import datetime, timedelta, timezone
from typing import Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import base64
import hashlib
import hmac
import secrets

from jose import JWTError, jwt
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


def get_password_hash(password: str) -> str:
    """Return a PBKDF2-SHA256 password hash.

    This avoids native bcrypt build/runtime issues in minimal demo environments.
    For production, Argon2id or a managed identity provider is recommended.
    """
    iterations = 260_000
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
    return 'pbkdf2_sha256${}${}${}'.format(
        iterations,
        base64.b64encode(salt).decode('ascii'),
        base64.b64encode(digest).decode('ascii'),
    )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        scheme, iterations, salt_b64, digest_b64 = hashed_password.split('$', 3)
        if scheme != 'pbkdf2_sha256':
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
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
    except JWTError as exc:
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
