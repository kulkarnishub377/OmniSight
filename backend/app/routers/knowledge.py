from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_min_role
from app.db.session import get_db
from app.models import Document, Event, Incident
from app.schemas import KnowledgeGraphOut
from app.services.serde import loads

router = APIRouter(prefix='/api/knowledge', tags=['knowledge-graph'])


@router.get('/graph', response_model=KnowledgeGraphOut, dependencies=[Depends(require_min_role('Viewer'))])
def graph(db: Session = Depends(get_db), tenant_id: str = 'demo_tenant'):
    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    def add_node(node_id: str, label: str, typ: str, props: dict | None = None):
        nodes[node_id] = {'id': node_id, 'label': label, 'type': typ, 'properties': props or {}}

    incidents = db.query(Incident).filter(Incident.tenant_id == tenant_id).order_by(Incident.created_at.desc()).limit(50).all()
    for inc in incidents:
        add_node(inc.incident_id, inc.title[:50], 'Incident', {'severity': inc.severity, 'status': inc.status, 'risk_score': inc.risk_score})
        for rel in inc.events:
            event = db.query(Event).filter(Event.event_id == rel.event_id).first()
            if not event:
                continue
            payload = loads(event.payload_json, {})
            location = loads(event.location_json, {})
            add_node(event.event_id, event.event_type, 'Event', {'severity': event.severity, 'source_id': event.source_id})
            edges.append({'source': inc.incident_id, 'target': event.event_id, 'relation': 'HAS_EVIDENCE', 'properties': {}})
            machine_id = payload.get('machine_id')
            zone = location.get('zone')
            if machine_id:
                add_node(str(machine_id), str(machine_id), 'Machine', {})
                edges.append({'source': event.event_id, 'target': str(machine_id), 'relation': 'AFFECTS', 'properties': {}})
            if zone:
                add_node(str(zone), str(zone), 'Zone', {})
                edges.append({'source': event.event_id, 'target': str(zone), 'relation': 'LOCATED_IN', 'properties': {}})

    docs = db.query(Document).filter(Document.tenant_id == tenant_id).limit(50).all()
    for doc in docs:
        add_node(doc.document_id, doc.file_name, 'Document', {'document_type': doc.document_type, 'asset_id': doc.asset_id})
        if doc.asset_id:
            add_node(doc.asset_id, doc.asset_id, 'Machine', {})
            edges.append({'source': doc.document_id, 'target': doc.asset_id, 'relation': 'DESCRIBES', 'properties': {}})

    return {'nodes': list(nodes.values()), 'edges': edges}
