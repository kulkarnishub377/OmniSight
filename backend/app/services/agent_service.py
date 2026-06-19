from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models import AgentRun, Event, Incident, IncidentEvent
from app.services.audit_service import audit
from app.services.search_service import search_service
from app.services.serde import dumps, loads


class AgentService:
    workflow_version = '1.0'

    def run_investigation(self, db: Session, incident_id: str, actor: str = 'system') -> AgentRun:
        incident = db.query(Incident).filter(Incident.incident_id == incident_id).first()
        if not incident:
            raise ValueError(f'Incident not found: {incident_id}')

        related_event_ids = [rel.event_id for rel in incident.events]
        events = db.query(Event).filter(Event.event_id.in_(related_event_ids)).all() if related_event_ids else []
        event_context = [self._event_context(event) for event in events]
        query = self._build_query(incident, event_context)
        docs = search_service.search(db, query=query, tenant_id=incident.tenant_id, top_k=5)

        trace: list[dict[str, Any]] = []
        trace.append(self._trace('Observer', 'Incident accepted for investigation', {'incident_id': incident_id}))
        trace.append(self._trace('Retriever', 'Fetched events and semantic evidence', {'event_count': len(events), 'document_hits': len(docs)}))

        hypotheses = self._generate_hypotheses(incident, event_context, docs)
        trace.append(self._trace('Investigator', 'Generated root-cause hypotheses', {'hypothesis_count': len(hypotheses)}))

        plan = self._plan_actions(incident, hypotheses)
        trace.append(self._trace('Planner', 'Created recommended action plan', {'action_count': len(plan['recommended_actions'])}))

        guard = self._guard(plan, docs, event_context)
        trace.append(self._trace('SafetyGuard', 'Validated action plan against autonomy policy', guard))

        summary = self._summary(incident, hypotheses, plan, guard, docs)
        output = {
            'incident_id': incident_id,
            'summary': summary,
            'hypotheses': hypotheses,
            'risk_score': plan['risk_score'],
            'recommended_actions': plan['recommended_actions'],
            'guard_decision': guard,
            'evidence': docs,
        }

        run = AgentRun(
            incident_id=incident_id,
            workflow_version=self.workflow_version,
            status='completed',
            input_json=dumps({'incident': incident.title, 'events': event_context, 'query': query}),
            output_json=dumps(output),
            trace_json=dumps(trace),
        )
        db.add(run)

        incident.summary = summary
        incident.risk_score = plan['risk_score']
        incident.updated_at = datetime.now(timezone.utc)
        audit(db, actor=actor, action='agent.investigation_completed', target_type='incident', target_id=incident_id, metadata={'workflow_version': self.workflow_version})
        db.commit()
        db.refresh(run)
        return run

    def _event_context(self, event: Event) -> dict[str, Any]:
        return {
            'event_id': event.event_id,
            'event_type': event.event_type,
            'severity': event.severity,
            'source_id': event.source_id,
            'source_type': event.source_type,
            'timestamp': event.timestamp.isoformat(),
            'location': loads(event.location_json, {}),
            'payload': loads(event.payload_json, {}),
        }

    def _build_query(self, incident: Incident, events: list[dict[str, Any]]) -> str:
        tokens = [incident.title]
        for event in events:
            tokens.append(event.get('event_type', ''))
            tokens.extend(str(v) for v in event.get('payload', {}).values() if isinstance(v, (str, int, float)))
            tokens.extend(str(v) for v in event.get('location', {}).values() if isinstance(v, str))
        return ' '.join(tokens)

    def _generate_hypotheses(self, incident: Incident, events: list[dict[str, Any]], docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        event_types = {e['event_type'] for e in events}
        doc_evidence = [f"{h['metadata'].get('file_name', 'document')} chunk {h['metadata'].get('chunk_index', '?')}" for h in docs[:3]]
        hypotheses: list[dict[str, Any]] = []
        if {'forklift_detected', 'temperature_anomaly'} & event_types or 'Forklift' in incident.title:
            hypotheses.append({
                'claim': 'Operational risk increased because restricted-zone vehicle activity coincided with equipment overheating.',
                'confidence': 0.82,
                'supporting_evidence': ['Correlated camera and sensor events within the rule window'] + doc_evidence,
            })
        if any('temperature' in e['event_type'] for e in events):
            hypotheses.append({
                'claim': 'The affected machine may require coolant, airflow, or load inspection before continued operation.',
                'confidence': 0.74,
                'supporting_evidence': ['Temperature exceeded configured threshold'] + doc_evidence,
            })
        if not hypotheses:
            hypotheses.append({
                'claim': 'The incident requires manual review because evidence is insufficient for a specific automated root cause.',
                'confidence': 0.45,
                'supporting_evidence': ['No high-confidence causal pattern found'],
            })
        return hypotheses

    def _plan_actions(self, incident: Incident, hypotheses: list[dict[str, Any]]) -> dict[str, Any]:
        base_risk = 0.55
        if incident.severity == 'high':
            base_risk = 0.86
        elif incident.severity == 'critical':
            base_risk = 0.94
        recommended_actions = [
            {'action': 'Notify floor supervisor', 'priority': 'immediate', 'requires_approval': False},
            {'action': 'Create maintenance/safety ticket', 'priority': 'high', 'requires_approval': False},
            {'action': 'Review related camera and sensor evidence', 'priority': 'high', 'requires_approval': False},
            {'action': 'Recommend temporary restriction of affected zone', 'priority': 'medium', 'requires_approval': True},
        ]
        return {'risk_score': round(base_risk, 2), 'recommended_actions': recommended_actions}

    def _guard(self, plan: dict[str, Any], docs: list[dict[str, Any]], events: list[dict[str, Any]]) -> dict[str, Any]:
        approved = []
        blocked = []
        for action in plan['recommended_actions']:
            if action.get('requires_approval'):
                blocked.append({'action': action['action'], 'reason': 'Human approval required for operational restrictions or physical-control decisions.'})
            else:
                approved.append(action['action'])
        return {
            'allowed': True,
            'requires_human_approval': bool(blocked),
            'approved_actions': approved,
            'blocked_actions': blocked,
            'evidence_check': 'passed' if events else 'limited',
            'citation_coverage': min(1.0, len(docs) / 3),
        }

    def _summary(self, incident: Incident, hypotheses: list[dict[str, Any]], plan: dict[str, Any], guard: dict[str, Any], docs: list[dict[str, Any]]) -> str:
        top_hypothesis = hypotheses[0]['claim'] if hypotheses else 'No hypothesis generated.'
        doc_line = 'No supporting documents were retrieved.'
        if docs:
            cited = ', '.join(f"{d['metadata'].get('file_name', 'doc')}#{d['metadata'].get('chunk_index', '?')}" for d in docs[:3])
            doc_line = f'Retrieved evidence: {cited}.'
        approval = 'Some actions require human approval.' if guard['requires_human_approval'] else 'All proposed actions are within automated policy.'
        return f"{incident.title}. Risk score {plan['risk_score']}. Primary hypothesis: {top_hypothesis} {doc_line} {approval}"

    def _trace(self, node: str, message: str, metadata: dict[str, Any]) -> dict[str, Any]:
        return {'node': node, 'message': message, 'metadata': metadata, 'timestamp': datetime.now(timezone.utc).isoformat()}


agent_service = AgentService()
