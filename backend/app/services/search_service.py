import hashlib
import math
import re
from collections import Counter
from typing import Any

from sqlalchemy.orm import Session

from app.models import DocumentChunk
from app.services.serde import dumps, loads

TOKEN_RE = re.compile(r"[a-zA-Z0-9_]+")


def tokenize(text: str) -> list[str]:
    return [t.lower() for t in TOKEN_RE.findall(text or '')]


def embed_text(text: str, dims: int = 64) -> list[float]:
    vector = [0.0] * dims
    for token in tokenize(text):
        digest = hashlib.sha256(token.encode('utf-8')).digest()
        idx = int.from_bytes(digest[:2], 'big') % dims
        sign = 1.0 if digest[2] % 2 == 0 else -1.0
        vector[idx] += sign
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    return sum(x * y for x, y in zip(a, b))


def keyword_overlap(query: str, text: str) -> float:
    q = Counter(tokenize(query))
    t = Counter(tokenize(text))
    if not q or not t:
        return 0.0
    overlap = sum(min(q[k], t[k]) for k in q)
    return overlap / max(1, sum(q.values()))


class SearchService:
    """Semantic-memory interface.

    The current implementation is deterministic and offline-friendly. It stores a
    compact hashing-vector in Postgres and performs local cosine + keyword scoring.
    The service boundary is intentionally compatible with swapping in Qdrant.
    """

    def index_chunk_embedding(self, chunk: DocumentChunk) -> None:
        chunk.embedding_json = dumps(embed_text(chunk.content))

    def search(
        self,
        db: Session,
        query: str,
        tenant_id: str = 'demo_tenant',
        top_k: int = 5,
        asset_id: str | None = None,
    ) -> list[dict[str, Any]]:
        query_vector = embed_text(query)
        rows = db.query(DocumentChunk).filter(DocumentChunk.tenant_id == tenant_id).all()
        hits: list[dict[str, Any]] = []
        for row in rows:
            metadata = loads(row.metadata_json, {})
            if asset_id and metadata.get('asset_id') not in (asset_id, None, ''):
                continue
            vector = loads(row.embedding_json, [])
            semantic_score = cosine(query_vector, vector)
            lexical_score = keyword_overlap(query, row.content)
            score = 0.65 * semantic_score + 0.35 * lexical_score
            hits.append({
                'chunk_id': row.chunk_id,
                'document_id': row.document_id,
                'score': round(float(score), 4),
                'text': row.content,
                'metadata': metadata,
            })
        hits.sort(key=lambda item: item['score'], reverse=True)
        return hits[:top_k]


search_service = SearchService()
