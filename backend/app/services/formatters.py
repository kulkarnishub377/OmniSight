from app.models import AgentRun, Alert, Document, Event, Incident
from app.services.serde import loads


def event_to_dict(event: Event) -> dict:
    return {
        'event_id': event.event_id,
        'schema_version': event.schema_version,
        'tenant_id': event.tenant_id,
        'source_id': event.source_id,
        'source_type': event.source_type,
        'source_sequence': event.source_sequence,
        'event_type': event.event_type,
        'severity': event.severity,
        'timestamp': event.timestamp,
        'location': loads(event.location_json, {}),
        'payload': loads(event.payload_json, {}),
        'trace': loads(event.trace_json, {}),
        'status': event.status,
        'created_at': event.created_at,
    }


def incident_to_dict(incident: Incident) -> dict:
    return {
        'incident_id': incident.incident_id,
        'tenant_id': incident.tenant_id,
        'title': incident.title,
        'severity': incident.severity,
        'status': incident.status,
        'risk_score': incident.risk_score,
        'summary': incident.summary,
        'risk_indicators': loads(incident.risk_indicators_json, []),
        'related_events': [rel.event_id for rel in incident.events],
        'created_at': incident.created_at,
        'updated_at': incident.updated_at,
    }


def alert_to_dict(alert: Alert) -> dict:
    return {
        'alert_id': alert.alert_id,
        'tenant_id': alert.tenant_id,
        'incident_id': alert.incident_id,
        'severity': alert.severity,
        'status': alert.status,
        'message': alert.message,
        'created_at': alert.created_at,
        'acknowledged_at': alert.acknowledged_at,
        'acknowledged_by': alert.acknowledged_by,
    }


def document_to_dict(document: Document) -> dict:
    return {
        'document_id': document.document_id,
        'tenant_id': document.tenant_id,
        'file_name': document.file_name,
        'document_type': document.document_type,
        'asset_id': document.asset_id,
        'chunk_count': len(document.chunks),
        'created_at': document.created_at,
    }


def agent_run_to_dict(run: AgentRun) -> dict:
    return {
        'run_id': run.run_id,
        'incident_id': run.incident_id,
        'workflow_version': run.workflow_version,
        'status': run.status,
        'input': loads(run.input_json, {}),
        'output': loads(run.output_json, {}),
        'trace': loads(run.trace_json, []),
        'created_at': run.created_at,
    }


def action_to_dict(action) -> dict:
    return {
        'action_id': action.action_id,
        'incident_id': action.incident_id,
        'action_type': action.action_type,
        'status': action.status,
        'payload': loads(action.payload_json, {}),
        'created_at': action.created_at,
    }


def audit_to_dict(log) -> dict:
    return {
        'audit_id': log.audit_id,
        'tenant_id': log.tenant_id,
        'actor': log.actor,
        'action': log.action,
        'target_type': log.target_type,
        'target_id': log.target_id,
        'metadata': loads(log.metadata_json, {}),
        'created_at': log.created_at,
    }
