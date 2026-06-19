from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models import Alert, Event, Incident, IncidentEvent
from app.services.action_service import action_service
from app.services.audit_service import audit
from app.services.serde import dumps, loads


class EventProcessor:
    """Rules-based stream processor for AMIF v1.

    The service is intentionally stateless/idempotent around business keys so it
    can later be moved behind FastStream/Redpanda without changing contracts.
    """

    correlation_window_minutes = 10

    def process(self, db: Session, event: Event) -> list[Incident]:
        event.status = 'processed'
        incidents: list[Incident] = []

        if event.event_type == 'temperature_reading':
            anomaly = self._derive_temperature_anomaly(db, event)
            if anomaly:
                incidents.extend(self._correlate_forklift_temperature(db, anomaly))

        incidents.extend(self._correlate_forklift_temperature(db, event))
        db.commit()

        # Run the agent after commit so the incident and associations are visible.
        for incident in incidents:
            try:
                from app.services.agent_service import agent_service
                agent_service.run_investigation(db, incident.incident_id, actor='system')
                action_service.create_notification(db, incident.incident_id, incident.title)
                db.commit()
            except Exception as exc:
                audit(db, actor='system', action='agent.investigation_failed', target_type='incident', target_id=incident.incident_id, metadata={'error': str(exc)})
                db.commit()
        return incidents

    def _derive_temperature_anomaly(self, db: Session, event: Event) -> Event | None:
        payload = loads(event.payload_json, {})
        temp = float(payload.get('temperature_celsius', 0))
        threshold = float(payload.get('threshold_celsius', 10**9))
        if temp <= threshold:
            return None
        anomaly_id = f'{event.event_id}_anomaly'
        existing = db.query(Event).filter(Event.event_id == anomaly_id).first()
        if existing:
            return existing
        anomaly = Event(
            event_id=anomaly_id,
            schema_version=event.schema_version,
            tenant_id=event.tenant_id,
            source_id=event.source_id,
            source_type=event.source_type,
            source_sequence=None,
            event_type='temperature_anomaly',
            severity='high',
            timestamp=event.timestamp,
            location_json=event.location_json,
            payload_json=dumps({
                **payload,
                'deviation_celsius': round(temp - threshold, 2),
                'parent_event_id': event.event_id,
            }),
            trace_json=dumps({'producer': 'event_processor', 'parent_event_id': event.event_id}),
            status='processed',
        )
        db.add(anomaly)
        db.flush()
        return anomaly

    def _correlate_forklift_temperature(self, db: Session, event: Event) -> list[Incident]:
        now = event.timestamp or datetime.now(timezone.utc)
        start = now - timedelta(minutes=self.correlation_window_minutes)
        tenant_id = event.tenant_id
        candidates = db.query(Event).filter(Event.tenant_id == tenant_id, Event.timestamp >= start).order_by(Event.timestamp.desc()).limit(200).all()

        forklift_events = []
        temp_events = []
        for candidate in candidates:
            payload = loads(candidate.payload_json, {})
            location = loads(candidate.location_json, {})
            obj = str(payload.get('object', payload.get('object_name', ''))).lower()
            if candidate.event_type == 'forklift_detected' or (candidate.event_type == 'object_detected' and obj == 'forklift'):
                if 'restricted' in str(location.get('zone', '')).lower():
                    forklift_events.append(candidate)
            if candidate.event_type == 'temperature_anomaly':
                temp_events.append(candidate)

        created: list[Incident] = []
        for forklift in forklift_events[:3]:
            f_location = loads(forklift.location_json, {})
            for temp in temp_events[:3]:
                t_payload = loads(temp.payload_json, {})
                zone = f_location.get('zone', 'unknown_zone')
                machine_id = t_payload.get('machine_id', 'unknown_machine')
                bucket = int(now.timestamp() // (self.correlation_window_minutes * 60))
                dedupe_key = f'forklift_temp:{tenant_id}:{zone}:{machine_id}:{bucket}'
                existing = db.query(Incident).filter(Incident.dedupe_key == dedupe_key).first()
                if existing:
                    self._ensure_relation(db, existing, forklift.event_id)
                    self._ensure_relation(db, existing, temp.event_id)
                    continue
                incident = Incident(
                    tenant_id=tenant_id,
                    dedupe_key=dedupe_key,
                    title=f'Forklift detected in restricted zone near overheating {machine_id}',
                    severity='high',
                    status='open',
                    risk_score=0.86,
                    risk_indicators_json=dumps(['restricted_zone_violation', 'temperature_anomaly', 'multi_modal_correlation']),
                )
                db.add(incident)
                db.flush()
                self._ensure_relation(db, incident, forklift.event_id)
                self._ensure_relation(db, incident, temp.event_id)
                alert = Alert(
                    tenant_id=tenant_id,
                    incident_id=incident.incident_id,
                    severity='high',
                    status='open',
                    message=incident.title,
                )
                db.add(alert)
                action_service.create_ticket_stub(db, incident.incident_id, incident.title)
                audit(db, actor='system', action='incident.created', target_type='incident', target_id=incident.incident_id, metadata={'dedupe_key': dedupe_key}, tenant_id=tenant_id)
                created.append(incident)
        return created

    def _ensure_relation(self, db: Session, incident: Incident, event_id: str) -> None:
        exists = db.query(IncidentEvent).filter(IncidentEvent.incident_id == incident.incident_id, IncidentEvent.event_id == event_id).first()
        if not exists:
            db.add(IncidentEvent(incident_id=incident.incident_id, event_id=event_id))
            db.flush()


event_processor = EventProcessor()
