# AMIF Frontend UX Specification

The AMIF Console is a production-style, animated vanilla-JavaScript operator cockpit served from `backend/app/static`. It intentionally uses no external CDN or frontend build system so the UI works inside the Arena preview sandbox and in Docker immediately.

## Screens

1. **Authentication**
   - Branded sign-in screen
   - JWT token storage
   - role-aware UI behavior

2. **Overview**
   - KPI cards for events, incidents, alerts, documents, agent runs
   - active incident command center
   - live alerts
   - service health map
   - event timeline

3. **Incidents**
   - filterable incident queue
   - master/detail inspection layout
   - risk indicators
   - related event evidence
   - action results
   - run investigation
   - acknowledge/resolve incident

4. **Events**
   - multimodal event emitters for vision, sensor, audio
   - custom canonical AMIF event publisher
   - Redpanda topic list
   - event explorer table

5. **Documents & RAG**
   - document upload/indexing UX
   - asset metadata support
   - semantic search interface
   - cited chunk results

6. **Agent Runtime**
   - visual workflow: Observer → Retriever → Investigator → Planner → Guard → Executor
   - incident picker
   - trace/output viewer

7. **Knowledge Graph**
   - SVG graph visualization
   - node and edge inspectors

8. **Observability**
   - KPI cards
   - metric bars
   - health/prometheus/grafana links

9. **Security & Audit**
   - RBAC matrix
   - users list
   - audit timeline

## Design System

- Dark enterprise AI cockpit theme with light-mode toggle
- Glassmorphism top bar and login
- Responsive sidebar navigation
- Animated KPI counters
- Sparkline canvas charts
- Command palette with Ctrl/⌘ K
- Live refresh toggle
- Modal detail inspectors
- Export workspace JSON action
- Interactive SVG knowledge graph
- Toast notifications
- Keyboard shortcuts
- Loading progress strip and skeleton states
- KPI cards, panels, badges, tables, timelines, graph canvas
- Dependency-free CSS and JavaScript for reliable sandbox previews

## API Integration

The frontend integrates with the existing FastAPI backend using:

- `/api/auth/login`
- `/api/system/stats`
- `/api/events`
- `/api/incidents`
- `/api/alerts`
- `/api/documents`
- `/api/search/query`
- `/api/knowledge/graph`
- `/api/actions`
- `/api/audit/logs`
- `/api/users`

## Production extraction path

The current implementation is a no-build SPA for maximum portability. It can be extracted into a Next.js application using the same UX structure:

```text
app/
  dashboard/
  incidents/
  events/
  documents/
  agents/
  graph/
  observability/
  security/
components/
  Layout.tsx
  KpiCard.tsx
  IncidentCard.tsx
  EventTable.tsx
  AgentTrace.tsx
  KnowledgeGraph.tsx
lib/
  api.ts
  auth.ts
  types.ts
```
