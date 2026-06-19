from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import authenticate_user, create_access_token, get_current_user, get_password_hash, require_min_role
from app.db.session import get_db
from app.models import User
from app.schemas import Token, UserCreate, UserOut

router = APIRouter(prefix='/api/auth', tags=['auth'])


@router.post('/login', response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Incorrect email or password')
    token = create_access_token(subject=user.email, role=user.role)
    return Token(access_token=token, role=user.role, email=user.email)


@router.get('/me', response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post('/users', response_model=UserOut, dependencies=[Depends(require_min_role('Admin'))])
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail='User already exists')
    user = User(email=payload.email, hashed_password=get_password_hash(payload.password), role=payload.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
