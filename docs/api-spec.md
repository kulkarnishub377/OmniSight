# AMIF API Spec

Interactive OpenAPI docs are served at `/docs`.

Key endpoints:

```http
POST /api/auth/login
GET  /api/auth/me
POST /api/events
GET  /api/events
POST /api/vision/mock-detect
POST /api/sensors/temperature
GET  /api/incidents
GET  /api/incidents/{incident_id}
POST /api/incidents/{incident_id}/investigate
GET  /api/incidents/{incident_id}/agent-runs
GET  /api/alerts
POST /api/alerts/{alert_id}/acknowledge
POST /api/documents/upload
GET  /api/documents
POST /api/search/query
POST /api/demo/seed
GET  /health
GET  /metrics
```
