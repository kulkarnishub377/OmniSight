# AMIF Senior Architecture Blueprint

This blueprint maps the implementation to the architecture diagram supplied by the user.

## 1. Data Sources

- Vision: CCTV/IP cameras, RTSP streams, image/video uploads
- Audio: microphones, audio files, live streams
- Documents: PDF/DOCX/TXT, OCR documents, manuals
- Sensors/IoT: temperature, vibration, energy meters, PLC/SCADA
- Enterprise systems: ERP/SAP, CMMS, CRM
- Other: webhooks, CSV/Excel, emails

## 2. Ingestion Layer

Implemented as connectors plus API endpoints:

- `connectors/camera_connector.py`
- `connectors/audio_connector.py`
- `connectors/iot_connector.py`
- `connectors/document_connector.py`
- `connectors/email_connector.py`
- `/api/events`
- `/api/vision/mock-detect`
- `/api/audio/mock-transcribe`
- `/api/sensors/temperature`
- `/api/documents/upload`

## 3. Event Bus

Topic contracts:

```text
raw.events
validated.events
enriched.events
incident.events
alert.events
agent.tasks
agent.results
audit.events
dead_letter.events
```

The MVP has Redpanda in Docker Compose and in-process processing. The next extraction step is a FastStream worker consuming `raw.events`.

## 4. Event Processing Layer

Implemented responsibilities:

- validation through Pydantic schemas
- idempotency through source sequence/event IDs
- enrichment through payload/location metadata
- correlation with 10-minute time window
- anomaly generation for temperature thresholds
- incident and alert generation

## 5. Memory Fabric

- PostgreSQL: durable operational state
- Redis: included in infra for episodic memory expansion
- Qdrant: included in infra; current MVP uses a local deterministic semantic fallback for no-network demos
- Neo4j: represented by `/api/knowledge/graph`; can be swapped for physical Neo4j later

## 6. Agent Runtime

Implemented deterministic agent graph:

```text
Observer -> Retriever -> Investigator -> Planner -> SafetyGuard -> ActionExecutor
```

Stored artifacts:

- agent input
- retrieved evidence
- hypotheses
- recommended actions
- guard decision
- trace
- final summary

## 7. Action Engine

Implemented action stubs:

- dashboard notification
- ticket creation stub
- alert acknowledgement
- notification service endpoint

Production integrations can be added for Jira, ServiceNow, Slack, Teams, SAP, email, and webhooks.

## 8. External Integrations

Integration seams are represented by the Action Engine and connector folder.

## 9. Observability

- `/health`
- `/metrics`
- Prometheus config
- structured audit logs
- system stats endpoint

## 10. Security

- JWT auth
- RBAC roles: Admin, Operator, Analyst, Viewer, ServiceAccount
- audit logs
- password hashing
- CORS controls

## 11. Deployment

- Docker Compose for local platform
- Kubernetes namespace/deployment/service/HPA starter manifests
- Redpanda, Postgres, Redis, Qdrant in Compose
