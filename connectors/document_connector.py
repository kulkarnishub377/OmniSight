"""Document connector stub.

Use `/api/documents/upload` for runtime ingestion. This file documents the
metadata contract for manual/SOP ingestion.
"""

def document_metadata(file_name: str, asset_id: str | None = None) -> dict:
    return {
        'file_name': file_name,
        'document_type': 'manual',
        'asset_id': asset_id,
        'tenant_id': 'demo_tenant',
    }
