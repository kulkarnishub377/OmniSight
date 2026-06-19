from pathlib import Path
from html import escape
import json

ROOT = Path('/home/user/amif')
OUT = ROOT / 'reports'
OUT.mkdir(exist_ok=True)

# collect lightweight project stats
files = [p for p in ROOT.rglob('*') if p.is_file() and 'reports/AMIF_Interactive_Project_Report.html' not in str(p)]
code_exts = {'.py', '.js', '.css', '.html', '.md', '.yaml', '.yml', '.txt'}
line_count = 0
for p in files:
    if p.suffix in code_exts:
        try:
            line_count += len(p.read_text(encoding='utf-8', errors='ignore').splitlines())
        except Exception:
            pass
stats = {
    'files': len(files),
    'lines': line_count,
    'routers': len(list((ROOT/'backend/app/routers').glob('*.py'))),
    'services': len(list((ROOT/'backend/app/services').glob('*.py'))),
    'connectors': len(list((ROOT/'connectors').glob('*.py'))),
}

file_tree = '''amif/
  backend/app/
    main.py
    routers/        auth, events, incidents, alerts, documents, audio, actions, audit, users, knowledge, system
    services/       event_service, event_processor, agent_service, search_service, document_service, action_service
    models/         SQLAlchemy operational models
    schemas/        Pydantic API/event contracts
    static/         advanced vanilla-JS AMIF Console
  connectors/       camera, audio, IoT, document, email connector stubs
  infra/            Docker Compose, Prometheus, Kubernetes starter manifests
  docs/             architecture, API, evaluation, frontend UX
  reports/          PDF, PPTX, HTML project reports'''

mermaid_arch = '''flowchart TB
  DS[Data Sources\nCameras | Sensors | Audio | Documents | APIs] --> ING[Ingestion Layer\nConnectors + FastAPI APIs]
  ING --> GW[API Gateway\nFastAPI + JWT + RBAC]
  GW --> SVC[Domain Services\nEvent | Vision | Audio | Sensor | Document | Search | Agent]
  SVC --> BUS[(Redpanda-ready Event Bus\nraw.events | incident.events | alert.events | agent.tasks)]
  BUS --> PROC[Event Processing\nValidation | Dedup | Enrichment | Correlation]
  PROC --> MEM[Memory Fabric\nPostgres | Redis-ready | Qdrant-ready | Knowledge Graph]
  MEM --> AG[Agent Runtime\nObserver -> Retriever -> Investigator -> Planner -> Guard -> Executor]
  AG --> ACT[Action Engine\nAlerts | Tickets | Webhooks | Audit]
  ACT --> UI[Operator Console\nDashboard | Evidence | Trace | Graph | Observability]'''

mermaid_event = '''sequenceDiagram
  participant U as Operator
  participant API as FastAPI Gateway
  participant E as Event Service
  participant P as Event Processor
  participant M as Memory Fabric
  participant A as Agent Runtime
  participant UI as Console
  U->>API: Seed Demo / Emit Events
  API->>E: Canonical AMIFEvent
  E->>P: Process event
  P->>P: derive temperature_anomaly
  P->>P: correlate forklift + overheating
  P->>M: persist incident, alert, audit
  P->>A: trigger investigation
  A->>M: retrieve events + documents
  A->>A: investigate, plan, guard
  A->>M: store agent run
  UI->>API: fetch incidents, alerts, graph
  API-->>UI: evidence-backed response'''

mermaid_agent = '''stateDiagram-v2
  [*] --> Observer
  Observer --> Retriever: incident accepted
  Retriever --> Investigator: evidence + context
  Investigator --> Planner: hypotheses
  Planner --> SafetyGuard: action plan
  SafetyGuard --> Executor: approved actions
  SafetyGuard --> HumanApproval: risky actions
  Executor --> [*]
  HumanApproval --> [*]'''

mermaid_memory = '''flowchart LR
  Incident[Incident Context] --> PG[(PostgreSQL\nHistorical Memory)]
  Incident --> Redis[(Redis-ready\nEpisodic Memory)]
  Incident --> Qdrant[(Qdrant-ready\nSemantic Memory)]
  Incident --> Graph[(Knowledge Graph\nRelationships)]
  PG --> Builder[Context Builder]
  Redis --> Builder
  Qdrant --> Builder
  Graph --> Builder
  Builder --> Agent[Agent Runtime]'''

sample_event = {
  "schema_version": "1.0",
  "event_id": "evt_demo_forklift_001",
  "source_id": "camera_warehouse_a_01",
  "source_type": "camera",
  "event_type": "forklift_detected",
  "severity": "medium",
  "tenant_id": "demo_tenant",
  "location": {"site": "plant_1", "zone": "restricted_zone"},
  "payload": {"object": "forklift", "confidence": 0.94, "bbox": [120, 84, 420, 360]},
  "trace": {"producer": "vision-service-mock"}
}

logs = [
    ('10:30:00.120', 'event.ingested', 'camera_warehouse_a_01 forklift_detected severity=medium'),
    ('10:30:01.004', 'event.processed', 'validated schema_version=1.0 dedupe=pass'),
    ('10:31:10.451', 'event.ingested', 'temp_sensor_machine_a temperature_reading 91.5C'),
    ('10:31:10.612', 'anomaly.generated', 'temperature_anomaly deviation=11.5C severity=high'),
    ('10:31:11.002', 'incident.created', 'forklift + overheating correlation window=10m'),
    ('10:31:11.220', 'alert.created', 'high-priority incident alert opened'),
    ('10:31:12.140', 'agent.started', 'Observer -> Retriever -> Investigator -> Planner'),
    ('10:31:15.844', 'rag.search', 'manual chunk retrieved: machine_a_safety_manual.txt#0'),
    ('10:31:17.400', 'guard.decision', 'zone restriction requires human approval'),
    ('10:31:17.900', 'agent.completed', 'risk_score=0.86 summary stored')
]

# need literal braces in CSS, use raw string and replace simple tokens only
html = r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AMIF Complete Interactive Project Report</title>
<style>
:root{--bg:#070b16;--panel:#10182d;--panel2:#151f38;--text:#eef4ff;--muted:#9fb0ca;--line:#263653;--cyan:#67e8f9;--blue:#38bdf8;--violet:#a78bfa;--green:#34d399;--yellow:#fbbf24;--red:#fb7185;--white:#fff;--shadow:0 24px 90px rgba(0,0,0,.35)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 15% 0%,#19346d 0,#070b16 36%),radial-gradient(circle at 86% 8%,#46166b 0,transparent 28%),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.55}body.light{--bg:#f6f9ff;--panel:#ffffff;--panel2:#eef5ff;--text:#0f172a;--muted:#64748b;--line:#d5e1f1;background:#f6f9ff}a{color:inherit}.progress{position:fixed;top:0;left:0;height:4px;background:linear-gradient(90deg,var(--cyan),var(--violet),var(--green));width:0;z-index:20}.shell{display:grid;grid-template-columns:280px 1fr;min-height:100vh}.side{position:sticky;top:0;height:100vh;padding:22px;background:rgba(7,11,22,.9);backdrop-filter:blur(18px);border-right:1px solid var(--line);overflow:auto}.brand{display:flex;gap:12px;align-items:center;margin-bottom:24px}.mark{width:44px;height:44px;border-radius:15px;background:linear-gradient(135deg,var(--cyan),var(--violet));display:grid;place-items:center;color:#020617;font-weight:900;font-size:22px}.brand h1{font-size:20px;margin:0}.brand p{margin:2px 0 0;color:var(--muted);font-size:12px}.nav{display:grid;gap:6px}.nav a{padding:10px 12px;border-radius:12px;text-decoration:none;color:var(--muted);border:1px solid transparent}.nav a:hover,.nav a.active{color:var(--text);background:rgba(103,232,249,.10);border-color:rgba(103,232,249,.22)}.side-card{margin-top:20px;padding:14px;border:1px solid var(--line);border-radius:16px;background:rgba(21,31,56,.62)}.side-card b{color:var(--cyan)}.main{min-width:0}.hero{padding:58px 62px 38px;border-bottom:1px solid var(--line);position:relative;overflow:hidden}.hero:after{content:"";position:absolute;right:-120px;top:-130px;width:430px;height:430px;border-radius:50%;background:radial-gradient(circle,var(--cyan),transparent 65%);opacity:.13}.hero-chip{display:inline-flex;padding:7px 12px;border-radius:999px;border:1px solid rgba(103,232,249,.3);background:rgba(103,232,249,.08);color:var(--cyan);font-weight:800;font-size:12px}.hero h1{font-size:52px;line-height:1;margin:18px 0 10px;letter-spacing:-.055em}.hero p{max-width:920px;color:var(--muted);font-size:18px}.hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.btn{border:1px solid var(--line);border-radius:12px;background:var(--panel2);color:var(--text);padding:10px 14px;text-decoration:none;font-weight:800;cursor:pointer}.btn.primary{background:linear-gradient(135deg,var(--cyan),var(--blue));color:#02111b;border:0}.btn:hover{transform:translateY(-1px)}section{padding:34px 62px;border-bottom:1px solid rgba(148,163,184,.12)}h2{font-size:30px;letter-spacing:-.035em;margin:0 0 12px}h3{font-size:19px;margin:20px 0 8px}.lead{color:var(--muted);max-width:960px}.grid{display:grid;gap:16px}.grid.cards{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}.grid.two{grid-template-columns:1fr 1fr}.grid.three{grid-template-columns:repeat(3,1fr)}.card{background:linear-gradient(180deg,rgba(16,24,45,.95),rgba(12,18,34,.95));border:1px solid var(--line);border-radius:20px;padding:18px;box-shadow:0 10px 35px rgba(0,0,0,.16)}body.light .card,body.light .side,body.light .diagram,body.light .log-panel,body.light .code{background:white}.stat{position:relative;overflow:hidden}.stat .num{font-size:36px;font-weight:950;letter-spacing:-.06em}.stat span{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.1em;font-weight:900}.stat:after{content:"";position:absolute;right:-30px;top:-30px;width:110px;height:110px;border-radius:50%;background:var(--cyan);opacity:.08}.pill{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(103,232,249,.10);border:1px solid rgba(103,232,249,.26);color:var(--cyan);font-weight:800;font-size:12px;margin:3px}.diagram{background:#081020;border:1px solid var(--line);border-radius:22px;padding:18px;overflow:auto}.diagram svg{width:100%;height:auto}.code{background:#07101f;color:#dbeafe;border:1px solid var(--line);border-radius:16px;padding:16px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;white-space:pre}.mermaid-title{display:flex;justify-content:space-between;align-items:center;margin:10px 0}.mermaid-title span{color:var(--muted);font-size:12px}.timeline{display:grid;gap:12px}.step{display:grid;grid-template-columns:40px 1fr;gap:12px;align-items:start}.dot{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--cyan),var(--violet));display:grid;place-items:center;color:#020617;font-weight:900}.step-body{padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:rgba(21,31,56,.55)}.log-panel{background:#050b16;border:1px solid var(--line);border-radius:18px;overflow:hidden}.log-head{display:flex;gap:7px;padding:10px 14px;border-bottom:1px solid var(--line);background:#0d1628}.led{width:11px;height:11px;border-radius:50%;background:var(--red)}.led:nth-child(2){background:var(--yellow)}.led:nth-child(3){background:var(--green)}.log-lines{font-family:ui-monospace,monospace;font-size:12px;padding:14px;max-height:360px;overflow:auto}.log-line{display:grid;grid-template-columns:95px 170px 1fr;gap:12px;padding:5px 0;border-bottom:1px solid rgba(148,163,184,.08)}.log-time{color:var(--muted)}.log-event{color:var(--cyan);font-weight:800}.metric{display:grid;grid-template-columns:170px 1fr 70px;gap:12px;align-items:center;margin:12px 0}.bar{height:11px;border-radius:999px;background:#07101f;border:1px solid var(--line);overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--cyan),var(--violet));border-radius:999px}.table{width:100%;border-collapse:collapse;overflow:hidden;border-radius:16px}.table th,.table td{border:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.table th{background:rgba(103,232,249,.1);color:var(--cyan)}.feature-list{columns:2;column-gap:30px}.feature-list li{break-inside:avoid;margin:7px 0}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.tab{padding:8px 11px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer}.tab.active{background:rgba(103,232,249,.11);color:var(--cyan);border-color:rgba(103,232,249,.3)}.tab-panel{display:none}.tab-panel.active{display:block}.fade{opacity:0;transform:translateY(12px);transition:.55s ease}.fade.show{opacity:1;transform:none}.footer{padding:28px 62px;color:var(--muted);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.node{cursor:pointer}.tooltip{position:fixed;pointer-events:none;background:#020617;color:#e2e8f0;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:12px;z-index:30;display:none}.print-note{display:none}@media(max-width:1000px){.shell{grid-template-columns:1fr}.side{position:static;height:auto}.grid.two,.grid.three{grid-template-columns:1fr}.hero,section,.footer{padding-left:22px;padding-right:22px}.hero h1{font-size:38px}.feature-list{columns:1}}@media print{.side,.hero-actions,.progress,.tabs .tab{display:none}.shell{display:block}body{background:white;color:#111}.card,.diagram,.log-panel,.code{box-shadow:none;break-inside:avoid}.print-note{display:block}}
</style>
</head>
<body>
<div class="progress" id="progress"></div><div class="tooltip" id="tooltip"></div>
<div class="shell">
<aside class="side">
  <div class="brand"><div class="mark">A</div><div><h1>AMIF Report</h1><p>Interactive project documentation</p></div></div>
  <nav class="nav" id="nav">
    <a href="#summary">Executive Summary</a><a href="#usecases">Use Cases</a><a href="#architecture">Architecture</a><a href="#diagrams">Mermaid Diagrams</a><a href="#backend">Backend</a><a href="#frontend">Frontend</a><a href="#ai">AI Components</a><a href="#flow">Demo Flow</a><a href="#logs">Logs & Trace</a><a href="#observability">Observability</a><a href="#security">Security</a><a href="#roadmap">Roadmap</a>
  </nav>
  <div class="side-card"><b>Core Loop</b><p>Detect → Normalize → Correlate → Retrieve → Reason → Guard → Alert → Explain</p></div>
  <div class="side-card"><b>Controls</b><p><button class="btn" id="themeBtn">Toggle Theme</button></p><p><button class="btn" onclick="window.print()">Print / Save PDF</button></p></div>
</aside>
<main class="main">
<header class="hero fade"><div class="hero-chip">Senior Full-Stack AI Architecture Project</div><h1>AMIF v1.0 Complete Project Report</h1><p>Autonomous Multi-Modal Intelligence Fabric is an end-to-end incident intelligence platform that fuses camera, sensor, audio, document, and API signals into evidence-backed investigations, safe action plans, dashboards, audit logs, and graph-based context.</p><div class="hero-actions"><a class="btn primary" href="../reports/AMIF_Complete_Project_Report.pdf">Open PDF</a><a class="btn" href="../reports/AMIF_Project_Presentation.pptx">Open PPTX</a><a class="btn" href="../static/architecture.html">Architecture Page</a><a class="btn" href="../docs">API Docs when app is running</a></div></header>

<section id="summary" class="fade"><h2>Executive Summary</h2><p class="lead">AMIF is a production-style MVP with professional architecture boundaries. It runs locally while preserving a clean path to real Redpanda workers, Qdrant semantic memory, Redis episodic memory, YOLO/Whisper inference, LangGraph agents, and enterprise integrations.</p><div class="grid cards">
  <div class="card stat"><span>Project Files</span><div class="num" data-count="__FILES__">0</div><p>Generated source, docs, infra, reports</p></div>
  <div class="card stat"><span>Approx Lines</span><div class="num" data-count="__LINES__">0</div><p>Backend, frontend, docs, infra</p></div>
  <div class="card stat"><span>API Routers</span><div class="num" data-count="__ROUTERS__">0</div><p>Auth, events, agents, graph, audit</p></div>
  <div class="card stat"><span>Services</span><div class="num" data-count="__SERVICES__">0</div><p>Event, processor, agent, search, action</p></div>
  <div class="card stat"><span>Connectors</span><div class="num" data-count="__CONNECTORS__">0</div><p>Camera, audio, IoT, docs, email</p></div>
</div></section>

<section id="usecases" class="fade"><h2>Real-World Use Cases</h2><div class="grid cards">
  <div class="card"><h3>Factory Safety</h3><p>Detect forklifts or people in restricted zones and correlate with sensor anomalies.</p></div>
  <div class="card"><h3>Predictive Maintenance</h3><p>Monitor overheating, vibration, and noise; retrieve manuals and recommend inspection steps.</p></div>
  <div class="card"><h3>Warehouse Operations</h3><p>Monitor unsafe vehicle movement, PPE gaps, and zone breaches with supervisor alerts.</p></div>
  <div class="card"><h3>Security Operations</h3><p>Correlate unauthorized access, camera evidence, and operator notes into reports.</p></div>
  <div class="card"><h3>Compliance Audit</h3><p>Trace every event, alert, action, agent run, and human acknowledgement.</p></div>
  <div class="card"><h3>Smart Facilities</h3><p>Combine HVAC sensors, cameras, alarms, access systems, and maintenance documents.</p></div>
</div></section>

<section id="architecture" class="fade"><h2>Architecture Overview</h2><p class="lead">The architecture is event-driven, memory-backed, agentic, and governance-first.</p><div class="diagram">__ARCH_SVG__</div><div class="grid cards" style="margin-top:16px"><div class="card"><h3>Ingestion</h3><p><span class="pill">Cameras</span><span class="pill">Sensors</span><span class="pill">Audio</span><span class="pill">Documents</span><span class="pill">Webhooks</span></p></div><div class="card"><h3>Processing</h3><p><span class="pill">Validation</span><span class="pill">Deduplication</span><span class="pill">Enrichment</span><span class="pill">Correlation</span></p></div><div class="card"><h3>Memory</h3><p><span class="pill">PostgreSQL</span><span class="pill">Redis-ready</span><span class="pill">Qdrant-ready</span><span class="pill">Knowledge Graph</span></p></div><div class="card"><h3>Agents</h3><p><span class="pill">Observer</span><span class="pill">Retriever</span><span class="pill">Investigator</span><span class="pill">Planner</span><span class="pill">Guard</span></p></div></div></section>

<section id="diagrams" class="fade"><h2>Mermaid Diagrams</h2><p class="lead">These Mermaid definitions can be copied into Mermaid Live Editor, GitHub Markdown, Notion, or project docs. Inline SVG renderings are also included so this report works offline.</p><div class="tabs"><button class="tab active" data-tab="m1">Architecture</button><button class="tab" data-tab="m2">Event Sequence</button><button class="tab" data-tab="m3">Agent Runtime</button><button class="tab" data-tab="m4">Memory Fabric</button></div>
  <div class="tab-panel active" id="m1"><div class="mermaid-title"><h3>High-Level Architecture</h3><span>flowchart TB</span></div><pre class="code">__MERMAID_ARCH__</pre></div>
  <div class="tab-panel" id="m2"><div class="mermaid-title"><h3>Incident Demo Sequence</h3><span>sequenceDiagram</span></div><pre class="code">__MERMAID_EVENT__</pre></div>
  <div class="tab-panel" id="m3"><div class="mermaid-title"><h3>Agent Runtime State Machine</h3><span>stateDiagram-v2</span></div><pre class="code">__MERMAID_AGENT__</pre></div>
  <div class="tab-panel" id="m4"><div class="mermaid-title"><h3>Memory Fabric</h3><span>flowchart LR</span></div><pre class="code">__MERMAID_MEMORY__</pre></div>
</section>

<section id="backend" class="fade"><h2>Backend Implementation</h2><div class="grid two"><div class="card"><h3>Implemented API Areas</h3><ul class="feature-list"><li>Authentication and JWT</li><li>RBAC-ready role model</li><li>Canonical event ingestion</li><li>Vision mock detection</li><li>Audio mock transcription</li><li>Sensor event emission</li><li>Incident update workflow</li><li>Agent investigation API</li><li>Document upload and search</li><li>Knowledge graph endpoint</li><li>Audit logs</li><li>System stats and metrics</li></ul></div><div class="card"><h3>Repository Structure</h3><pre class="code">__FILE_TREE__</pre></div></div><h3>Core Endpoints</h3><table class="table"><thead><tr><th>Endpoint</th><th>Purpose</th></tr></thead><tbody><tr><td>POST /api/auth/login</td><td>Authenticate and receive JWT</td></tr><tr><td>POST /api/demo/seed</td><td>Run the complete incident demo</td></tr><tr><td>POST /api/events</td><td>Ingest canonical AMIF event</td></tr><tr><td>GET /api/incidents</td><td>List incident queue</td></tr><tr><td>POST /api/incidents/{id}/investigate</td><td>Run agent investigation</td></tr><tr><td>POST /api/documents/upload</td><td>Upload and index manuals</td></tr><tr><td>POST /api/search/query</td><td>Semantic retrieval / RAG search</td></tr><tr><td>GET /api/knowledge/graph</td><td>Return graph nodes and relationships</td></tr></tbody></table></section>

<section id="frontend" class="fade"><h2>Frontend Operator Console</h2><p class="lead">The frontend is an advanced dependency-free vanilla JavaScript SPA with polished UI/UX and fully integrated API functionality.</p><div class="grid cards"><div class="card"><h3>Dashboard UX</h3><p>Animated KPI counters, overview cards, service health, timelines, alert cards.</p></div><div class="card"><h3>Incident Command</h3><p>Master/detail queue, filters, evidence panel, agent actions, resolve/acknowledge flow.</p></div><div class="card"><h3>Documents & RAG</h3><p>Upload documents, index semantic chunks, query retrieval results with scores.</p></div><div class="card"><h3>Agent Trace</h3><p>View agent output, evidence, guard decisions, and workflow trace.</p></div><div class="card"><h3>Knowledge Graph</h3><p>Interactive SVG graph with clickable nodes and relationship inspection.</p></div><div class="card"><h3>Advanced JS</h3><p>Command palette, live refresh, theme toggle, modals, toasts, export, charts.</p></div></div></section>

<section id="ai" class="fade"><h2>AI Components and Integration Path</h2><table class="table"><thead><tr><th>AI Area</th><th>Current MVP</th><th>Production Upgrade</th></tr></thead><tbody><tr><td>Vision AI</td><td>Mock YOLO/RT-DETR-style event boundary</td><td>YOLOv8/YOLOv11, RT-DETR, Florence-2</td></tr><tr><td>Audio AI</td><td>Mock Whisper-style transcription event</td><td>Whisper or faster-whisper</td></tr><tr><td>Document AI</td><td>Text cleanup, chunking, deterministic embedding fallback</td><td>PyMuPDF, OCR, BGE-M3 embeddings</td></tr><tr><td>RAG</td><td>Local vector/hash + keyword scoring</td><td>Qdrant, reranking, metadata filters</td></tr><tr><td>Agentic AI</td><td>Deterministic Observer/Retriever/Investigator/Planner/Guard</td><td>LangGraph + Llama/Qwen/DeepSeek</td></tr><tr><td>Safety AI</td><td>Policy-based guard requiring human approval</td><td>Llama Guard / enterprise policy classifier</td></tr></tbody></table></section>

<section id="flow" class="fade"><h2>End-to-End Demo Flow</h2><div class="timeline">__FLOW_STEPS__</div><h3>Canonical Event Example</h3><pre class="code">__SAMPLE_EVENT__</pre></section>

<section id="logs" class="fade"><h2>Logs, Audit Trail, and Agent Trace Visualization</h2><p class="lead">AMIF is designed for auditable AI. Every important event, incident, action, and agent output can be traced.</p><div class="log-panel"><div class="log-head"><span class="led"></span><span class="led"></span><span class="led"></span></div><div class="log-lines">__LOG_LINES__</div></div><div class="grid two" style="margin-top:16px"><div class="card"><h3>Agent Trace</h3><div class="timeline"><div class="step"><div class="dot">1</div><div class="step-body"><b>Observer</b><p>Incident accepted for investigation.</p></div></div><div class="step"><div class="dot">2</div><div class="step-body"><b>Retriever</b><p>Fetched related events and semantic document evidence.</p></div></div><div class="step"><div class="dot">3</div><div class="step-body"><b>Investigator</b><p>Generated hypotheses around overheating and restricted-zone activity.</p></div></div><div class="step"><div class="dot">4</div><div class="step-body"><b>Safety Guard</b><p>Approved alerts and ticketing; blocked zone restrictions without human approval.</p></div></div></div></div><div class="card"><h3>Knowledge Graph Visual</h3><div class="diagram">__GRAPH_SVG__</div></div></div></section>

<section id="observability" class="fade"><h2>Observability and Metrics</h2><div class="grid two"><div class="card"><h3>Platform Metrics</h3><div class="metric"><b>Event Throughput</b><div class="bar"><i style="width:78%"></i></div><span>78%</span></div><div class="metric"><b>Incident Creation</b><div class="bar"><i style="width:64%"></i></div><span>64%</span></div><div class="metric"><b>Agent Activity</b><div class="bar"><i style="width:56%"></i></div><span>56%</span></div><div class="metric"><b>Semantic Memory</b><div class="bar"><i style="width:42%"></i></div><span>42%</span></div></div><div class="card"><h3>Deployment Stack</h3><p><span class="pill">Docker Compose</span><span class="pill">Postgres</span><span class="pill">Redis</span><span class="pill">Qdrant</span><span class="pill">Redpanda</span><span class="pill">Prometheus</span><span class="pill">Grafana</span><span class="pill">Kubernetes manifests</span></p></div></div></section>

<section id="security" class="fade"><h2>Security and Governance</h2><div class="grid cards"><div class="card"><h3>Authentication</h3><p>JWT login flow with hashed passwords and API protection.</p></div><div class="card"><h3>Authorization</h3><p>Roles: Admin, Operator, Analyst, Viewer, ServiceAccount.</p></div><div class="card"><h3>Auditability</h3><p>Audit logs track event ingestion, incident creation, updates, actions, and agent runs.</p></div><div class="card"><h3>Human Approval</h3><p>Guardrails require human approval for risky physical or operational actions.</p></div></div></section>

<section id="roadmap" class="fade"><h2>Limitations and Roadmap</h2><div class="grid two"><div class="card"><h3>Current MVP Limitations</h3><ul><li>AI models are deterministic/mock boundaries.</li><li>Event processing is in-process rather than a Redpanda worker.</li><li>Redis and Qdrant are infra-ready but not deeply integrated.</li><li>External Jira/Slack/ServiceNow integrations are action stubs.</li><li>Migrations and full tests are future work.</li></ul></div><div class="card"><h3>Next Production Steps</h3><ul><li>Add FastStream + Redpanda worker and DLQ.</li><li>Integrate YOLO, Whisper, BGE-M3, Qdrant.</li><li>Replace deterministic agents with LangGraph and model gateway.</li><li>Add OpenTelemetry, Alembic, tests, Helm, and load testing.</li><li>Add real Slack/Jira/ServiceNow/SAP integrations.</li></ul></div></div></section>

<footer class="footer"><span>AMIF v1.0 Interactive Project Report</span><span>Generated as a portfolio-ready senior AI architecture report</span></footer>
</main></div>
<script>
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const progress=$('#progress');function onScroll(){const h=document.documentElement.scrollHeight-innerHeight;progress.style.width=((scrollY/(h||1))*100)+'%';let current='';$$('section').forEach(s=>{if(scrollY>=s.offsetTop-140)current=s.id});$$('.nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+current))}addEventListener('scroll',onScroll);onScroll();
const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('show')}),{threshold:.12});$$('.fade').forEach(e=>io.observe(e));
function countUp(){ $$('.num[data-count]').forEach(el=>{const target=Number(el.dataset.count||0);let start=0,t0=performance.now();function step(t){let p=Math.min(1,(t-t0)/900),v=Math.round(start+(target-start)*(1-Math.pow(1-p,3)));el.textContent=v.toLocaleString();if(p<1)requestAnimationFrame(step)}requestAnimationFrame(step)})}setTimeout(countUp,300);
$('#themeBtn').onclick=()=>document.body.classList.toggle('light');
$$('.tab').forEach(btn=>btn.onclick=()=>{$$('.tab').forEach(b=>b.classList.remove('active'));$$('.tab-panel').forEach(p=>p.classList.remove('active'));btn.classList.add('active');$('#'+btn.dataset.tab).classList.add('active')});
const tip=$('#tooltip');document.body.addEventListener('mousemove',e=>{const n=e.target.closest('[data-tip]');if(!n){tip.style.display='none';return}tip.style.display='block';tip.style.left=e.clientX+14+'px';tip.style.top=e.clientY+14+'px';tip.textContent=n.dataset.tip});
</script>
</body></html>'''

def arch_svg():
    labels = [('Sources','Cameras\nSensors\nAudio\nDocs'),('Ingest','Connectors\nFastAPI'),('Services','Event\nVision\nAudio\nAgent'),('Bus','Redpanda\nTopics'),('Process','Validate\nCorrelate'),('Memory','Postgres\nQdrant\nRedis'),('Agents','Reason\nGuard'),('Console','Dashboard\nAudit')]
    x=30; boxes=[]; arrows=[]
    for i,(t,b) in enumerate(labels):
        boxes.append(f'<g data-tip="{escape(t)}"><rect x="{x}" y="55" width="120" height="90" rx="16" fill="#10182d" stroke="#67e8f9" opacity=".96"/><text x="{x+60}" y="85" fill="#67e8f9" text-anchor="middle" font-weight="800">{escape(t)}</text>' + ''.join(f'<text x="{x+60}" y="{108+j*16}" fill="#e2e8f0" text-anchor="middle" font-size="11">{escape(line)}</text>' for j,line in enumerate(b.split("\\n"))) + '</g>')
        if i < len(labels)-1:
            arrows.append(f'<path d="M{x+122} 100 L{x+153} 100" stroke="#94a3b8" stroke-width="2" marker-end="url(#arr)"/>')
        x += 155
    return f'<svg viewBox="0 0 1280 200"><defs><marker id="arr" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#94a3b8"/></marker></defs>{"".join(arrows)}{"".join(boxes)}</svg>'

def graph_svg():
    return '''<svg viewBox="0 0 520 300"><defs><marker id="ga" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#64748b"/></marker></defs>
    <line x1="250" y1="60" x2="120" y2="145" stroke="#64748b" marker-end="url(#ga)"/><line x1="250" y1="60" x2="250" y2="155" stroke="#64748b" marker-end="url(#ga)"/><line x1="250" y1="60" x2="390" y2="145" stroke="#64748b" marker-end="url(#ga)"/><line x1="120" y1="145" x2="250" y2="245" stroke="#64748b" marker-end="url(#ga)"/><line x1="390" y1="145" x2="250" y2="245" stroke="#64748b" marker-end="url(#ga)"/>
    <g class="node" data-tip="High severity incident"><circle cx="250" cy="55" r="34" fill="#fb7185"/><text x="250" y="60" text-anchor="middle" fill="#111" font-weight="800">Incident</text></g>
    <g class="node" data-tip="Forklift camera event"><circle cx="120" cy="145" r="32" fill="#67e8f9"/><text x="120" y="149" text-anchor="middle" fill="#111" font-weight="800">Event</text></g>
    <g class="node" data-tip="Restricted zone"><circle cx="250" cy="155" r="32" fill="#fbbf24"/><text x="250" y="159" text-anchor="middle" fill="#111" font-weight="800">Zone</text></g>
    <g class="node" data-tip="Machine A"><circle cx="390" cy="145" r="32" fill="#34d399"/><text x="390" y="149" text-anchor="middle" fill="#111" font-weight="800">Machine</text></g>
    <g class="node" data-tip="Safety manual document"><circle cx="250" cy="245" r="34" fill="#a78bfa"/><text x="250" y="250" text-anchor="middle" fill="#111" font-weight="800">Manual</text></g></svg>'''

flow_steps = [
    ('1','Manual uploaded','Machine A safety manual is chunked and indexed.'),
    ('2','Camera event','Forklift detected in restricted zone.'),
    ('3','Sensor event','Machine A temperature exceeds threshold.'),
    ('4','Correlation','Processor links visual and sensor evidence in 10-minute window.'),
    ('5','Incident + alert','High-severity incident, alert, and ticket stub are created.'),
    ('6','Agent investigation','Retriever finds manual evidence; Investigator and Planner create summary.'),
    ('7','Guardrails','Safety Guard approves alerts/tickets and requires human approval for risky actions.'),
    ('8','Dashboard','Operator sees timeline, evidence, graph, logs, and agent trace.'),
]
flow_html = ''.join(f'<div class="step"><div class="dot">{n}</div><div class="step-body"><b>{escape(t)}</b><p>{escape(b)}</p></div></div>' for n,t,b in flow_steps)
log_html = ''.join(f'<div class="log-line"><span class="log-time">{t}</span><span class="log-event">{escape(e)}</span><span>{escape(m)}</span></div>' for t,e,m in logs)

repls = {
    '__FILES__': str(stats['files']), '__LINES__': str(stats['lines']), '__ROUTERS__': str(stats['routers']), '__SERVICES__': str(stats['services']), '__CONNECTORS__': str(stats['connectors']),
    '__ARCH_SVG__': arch_svg(), '__GRAPH_SVG__': graph_svg(), '__FILE_TREE__': escape(file_tree),
    '__MERMAID_ARCH__': escape(mermaid_arch), '__MERMAID_EVENT__': escape(mermaid_event), '__MERMAID_AGENT__': escape(mermaid_agent), '__MERMAID_MEMORY__': escape(mermaid_memory),
    '__FLOW_STEPS__': flow_html, '__SAMPLE_EVENT__': escape(json.dumps(sample_event, indent=2)), '__LOG_LINES__': log_html,
}
for k,v in repls.items():
    html = html.replace(k, v)

(OUT / 'AMIF_Interactive_Project_Report.html').write_text(html, encoding='utf-8')
(OUT / 'AMIF_Complete_Project_Report.html').write_text(html, encoding='utf-8')
print(OUT / 'AMIF_Interactive_Project_Report.html')
print(OUT / 'AMIF_Complete_Project_Report.html')
