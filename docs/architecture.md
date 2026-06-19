# AMIF Architecture

## Mission

AMIF is an event-driven, multi-modal incident intelligence platform. It converts operational signals into evidence-backed incident investigations and safe action recommendations.

## Senior-level design principles

1. **Event contracts over direct coupling** — services communicate through canonical event schemas.
2. **At-least-once processing with idempotency** — every business effect uses a deterministic key.
3. **Polyglot memory fabric** — Postgres for source-of-truth state, Redis for episodic context, Qdrant for semantic memory.
4. **Agentic reasoning is auditable** — agent inputs, retrieved evidence, trace, guard decision, and outputs are stored.
5. **Guarded autonomy** — administrative actions can run automatically; operational restrictions and physical control require approval.

## Runtime flow

```text
Camera/Sensor/Document
  -> Event Service
  -> Canonical AMIFEvent
  -> Processing Layer
  -> Correlation Rule
  -> Incident + Alert
  -> Retriever
  -> Investigator
  -> Planner
  -> Safety Guard
  -> Action Stub + Dashboard
```

## Current MVP implementation

The MVP uses one FastAPI deployment with modular service boundaries. This keeps the system easy to run while preserving architectural seams for later extraction into microservices.

Implemented modules:

- API Gateway/Auth/RBAC
- Event Service
- Event Processor
- Document Service
- Search Service
- Agent Service
- Action Service
- Dashboard

## Redpanda-ready topics

```text
raw.events
processed.events
incident.events
alert.events
agent.tasks
agent.results
action.commands
action.results
dead_letter.events
audit.events
```

The code uses synchronous in-process execution for MVP simplicity. The `EventService` and `EventProcessor` interfaces are designed so FastStream consumers can replace the direct call later.

## Correlation rule in MVP

```text
IF forklift_detected in restricted_zone
AND temperature_anomaly exists within 10 minutes
THEN create high-severity incident
```

## Agent workflow

```text
Observer -> Retriever -> Investigator -> Planner -> SafetyGuard -> ActionExecutor
```
