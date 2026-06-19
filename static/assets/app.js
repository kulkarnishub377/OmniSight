/* AMIF Console — Advanced Vanilla JavaScript SPA
   Dependency-free, API-backed, animated operator cockpit. */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const state = {
  token: localStorage.getItem('amif_token') || '',
  email: localStorage.getItem('amif_email') || '',
  role: localStorage.getItem('amif_role') || '',
  currentView: 'overview',
  selectedIncidentId: null,
  live: false,
  liveTimer: null,
  theme: localStorage.getItem('amif_theme') || 'dark',
  density: localStorage.getItem('amif_density') || 'comfortable',
  spotlightIndex: 0,
  spotlightItems: [],
  filters: {
    global: '',
    event: '',
    incidentStatus: '',
    incidentSeverity: '',
  },
  data: {
    events: [],
    incidents: [],
    alerts: [],
    documents: [],
    stats: null,
    actions: [],
    graph: { nodes: [], edges: [] },
    audit: [],
    users: [],
  },
};

const pageTitles = {
  overview: 'Overview',
  incidents: 'Incident Command',
  events: 'Event Operations',
  documents: 'Documents & RAG',
  agents: 'Agent Runtime',
  graph: 'Knowledge Graph',
  observability: 'Observability',
  security: 'Security & Audit',
};

const serviceHealth = [
  ['API Gateway', 'Auth · RBAC · routing'],
  ['Event Service', 'ingest · validate · publish'],
  ['Vision Service', 'YOLO mock boundary'],
  ['Audio Service', 'Whisper mock boundary'],
  ['Document Service', 'chunking · embeddings'],
  ['Sensor Service', 'IoT normalization'],
  ['Agent Runtime', 'investigate · plan · guard'],
  ['Action Engine', 'alerts · tickets · notify'],
  ['Memory Fabric', 'Postgres · Qdrant-ready'],
];

const progressStrip = document.createElement('div');
progressStrip.className = 'progress-strip done';
document.body.appendChild(progressStrip);

const style = document.createElement('style');
style.textContent = `.rowish{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.detail-actions{display:flex;gap:8px;flex-wrap:wrap}.detail-head h3{font-size:24px;margin:10px 0 2px}`;
document.head.appendChild(style);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function fmtDate(value) {
  try { return new Date(value).toLocaleString(); } catch { return String(value || ''); }
}

function shortId(id) {
  return id ? `${String(id).slice(0, 8)}…${String(id).slice(-4)}` : '—';
}

function pill(value) {
  return `<span class="badge ${escapeHtml(value)}">${escapeHtml(value || 'n/a')}</span>`;
}

function jsonBlock(obj) {
  return `<pre>${escapeHtml(JSON.stringify(obj, null, 2))}</pre>`;
}

function empty(text, actionHtml = '') {
  return `<div class="empty-state"><div>${escapeHtml(text)}${actionHtml ? `<div class="empty-action">${actionHtml}</div>` : ''}</div></div>`;
}

function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<b>${type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'AMIF'}</b><div>${escapeHtml(message)}</div>`;
  $('#toastHost').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function startProgress() {
  progressStrip.classList.remove('done');
  progressStrip.style.opacity = '1';
  progressStrip.style.width = '18%';
  setTimeout(() => {
    if (!progressStrip.classList.contains('done')) progressStrip.style.width = '62%';
  }, 120);
}

function finishProgress(error = false) {
  progressStrip.style.width = '100%';
  progressStrip.style.background = error ? 'linear-gradient(90deg,var(--red),var(--orange))' : '';
  setTimeout(() => {
    progressStrip.classList.add('done');
    progressStrip.style.background = '';
  }, 220);
}

function authHeaders(json = true) {
  const headers = state.token ? { Authorization: `Bearer ${state.token}` } : {};
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function api(path, options = {}) {
  startProgress();
  try {
    const response = await fetch(path, options);
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }

    if (response.status === 401) {
      logout(false);
      throw new Error('Session expired. Please log in again.');
    }
    if (!response.ok) {
      const detail = body?.detail || body || `${response.status} ${response.statusText}`;
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    finishProgress(false);
    return body;
  } catch (error) {
    finishProgress(true);
    throw error;
  }
}

function applyTheme() {
  document.body.classList.toggle('light', state.theme === 'light');
  document.body.classList.toggle('compact', state.density === 'compact');
}

function showAppAuthed() {
  $('#authScreen').classList.toggle('hidden', Boolean(state.token));
  $('#appShell').classList.toggle('hidden', !state.token);
  $('#sidebarUser').innerHTML = state.email ? `<b>${escapeHtml(state.email)}</b><br><span>${escapeHtml(state.role)}</span>` : '';
}

async function login(email, password) {
  const body = new URLSearchParams({ username: email, password });
  const data = await api('/api/auth/login', { method: 'POST', body });
  state.token = data.access_token;
  state.email = data.email;
  state.role = data.role;
  localStorage.setItem('amif_token', state.token);
  localStorage.setItem('amif_email', state.email);
  localStorage.setItem('amif_role', state.role);
  showAppAuthed();
  toast(`Welcome ${state.email}`, 'success');
  await refreshAll({ quiet: true });
}

function logout(showToast = true) {
  state.token = '';
  state.email = '';
  state.role = '';
  clearInterval(state.liveTimer);
  state.live = false;
  localStorage.removeItem('amif_token');
  localStorage.removeItem('amif_email');
  localStorage.removeItem('amif_role');
  showAppAuthed();
  if (showToast) toast('Logged out');
}

function showSoftLoading() {
  if (state.data.stats) return;
  ['#overviewIncidents', '#overviewAlerts', '#overviewTimeline'].forEach(selector => {
    const el = $(selector);
    if (el) el.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  });
}

async function refreshAll({ quiet = false } = {}) {
  if (!state.token) return;
  showSoftLoading();
  try {
    const [events, incidents, alerts, documents, stats, actions, graph] = await Promise.all([
      api('/api/events?limit=200', { headers: authHeaders(false) }),
      api('/api/incidents', { headers: authHeaders(false) }),
      api('/api/alerts', { headers: authHeaders(false) }),
      api('/api/documents', { headers: authHeaders(false) }).catch(() => []),
      api('/api/system/stats', { headers: authHeaders(false) }),
      api('/api/actions', { headers: authHeaders(false) }).catch(() => []),
      api('/api/knowledge/graph', { headers: authHeaders(false) }).catch(() => ({ nodes: [], edges: [] })),
    ]);

    Object.assign(state.data, { events, incidents, alerts, documents, stats, actions, graph });
    await loadAdminData();
    renderCurrent();
    if (!quiet) toast('Dashboard refreshed', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function loadAdminData() {
  if (state.role !== 'Admin') {
    state.data.audit = [];
    state.data.users = [];
    return;
  }
  const [audit, users] = await Promise.all([
    api('/api/audit/logs?limit=100', { headers: authHeaders(false) }).catch(() => []),
    api('/api/users', { headers: authHeaders(false) }).catch(() => []),
  ]);
  state.data.audit = audit;
  state.data.users = users;
}

function setView(view) {
  state.currentView = view;
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $$('.view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
  $('#pageTitle').textContent = pageTitles[view] || view;
  renderCurrent();
}

function renderCurrent() {
  renderShared();
  const renderers = {
    overview: renderOverview,
    incidents: renderIncidentsPage,
    events: renderEventsPage,
    documents: renderDocumentsPage,
    agents: renderAgentsPage,
    graph: renderGraphPage,
    observability: renderObservabilityPage,
    security: renderSecurityPage,
  };
  renderers[state.currentView]?.();
}

function renderShared() {
  const stats = state.data.stats || { events: 0, incidents: 0, alerts: 0, documents: 0, agent_runs: 0 };
  const openIncidents = state.data.incidents.filter(item => item.status === 'open').length;
  const openAlerts = state.data.alerts.filter(item => item.status === 'open').length;
  const kpis = [
    ['Events', stats.events, 'normalized operational signals', 'rgba(103,232,249,.14)'],
    ['Incidents', stats.incidents, `${openIncidents} currently open`, 'rgba(251,113,133,.14)'],
    ['Alerts', stats.alerts, `${openAlerts} awaiting acknowledgement`, 'rgba(251,191,36,.14)'],
    ['Documents', stats.documents, 'semantic memory corpus', 'rgba(52,211,153,.14)'],
    ['Agent Runs', stats.agent_runs, 'auditable investigations', 'rgba(167,139,250,.16)'],
  ];
  const html = kpis.map(([label, value, sub, glow]) => `
    <div class="kpi" style="--glow:${glow}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value" data-target="${value ?? 0}">${value ?? 0}</div>
      <div class="kpi-sub">${sub}</div>
    </div>`).join('');
  ['#kpiGrid', '#observabilityKpis'].forEach(selector => {
    const el = $(selector);
    if (el) el.innerHTML = html;
  });
  animateKpis();
  renderInsights();
  drawSparklines();
}

function animateKpis() {
  $$('.kpi-value').forEach(el => {
    const target = Number(el.dataset.target || 0);
    const previous = Number(el.dataset.previous || 0);
    el.dataset.previous = target;
    if (previous === target) return;
    const start = performance.now();
    const duration = 560;
    function tick(now) {
      const ratio = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - ratio, 3);
      el.textContent = Math.round(previous + (target - previous) * eased);
      if (ratio < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
  $$('.kpi').forEach((card, index) => {
    card.style.animationDelay = `${index * 30}ms`;
    card.classList.add('fade-in-up');
  });
}

function renderInsights() {
  if (state.currentView !== 'overview') return;
  const grid = $('#kpiGrid');
  if (!grid || $('#insightGrid')) return;
  const node = document.createElement('div');
  node.id = 'insightGrid';
  node.className = 'insight-grid';
  node.innerHTML = `
    <div class="insight-card"><b>Incident Pressure</b><p>Open incidents compared with alert load.</p><div class="spark-wrap"><canvas data-spark="incidents"></canvas></div></div>
    <div class="insight-card"><b>Multimodal Coverage</b><p>Vision, audio, sensor, document event distribution.</p><div class="spark-wrap"><canvas data-spark="events"></canvas></div></div>
    <div class="insight-card"><b>Agent Throughput</b><p>Investigation and governance activity.</p><div class="spark-wrap"><canvas data-spark="agents"></canvas></div></div>`;
  grid.insertAdjacentElement('afterend', node);
}

function drawSparklines() {
  $$('canvas[data-spark]').forEach(canvas => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const stats = state.data.stats || {};
    const data = canvas.dataset.spark === 'incidents'
      ? [state.data.alerts.length, state.data.incidents.length, state.data.incidents.filter(i => i.status === 'open').length, state.data.actions.length, state.data.events.length]
      : canvas.dataset.spark === 'events'
        ? ['camera', 'iot_sensor', 'microphone', 'webhook', 'document'].map(type => state.data.events.filter(e => e.source_type === type).length + 1)
        : [1, stats.agent_runs || 0, state.data.audit.length || 1, state.data.actions.length || 1, state.data.incidents.length || 1];

    const max = Math.max(...data, 1);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#67e8f9');
    grad.addColorStop(1, '#a78bfa');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((value, index) => {
      const x = (index / (data.length - 1 || 1)) * w;
      const y = h - (value / max) * (h - 12) - 6;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(103,232,249,.08)';
    ctx.fill();
  });
}

function filteredIncidents() {
  const q = state.filters.global.toLowerCase();
  return state.data.incidents.filter(item => {
    const statusOk = !state.filters.incidentStatus || item.status === state.filters.incidentStatus;
    const severityOk = !state.filters.incidentSeverity || item.severity === state.filters.incidentSeverity;
    const searchOk = !q || JSON.stringify(item).toLowerCase().includes(q);
    return statusOk && severityOk && searchOk;
  });
}

function filteredEvents() {
  const q = `${state.filters.event} ${state.filters.global}`.trim().toLowerCase();
  return state.data.events.filter(item => !q || JSON.stringify(item).toLowerCase().includes(q));
}

function incidentCard(incident, compact = false) {
  return `<article class="item-card incident-card" data-incident-id="${escapeHtml(incident.incident_id)}">
    <div class="rowish"><span>${pill(incident.severity)} ${pill(incident.status)}</span><span class="muted mono">${shortId(incident.incident_id)}</span></div>
    <h4>${escapeHtml(incident.title)}</h4>
    <p>${escapeHtml(compact ? (incident.summary || 'Awaiting agent summary').slice(0, 150) : (incident.summary || 'No investigation summary yet.'))}</p>
    <div class="rowish"><span class="muted">Risk ${incident.risk_score ?? 'n/a'} · ${incident.related_events?.length || 0} events</span><button class="btn small secondary" data-open-incident="${escapeHtml(incident.incident_id)}">Inspect</button></div>
  </article>`;
}

function alertCard(alert) {
  const action = alert.status === 'open'
    ? `<button class="btn small primary" data-ack-alert="${escapeHtml(alert.alert_id)}">Acknowledge</button>`
    : `<span class="muted">Ack by ${escapeHtml(alert.acknowledged_by || 'operator')}</span>`;
  return `<article class="item-card">${pill(alert.severity)} ${pill(alert.status)}<h4>${escapeHtml(alert.message)}</h4><p class="mono muted">${shortId(alert.alert_id)} · ${fmtDate(alert.created_at)}</p><div>${action}</div></article>`;
}

function timelineItem(title, sub, severity = '') {
  return `<div class="timeline-item"><div class="timeline-dot"></div><div class="timeline-body">${pill(severity)}<b>${escapeHtml(title)}</b><span>${escapeHtml(sub)}</span></div></div>`;
}

function renderOverview() {
  $('#overviewIncidents').innerHTML = state.data.incidents.slice(0, 5).map(item => incidentCard(item, true)).join('') || empty('No incidents yet. Seed demo to create one.', '<button class="btn primary" data-seed-inline>Seed Demo</button>');
  $('#overviewAlerts').innerHTML = state.data.alerts.slice(0, 5).map(alertCard).join('') || empty('No alerts yet.');
  $('#overviewTimeline').innerHTML = state.data.events.slice(0, 9).map(item => timelineItem(item.event_type, `${item.source_id} · ${fmtDate(item.timestamp)}`, item.severity)).join('') || empty('No events yet.');
  $('#healthMap').innerHTML = serviceHealth.map(([name, desc]) => `<div class="health-card"><b>${name}</b><p>${desc}</p></div>`).join('');
}

function renderIncidentsPage() {
  const list = filteredIncidents();
  $('#incidentList').innerHTML = list.map(item => incidentCard(item)).join('') || empty('No matching incidents.');
  if (!state.selectedIncidentId && list[0]) state.selectedIncidentId = list[0].incident_id;
  renderIncidentDetail(state.selectedIncidentId);
}

function renderIncidentDetail(id) {
  const el = $('#incidentDetail');
  const incident = state.data.incidents.find(item => item.incident_id === id);
  if (!incident) {
    el.innerHTML = empty('Select an incident to inspect evidence, agent runs, and actions.');
    return;
  }
  const related = state.data.events.filter(event => incident.related_events?.includes(event.event_id));
  const actions = state.data.actions.filter(action => action.incident_id === incident.incident_id);
  el.innerHTML = `<div class="detail-head">
      <div>${pill(incident.severity)} ${pill(incident.status)}<h3>${escapeHtml(incident.title)}</h3><p class="mono muted">${escapeHtml(incident.incident_id)}</p></div>
    </div>
    <div class="detail-actions">
      <button class="btn primary" data-run-agent="${escapeHtml(incident.incident_id)}">Run Investigation</button>
      <button class="btn secondary" data-status="acknowledged" data-incident-status="${escapeHtml(incident.incident_id)}">Acknowledge</button>
      <button class="btn secondary" data-status="resolved" data-incident-status="${escapeHtml(incident.incident_id)}">Resolve</button>
      <button class="btn ghost" data-view-runs="${escapeHtml(incident.incident_id)}">View Agent Runs</button>
    </div>
    <div class="divider"></div>
    <h4>AI Summary</h4><p>${escapeHtml(incident.summary || 'No summary yet. Run investigation to generate evidence-backed analysis.')}</p>
    <div class="divider"></div>
    <h4>Risk Indicators</h4><div>${(incident.risk_indicators || []).map(pill).join(' ') || '<span class="muted">None</span>'}</div>
    <div class="divider"></div>
    <h4>Related Events</h4><div class="stack">${related.map(event => `<div class="item-card"><b>${escapeHtml(event.event_type)}</b><p class="muted">${escapeHtml(event.source_id)} · ${fmtDate(event.timestamp)}</p>${jsonBlock({ location: event.location, payload: event.payload })}</div>`).join('') || '<p class="muted">No related events loaded.</p>'}</div>
    <div class="divider"></div>
    <h4>Action Results</h4><div class="stack">${actions.map(action => `<div class="item-card"><b>${escapeHtml(action.action_type)}</b> ${pill(action.status)}<p class="muted">${fmtDate(action.created_at)}</p>${jsonBlock(action.payload)}</div>`).join('') || '<p class="muted">No action results.</p>'}</div>`;
}

function renderEventsPage() {
  const topics = state.data.stats?.topics || {};
  $('#topicList').innerHTML = Object.values(topics).map(topic => `<span class="topic">${escapeHtml(topic)}</span>`).join('');
  const rows = filteredEvents().map(event => `<tr data-event-id="${escapeHtml(event.event_id)}">
    <td><b>${escapeHtml(event.event_type)}</b><div class="mono muted">${shortId(event.event_id)}</div></td>
    <td>${pill(event.severity)}</td>
    <td>${escapeHtml(event.source_type)}<br><span class="muted">${escapeHtml(event.source_id)}</span></td>
    <td>${escapeHtml(event.location?.zone || event.location?.site || '—')}</td>
    <td>${fmtDate(event.timestamp)}</td>
    <td><pre>${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre></td>
  </tr>`).join('');
  $('#eventTable').innerHTML = rows || `<tr><td colspan="6">No events found.</td></tr>`;
}

function renderDocumentsPage() {
  $('#documentList').innerHTML = state.data.documents.map(doc => `<article class="item-card"><span class="badge">${escapeHtml(doc.document_type)}</span><h4>${escapeHtml(doc.file_name)}</h4><p>Asset: ${escapeHtml(doc.asset_id || 'global')} · ${doc.chunk_count} chunks</p><p class="mono muted">${shortId(doc.document_id)}</p></article>`).join('') || empty('No documents indexed yet.');
}

function renderAgentsPage() {
  $('#agentIncidentPicker').innerHTML = state.data.incidents.map(incident => `<div class="item-card"><b>${escapeHtml(incident.title)}</b><p class="muted">${shortId(incident.incident_id)} · risk ${incident.risk_score ?? 'n/a'}</p><button class="btn small primary" data-run-agent="${escapeHtml(incident.incident_id)}">Run Investigation</button> <button class="btn small secondary" data-view-runs="${escapeHtml(incident.incident_id)}">View Runs</button></div>`).join('') || empty('No incidents available.');
}

async function showAgentRuns(incidentId) {
  try {
    const runs = await api(`/api/incidents/${incidentId}/agent-runs`, { headers: authHeaders(false) });
    $('#agentTraceViewer').innerHTML = runs.map(run => `<article class="item-card"><div class="rowish"><b>Run ${shortId(run.run_id)}</b>${pill(run.status)}</div><p class="muted">${fmtDate(run.created_at)} · workflow ${escapeHtml(run.workflow_version)}</p><h4>Output</h4>${jsonBlock(run.output)}<h4>Trace</h4>${jsonBlock(run.trace)}</article>`).join('') || empty('No agent runs for this incident yet.');
    setView('agents');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function renderGraphPage() {
  const { nodes = [], edges = [] } = state.data.graph || {};
  $('#graphNodes').innerHTML = nodes.map(node => `<div class="item-card"><b>${escapeHtml(node.label)}</b> ${pill(node.type)}<p class="mono muted">${escapeHtml(node.id)}</p></div>`).join('') || empty('No graph nodes yet.');
  $('#graphEdges').innerHTML = edges.map(edge => `<div class="item-card"><b>${escapeHtml(edge.relation)}</b><p class="mono muted">${shortId(edge.source)} → ${shortId(edge.target)}</p></div>`).join('') || empty('No graph edges yet.');
  $('#graphCanvas').innerHTML = renderGraphSvg(nodes, edges);
}

function renderGraphSvg(nodes, edges) {
  if (!nodes.length) return empty('No graph data yet. Seed the demo first.');
  const w = 1100;
  const h = 540;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.36;
  const pos = {};
  nodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
    const jitter = (index % 3) * 14;
    pos[node.id] = { x: cx + Math.cos(angle) * (r + jitter), y: cy + Math.sin(angle) * (r + jitter) };
  });
  const color = type => ({ Incident: '#fb7185', Event: '#67e8f9', Machine: '#34d399', Zone: '#fbbf24', Document: '#a78bfa' }[type] || '#cbd5e1');
  const edgeSvg = edges.map(edge => {
    const a = pos[edge.source];
    const b = pos[edge.target];
    if (!a || !b) return '';
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    return `<g><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#33415f" stroke-width="1.5" marker-end="url(#arrow)"/><text class="edge-label" x="${mx}" y="${my}">${escapeHtml(edge.relation)}</text></g>`;
  }).join('');
  const nodeSvg = nodes.map((node, index) => {
    const p = pos[node.id];
    const c = color(node.type);
    return `<g data-node-id="${escapeHtml(node.id)}" class="graph-node" style="animation:fadeUp .35s ease ${index * 25}ms both"><circle cx="${p.x}" cy="${p.y}" r="20" fill="${c}" opacity=".92"/><circle cx="${p.x}" cy="${p.y}" r="34" fill="${c}" opacity=".12"/><text class="node-label" x="${p.x + 28}" y="${p.y + 4}">${escapeHtml(String(node.label).slice(0, 30))}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Knowledge graph"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#33415f"/></marker></defs>${edgeSvg}${nodeSvg}</svg>`;
}

function renderObservabilityPage() {
  const stats = state.data.stats || {};
  const values = [
    ['Event throughput', Math.min(100, (stats.events || 0) * 12), `${stats.events || 0} events`],
    ['Incident creation', Math.min(100, (stats.incidents || 0) * 30), `${stats.incidents || 0} incidents`],
    ['Alert pressure', Math.min(100, (stats.alerts || 0) * 25), `${stats.alerts || 0} alerts`],
    ['Semantic memory', Math.min(100, (stats.documents || 0) * 25), `${stats.documents || 0} docs`],
    ['Agent activity', Math.min(100, (stats.agent_runs || 0) * 20), `${stats.agent_runs || 0} runs`],
  ];
  $('#metricBars').innerHTML = values.map(([name, pct, label]) => `<div class="metric-row"><b>${name}</b><div class="bar"><span style="width:${pct}%"></span></div><span>${label}</span></div>`).join('');
}

function renderSecurityPage() {
  const roles = ['Admin', 'Operator', 'Analyst', 'Viewer'];
  const permissions = [
    ['View incidents', '✓', '✓', '✓', '✓'],
    ['Acknowledge alerts', '✓', '✓', '—', '—'],
    ['Upload documents', '✓', '✓', '✓', '—'],
    ['Trigger investigation', '✓', '✓', '✓', '—'],
    ['Manage users', '✓', '—', '—', '—'],
    ['View audit logs', '✓', '—', '—', '—'],
  ];
  $('#rbacMatrix').innerHTML = `<div class="table-wrap"><table class="rbac-table"><thead><tr><th>Permission</th>${roles.map(role => `<th>${role}</th>`).join('')}</tr></thead><tbody>${permissions.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  $('#userList').innerHTML = state.role === 'Admin'
    ? (state.data.users.map(user => `<div class="item-card"><b>${escapeHtml(user.email)}</b> ${pill(user.role)}<p class="muted">${user.is_active ? 'Active' : 'Disabled'}</p></div>`).join('') || empty('No users loaded.'))
    : empty('Admin role required to view users.');
  $('#auditLogList').innerHTML = state.role === 'Admin'
    ? (state.data.audit.map(log => timelineItem(log.action, `${log.actor} · ${log.target_type || ''} ${log.target_id || ''} · ${fmtDate(log.created_at)}`, 'audit')).join('') || empty('No audit logs.'))
    : empty('Admin role required to view audit logs.');
}

function showModal(title, bodyHtml, actionsHtml = '') {
  $('#modalHost').innerHTML = `<div class="modal-backdrop" data-close-modal><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="icon-btn" data-close-modal-btn>×</button></div><div class="modal-body">${bodyHtml}${actionsHtml ? `<div class="divider"></div><div class="detail-actions">${actionsHtml}</div>` : ''}</div></div></div>`;
}

function closeModal() {
  $('#modalHost').innerHTML = '';
}

function showEventModal(eventId) {
  const event = state.data.events.find(item => item.event_id === eventId);
  if (!event) return;
  showModal(`Event · ${event.event_type}`, `<div class="content-grid two"><div><h4>Metadata</h4>${jsonBlock({ event_id: event.event_id, source_id: event.source_id, source_type: event.source_type, severity: event.severity, timestamp: event.timestamp, status: event.status })}</div><div><h4>Location & Payload</h4>${jsonBlock({ location: event.location, payload: event.payload, trace: event.trace })}</div></div>`);
}

function showGraphNodeModal(nodeId) {
  const node = state.data.graph.nodes.find(item => item.id === nodeId);
  if (!node) return;
  const edges = state.data.graph.edges.filter(edge => edge.source === nodeId || edge.target === nodeId);
  showModal(`Graph Node · ${node.label}`, `<div class="content-grid two"><div><h4>Node</h4>${jsonBlock(node)}</div><div><h4>Connected Edges</h4>${jsonBlock(edges)}</div></div>`);
}

function confetti() {
  for (let i = 0; i < 28; i += 1) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = `${Math.random() * 100}vw`;
    el.style.background = ['#67e8f9', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'][i % 5];
    el.style.animationDelay = `${Math.random() * 0.35}s`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }
}

async function seedDemo() {
  await api('/api/demo/seed', { method: 'POST', headers: authHeaders() });
  toast('Demo scenario seeded', 'success');
  confetti();
  await refreshAll({ quiet: true });
}

async function emitVision() {
  await api('/api/vision/mock-detect', { method: 'POST', headers: authHeaders(), body: JSON.stringify({}) });
  toast('Vision event emitted', 'success');
  await refreshAll({ quiet: true });
}

async function emitTemp() {
  await api('/api/sensors/temperature', { method: 'POST', headers: authHeaders(), body: JSON.stringify({}) });
  toast('Sensor event emitted', 'success');
  await refreshAll({ quiet: true });
}

async function emitAudio() {
  await api('/api/audio/mock-transcribe', { method: 'POST', headers: authHeaders(), body: JSON.stringify({}) });
  toast('Audio event emitted', 'success');
  await refreshAll({ quiet: true });
}

async function runAgent(incidentId) {
  await api(`/api/incidents/${incidentId}/investigate`, { method: 'POST', headers: authHeaders() });
  toast('Agent investigation completed', 'success');
  await refreshAll({ quiet: true });
  await showAgentRuns(incidentId);
}

async function updateIncidentStatus(incidentId, status) {
  await api(`/api/incidents/${incidentId}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }) });
  toast(`Incident ${status}`, 'success');
  await refreshAll({ quiet: true });
}

async function acknowledgeAlert(alertId) {
  await api(`/api/alerts/${alertId}/acknowledge`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ note: 'Acknowledged from AMIF Console' }) });
  toast('Alert acknowledged', 'success');
  await refreshAll({ quiet: true });
}

async function uploadDocument() {
  const text = $('#docText').value.trim();
  const name = $('#docName').value.trim() || 'manual.txt';
  const asset = $('#docAsset').value.trim();
  if (!text) throw new Error('Document text is required');
  const form = new FormData();
  form.append('file', new File([text], name, { type: 'text/plain' }));
  form.append('document_type', 'manual');
  form.append('asset_id', asset);
  const response = await fetch('/api/documents/upload', { method: 'POST', headers: { Authorization: `Bearer ${state.token}` }, body: form });
  if (!response.ok) throw new Error(await response.text());
  toast('Document indexed into semantic memory', 'success');
  await refreshAll({ quiet: true });
}

async function ragSearch() {
  const query = $('#ragQuery').value.trim();
  if (!query) return;
  const data = await api('/api/search/query', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ query, top_k: 8 }) });
  $('#ragResults').innerHTML = data.hits.map(hit => `<article class="item-card"><div class="rowish"><b>${escapeHtml(hit.metadata?.file_name || hit.document_id)}</b><span class="badge">score ${hit.score}</span></div><p>${escapeHtml(hit.text)}</p><p class="mono muted">chunk ${escapeHtml(hit.chunk_id)} · asset ${escapeHtml(hit.metadata?.asset_id || 'global')}</p></article>`).join('') || empty('No relevant chunks found.');
}

async function publishCustomEvent(form) {
  const fd = new FormData(form);
  let payload = {};
  try { payload = JSON.parse(fd.get('payload') || '{}'); } catch { throw new Error('Payload must be valid JSON'); }
  const body = {
    source_id: fd.get('source_id'),
    source_type: fd.get('source_type'),
    event_type: fd.get('event_type'),
    severity: fd.get('severity'),
    location: { site: 'plant_1', zone: 'operator_console' },
    payload,
    trace: { producer: 'amif-console' },
  };
  await api('/api/events', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
  toast('Custom event published', 'success');
  await refreshAll({ quiet: true });
}

function exportState() {
  const payload = {
    exported_at: new Date().toISOString(),
    stats: state.data.stats,
    incidents: state.data.incidents,
    events: state.data.events,
    alerts: state.data.alerts,
    documents: state.data.documents,
    graph: state.data.graph,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `amif-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Workspace export downloaded', 'success');
}

function toggleLive() {
  state.live = !state.live;
  $('#liveBtn').textContent = state.live ? 'Live On' : 'Live Off';
  $('#liveBtn').classList.toggle('pulse-ring', state.live);
  clearInterval(state.liveTimer);
  if (state.live) {
    state.liveTimer = setInterval(() => refreshAll({ quiet: true }), 8000);
    toast('Live refresh enabled', 'success');
  } else {
    toast('Live refresh disabled');
  }
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('amif_theme', state.theme);
  applyTheme();
  toast(`${state.theme} theme enabled`);
}

function toggleDensity() {
  state.density = state.density === 'compact' ? 'comfortable' : 'compact';
  localStorage.setItem('amif_density', state.density);
  applyTheme();
  toast(`${state.density} density enabled`);
}

function buildCommands() {
  const commands = [
    { title: 'Go to Overview', hint: 'Navigation', run: () => setView('overview') },
    { title: 'Go to Incidents', hint: 'Navigation', run: () => setView('incidents') },
    { title: 'Go to Events', hint: 'Navigation', run: () => setView('events') },
    { title: 'Go to Documents & RAG', hint: 'Navigation', run: () => setView('documents') },
    { title: 'Go to Agent Runtime', hint: 'Navigation', run: () => setView('agents') },
    { title: 'Go to Knowledge Graph', hint: 'Navigation', run: () => setView('graph') },
    { title: 'Go to Observability', hint: 'Navigation', run: () => setView('observability') },
    { title: 'Go to Security & Audit', hint: 'Navigation', run: () => setView('security') },
    { title: 'Seed complete demo scenario', hint: 'Action', run: seedDemo },
    { title: 'Emit vision forklift event', hint: 'Action', run: emitVision },
    { title: 'Emit overheating sensor event', hint: 'Action', run: emitTemp },
    { title: 'Emit audio transcript event', hint: 'Action', run: emitAudio },
    { title: 'Refresh dashboard', hint: 'Action', run: refreshAll },
    { title: 'Export workspace JSON', hint: 'Action', run: exportState },
    { title: 'Toggle live refresh', hint: 'Action', run: toggleLive },
    { title: 'Toggle theme', hint: 'Action', run: toggleTheme },
    { title: 'Toggle density', hint: 'Action', run: toggleDensity },
  ];
  state.data.incidents.forEach(incident => commands.push({
    title: `Open incident: ${incident.title}`,
    hint: `Risk ${incident.risk_score ?? 'n/a'} · ${incident.status}`,
    run: () => { state.selectedIncidentId = incident.incident_id; setView('incidents'); renderIncidentDetail(incident.incident_id); },
  }));
  return commands;
}

function openSpotlight() {
  $('#spotlight').classList.remove('hidden');
  $('#spotlightInput').value = '';
  state.spotlightIndex = 0;
  renderSpotlight();
  setTimeout(() => $('#spotlightInput').focus(), 20);
}

function closeSpotlight() {
  $('#spotlight').classList.add('hidden');
}

function renderSpotlight() {
  const q = $('#spotlightInput').value.toLowerCase();
  const items = buildCommands().filter(command => !q || `${command.title} ${command.hint}`.toLowerCase().includes(q)).slice(0, 12);
  state.spotlightItems = items;
  $('#spotlightResults').innerHTML = items.map((command, index) => `<div class="spotlight-item ${index === state.spotlightIndex ? 'active' : ''}" data-command-index="${index}"><div><b>${escapeHtml(command.title)}</b><span>${escapeHtml(command.hint)}</span></div><span class="kbd">Enter</span></div>`).join('') || '<div class="spotlight-item"><span>No commands found</span></div>';
}

function runSpotlightCommand(index = state.spotlightIndex) {
  const command = state.spotlightItems?.[index];
  if (!command) return;
  closeSpotlight();
  Promise.resolve(command.run()).catch(error => toast(error.message, 'error'));
}

function setupEvents() {
  $('#loginForm').addEventListener('submit', event => {
    event.preventDefault();
    login($('#loginEmail').value, $('#loginPassword').value).catch(error => toast(error.message, 'error'));
  });
  $('#logoutBtn').addEventListener('click', () => logout());
  $('#refreshBtn').addEventListener('click', () => refreshAll());
  $('#seedDemoBtn').addEventListener('click', () => seedDemo().catch(error => toast(error.message, 'error')));
  $('#emitVision').addEventListener('click', () => emitVision().catch(error => toast(error.message, 'error')));
  $('#emitTemp').addEventListener('click', () => emitTemp().catch(error => toast(error.message, 'error')));
  $('#emitAudio').addEventListener('click', () => emitAudio().catch(error => toast(error.message, 'error')));
  $('#reloadGraphBtn').addEventListener('click', () => refreshAll({ quiet: true }).then(renderGraphPage));
  $('#docUploadForm').addEventListener('submit', event => { event.preventDefault(); uploadDocument().catch(error => toast(error.message, 'error')); });
  $('#ragForm').addEventListener('submit', event => { event.preventDefault(); ragSearch().catch(error => toast(error.message, 'error')); });
  $('#customEventForm').addEventListener('submit', event => { event.preventDefault(); publishCustomEvent(event.target).catch(error => toast(error.message, 'error')); });
  $('#commandBtn').addEventListener('click', openSpotlight);
  $('#themeBtn').addEventListener('click', toggleTheme);
  $('#liveBtn').addEventListener('click', toggleLive);
  $('#exportBtn').addEventListener('click', exportState);

  $('#nav').addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (button) setView(button.dataset.view);
  });

  document.body.addEventListener('click', event => {
    const seedInline = event.target.closest('[data-seed-inline]');
    if (seedInline) seedDemo().catch(error => toast(error.message, 'error'));

    const jump = event.target.closest('[data-jump]');
    if (jump) setView(jump.dataset.jump);

    const open = event.target.closest('[data-open-incident]');
    if (open) {
      state.selectedIncidentId = open.dataset.openIncident;
      setView('incidents');
      renderIncidentDetail(state.selectedIncidentId);
    }

    const run = event.target.closest('[data-run-agent]');
    if (run) runAgent(run.dataset.runAgent).catch(error => toast(error.message, 'error'));

    const viewRuns = event.target.closest('[data-view-runs]');
    if (viewRuns) showAgentRuns(viewRuns.dataset.viewRuns);

    const statusButton = event.target.closest('[data-incident-status]');
    if (statusButton) updateIncidentStatus(statusButton.dataset.incidentStatus, statusButton.dataset.status).catch(error => toast(error.message, 'error'));

    const ack = event.target.closest('[data-ack-alert]');
    if (ack) acknowledgeAlert(ack.dataset.ackAlert).catch(error => toast(error.message, 'error'));

    const row = event.target.closest('tr[data-event-id]');
    if (row) showEventModal(row.dataset.eventId);

    const node = event.target.closest('[data-node-id]');
    if (node) showGraphNodeModal(node.dataset.nodeId);
  });

  $('#incidentStatusFilter').addEventListener('change', event => { state.filters.incidentStatus = event.target.value; renderIncidentsPage(); });
  $('#incidentSeverityFilter').addEventListener('change', event => { state.filters.incidentSeverity = event.target.value; renderIncidentsPage(); });
  $('#clearIncidentFilters').addEventListener('click', () => {
    state.filters.incidentStatus = '';
    state.filters.incidentSeverity = '';
    $('#incidentStatusFilter').value = '';
    $('#incidentSeverityFilter').value = '';
    renderIncidentsPage();
  });
  $('#eventFilter').addEventListener('input', event => { state.filters.event = event.target.value; renderEventsPage(); });
  $('#globalSearch').addEventListener('input', event => { state.filters.global = event.target.value; renderCurrent(); });

  $('#modalHost').addEventListener('click', event => {
    if (event.target.matches('[data-close-modal], [data-close-modal-btn]')) closeModal();
  });
  $('#spotlightInput').addEventListener('input', () => { state.spotlightIndex = 0; renderSpotlight(); });
  $('#spotlightResults').addEventListener('click', event => {
    const item = event.target.closest('[data-command-index]');
    if (item) runSpotlightCommand(Number(item.dataset.commandIndex));
  });
  $('#spotlight').addEventListener('click', event => { if (event.target.id === 'spotlight') closeSpotlight(); });

  document.addEventListener('keydown', event => {
    const commandK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (commandK) { event.preventDefault(); openSpotlight(); }
    if (event.key === 'Escape') { closeSpotlight(); closeModal(); }
    if (!$('#spotlight').classList.contains('hidden')) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        state.spotlightIndex = Math.min((state.spotlightItems?.length || 1) - 1, state.spotlightIndex + 1);
        renderSpotlight();
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        state.spotlightIndex = Math.max(0, state.spotlightIndex - 1);
        renderSpotlight();
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        runSpotlightCommand();
      }
    }
  });

  window.addEventListener('resize', () => {
    if (state.currentView === 'overview') drawSparklines();
    if (state.currentView === 'graph') renderGraphPage();
  });
}

function boot() {
  applyTheme();
  setupEvents();
  showAppAuthed();
  if (state.token) refreshAll({ quiet: true });
  toast('Advanced UI loaded · Press Ctrl/⌘ K for commands');
}

boot();
