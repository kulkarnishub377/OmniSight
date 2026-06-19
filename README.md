# AMIF v1.0 — Autonomous Multi-Modal Incident Intelligence Fabric

A production-style, solo-buildable AI architecture project for real-time incident intelligence.

AMIF ingests camera, sensor, document, and manual events; validates/deduplicates/enriches them; correlates incidents; retrieves relevant evidence from semantic memory; runs an agentic investigation workflow; applies safety guardrails; and exposes an operator dashboard.

## What is included

- FastAPI backend/API gateway
- JWT authentication and RBAC
- Canonical AMIF event schema
- Event ingestion API
- Vision, audio, sensor, document, notification, user, action, audit, and knowledge-graph APIs
- In-process event processing pipeline with Redpanda-ready topic contracts
- Deduplication, enrichment, anomaly generation, and incident correlation
- PostgreSQL durable memory
- Redis-ready episodic-memory design
- Qdrant-ready semantic-memory interface with Postgres fallback
- Neo4j-style knowledge graph endpoint
- Document upload, chunking, and retrieval
- Deterministic agent runtime: Observer, Retriever, Investigator, Planner, Safety Guard, Action Executor
- Alerts, acknowledgements, audit logs
- Advanced animated vanilla-JS operator console and architecture page served by FastAPI
- Docker Compose with Postgres, Redis, Qdrant, Redpanda, Prometheus, Grafana
- Kubernetes starter manifests
- Demo seed route and script

## Quick start with Docker

```bash
cd amif
cp .env.example .env
docker compose up --build
```

Open:

```text
http://localhost:8000
```

Architecture page:

```text
http://localhost:8000/architecture.html
```

Observability:

```text
Prometheus: http://localhost:9090
Grafana:    http://localhost:3000  admin/admin
```

Default login:

```text
email: admin@example.com
password: admin123
```

## Quick start without Docker

```bash
cd amif/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open `http://localhost:8000`.

## Demo flow

1. Login with the default admin user.
2. Click **Seed Demo**.
3. AMIF uploads a safety manual, emits a forklift restricted-zone event, emits an overheating sensor event, correlates them into an incident, runs the investigation agent, and creates an alert.
4. View events, incidents, evidence-backed summary, agent run, and alerts.

## Core architecture loop

```text
Detect → Normalize → Correlate → Retrieve → Reason → Guard → Alert → Explain
```

## API docs

```text
http://localhost:8000/docs
```

## Important environment variables

See `.env.example`.

## Project structure

```text
backend/app
  core/       config, auth, RBAC, logging
  db/         SQLAlchemy setup
  models/     database models
  schemas/    Pydantic contracts
  services/   event, processor, search, document, agent, action
  routers/    REST API routers
  static/     dashboard
infra/
  k8s/        Kubernetes starter manifests
  prometheus/ Prometheus config
scripts/      demo seed client
docs/         architecture docs
```
