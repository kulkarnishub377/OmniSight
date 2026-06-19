from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_min_role
from app.db.session import get_db
from app.models import Document, User
from app.schemas import DocumentOut, SearchRequest, SearchResponse
from app.services.document_service import document_service
from app.services.formatters import document_to_dict
from app.services.search_service import search_service

router = APIRouter(prefix='/api', tags=['documents-search'])


@router.post('/documents/upload', response_model=DocumentOut, dependencies=[Depends(require_min_role('Analyst'))])
def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form('manual'),
    asset_id: str | None = Form(None),
    tenant_id: str = Form('demo_tenant'),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    text = document_service.decode_upload(file.file)
    doc = document_service.create_document(db, file.filename or 'upload.txt', text, actor=user.email, document_type=document_type, asset_id=asset_id, tenant_id=tenant_id)
    return document_to_dict(doc)


@router.get('/documents', response_model=list[DocumentOut], dependencies=[Depends(require_min_role('Viewer'))])
def list_documents(db: Session = Depends(get_db), tenant_id: str = 'demo_tenant'):
    docs = db.query(Document).filter(Document.tenant_id == tenant_id).order_by(Document.created_at.desc()).all()
    return [document_to_dict(doc) for doc in docs]


@router.post('/search/query', response_model=SearchResponse, dependencies=[Depends(require_min_role('Viewer'))])
def search(payload: SearchRequest, db: Session = Depends(get_db)):
    hits = search_service.search(db, query=payload.query, tenant_id=payload.tenant_id, top_k=payload.top_k, asset_id=payload.asset_id)
    return {'query': payload.query, 'hits': hits}
