import re
from typing import BinaryIO

from sqlalchemy.orm import Session

from app.models import Document, DocumentChunk
from app.services.audit_service import audit
from app.services.search_service import search_service
from app.services.serde import dumps


def clean_text(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


def chunk_text(text: str, max_words: int = 130, overlap: int = 25) -> list[str]:
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(len(words), start + max_words)
        chunks.append(' '.join(words[start:end]))
        if end == len(words):
            break
        start = max(0, end - overlap)
    return chunks


class DocumentService:
    def decode_upload(self, file: BinaryIO) -> str:
        raw = file.read()
        # This MVP keeps PDF handling dependency-light. Text PDFs often expose
        # readable bytes; scanned PDFs should be processed by OCR in v1.5.
        for encoding in ('utf-8', 'latin-1'):
            try:
                text = raw.decode(encoding, errors='ignore')
                return clean_text(text)
            except Exception:
                continue
        return ''

    def create_document(
        self,
        db: Session,
        file_name: str,
        text: str,
        actor: str,
        document_type: str = 'manual',
        asset_id: str | None = None,
        tenant_id: str = 'demo_tenant',
    ) -> Document:
        text = clean_text(text)
        document = Document(
            tenant_id=tenant_id,
            file_name=file_name,
            document_type=document_type,
            asset_id=asset_id,
            text=text,
        )
        db.add(document)
        db.flush()

        for idx, content in enumerate(chunk_text(text)):
            chunk = DocumentChunk(
                tenant_id=tenant_id,
                document_id=document.document_id,
                content=content,
                metadata_json=dumps({
                    'file_name': file_name,
                    'chunk_index': idx,
                    'asset_id': asset_id,
                    'document_type': document_type,
                }),
            )
            search_service.index_chunk_embedding(chunk)
            db.add(chunk)
        audit(db, actor=actor, action='document.uploaded', target_type='document', target_id=document.document_id, tenant_id=tenant_id)
        db.commit()
        db.refresh(document)
        return document


document_service = DocumentService()
