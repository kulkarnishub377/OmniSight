/* OmniSight Console — Advanced Vanilla JavaScript SPA
   Dependency-free, API-backed, animated operator cockpit with static sandbox fallback. */

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
  animations: localStorage.getItem('amif_animations') || 'on',
  apiMode: localStorage.getItem('amif_api_mode') || 'auto',
  useMocks: false,
  spotlightIndex: 0,
  spotlightItems: [],
  incidentActiveTabs: {}, // Stores active tab per incident ID
  playbooks: {}, // Stores playbook checklist state per incident ID
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

// UI Telemetry indicators
const progressStrip = document.createElement('div');
progressStrip.className = 'progress-strip done';
document.body.appendChild(progressStrip);

// String helpers
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
  el.innerHTML = `<b>${type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'OmniSight'}</b><div>${escapeHtml(message)}</div>`;
  $('#toastHost').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function startProgress() {
  progressStrip.classList.remove('done');
  progressStrip.style.opacity = '1';
  progressStrip.style.width = '18%';
  setTimeout(() => {
    if (!progressStrip.classList.contains('done')) progressStrip.style.width = '65%';
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

/* ==========================================
   STATIC PREVIEW SANDBOX (MOCK DB LAYER)
   ========================================== */

const mockDb = {
  events: [],
  incidents: [],
  alerts: [],
  documents: [],
  actions: [],
  audit: [],
  users: [],
  agentRuns: {},
};

function initMockDb() {
  const stored = localStorage.getItem('omnisight_mock_db');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      Object.assign(mockDb, parsed);
      return;
    } catch (e) {
      console.error('Failed parsing mock db, seeding defaults', e);
    }
  }
  seedMockDbDefaults();
}

function saveMockDb() {
  localStorage.setItem('omnisight_mock_db', JSON.stringify(mockDb));
}

function seedMockDbDefaults() {
  mockDb.users = [
    { email: 'admin@example.com', role: 'Admin', is_active: true },
    { email: 'operator@example.com', role: 'Operator', is_active: true },
  ];
  
  mockDb.documents = [
    { document_id: 'doc_01', file_name: 'machine_a_manual.txt', document_type: 'manual', asset_id: 'machine_a', chunk_count: 5, text: 'Machine A Safety Manual. Operating temperatures must not exceed 85°C. If temp reaches 90°C, shut off engine power and trigger quarantine protocols.' },
    { document_id: 'doc_02', file_name: 'safety_sop_zones.txt', document_type: 'manual', asset_id: 'global', chunk_count: 3, text: 'Safety SOP. Forklift operations are restricted near critical machinery zones. High-severity alerts require visual operator verification before automatic incident resolution.' },
  ];

  mockDb.events = [
    { event_id: 'ev_01', event_type: 'restricted_zone_violation', severity: 'high', source_type: 'camera', source_id: 'camera_zone_a', timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), location: { site: 'plant_1', zone: 'zone_a' }, payload: { object_detected: 'forklift', confidence: 0.94 } },
    { event_id: 'ev_02', event_type: 'temperature_anomaly', severity: 'high', source_type: 'iot_sensor', source_id: 'temp_machine_a', timestamp: new Date(Date.now() - 3600000 * 1.8).toISOString(), location: { site: 'plant_1', zone: 'zone_a' }, payload: { temperature: 92.4, threshold: 85.0 } },
    { event_id: 'ev_03', event_type: 'grinding_noise', severity: 'medium', source_type: 'microphone', source_id: 'mic_mach_a', timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(), location: { site: 'plant_1', zone: 'zone_a' }, payload: { decibels: 92, frequency: 'high_pitch' } },
    { event_id: 'ev_04', event_type: 'system_boot', severity: 'low', source_type: 'webhook', source_id: 'gateway_01', timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), location: { site: 'plant_1', zone: 'gateway' }, payload: { status: 'healthy' } },
  ];

  mockDb.incidents = [
    {
      incident_id: 'inc_01',
      title: 'Machine A Overheating & Restricted Zone Intrusion',
      severity: 'high',
      status: 'open',
      summary: 'Automated correlation window linked forklift restricted zone intrusion with a subsequent temperature spike of 92.4°C on Machine A. SOP manual citations advise immediate engine shutdown.',
      risk_score: 88,
      risk_indicators: ['restricted_zone_activity', 'temperature_spike_92C', 'abnormal_noise_signature'],
      related_events: ['ev_01', 'ev_02', 'ev_03'],
      created_at: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    }
  ];

  mockDb.alerts = [
    { alert_id: 'alt_01', incident_id: 'inc_01', severity: 'high', status: 'open', message: 'Machine A temperature exceeded critical limits (92.4°C)', created_at: new Date(Date.now() - 3600000 * 1.8).toISOString() },
  ];

  mockDb.actions = [
    { action_id: 'act_01', incident_id: 'inc_01', action_type: 'quarantine_zone', status: 'resolved', created_at: new Date(Date.now() - 3600000 * 1.7).toISOString(), payload: { output: 'Zone A gates locked, safety strobe lights activated.' } },
  ];

  mockDb.audit = [
    { audit_id: 'aud_01', action: 'incident.correlated', actor: 'OmniSight Engine', target_type: 'incident', target_id: 'inc_01', created_at: new Date(Date.now() - 3600000 * 1.8).toISOString() },
  ];
  
  mockDb.agentRuns = {
    'inc_01': [
      {
        run_id: 'run_inc_01_a',
        status: 'success',
        created_at: new Date(Date.now() - 3600000 * 1.75).toISOString(),
        workflow_version: 'v1.2.0-prod',
        output: { risk_score: 88, decision: 'raise_critical_alert', actions_triggered: ['quarantine_zone'] },
        trace: {
          observer: 'Correlated forklift intrusion & temperature spike',
          retriever: 'SOP file safety_sop_zones.txt loaded successfully',
          investigator: 'Hypothesized bearing friction due to mechanical hazard',
          planner: 'Created action ticket act_01 to lock gates',
          guard: 'Risk score verified. Operation conforms to plant safety parameters.',
        }
      }
    ]
  };

  saveMockDb();
}

// Client-side simulated endpoint routers
function handleMockApi(path, options) {
  const method = options.method || 'GET';
  
  if (path.startsWith('/api/auth/login')) {
    const params = new URLSearchParams(options.body);
    const email = params.get('username') || 'admin@example.com';
    return { access_token: 'mock_jwt_token', email, role: 'Admin' };
  }
  
  if (path.startsWith('/api/system/stats')) {
    return {
      events: mockDb.events.length,
      incidents: mockDb.incidents.length,
      alerts: mockDb.alerts.length,
      documents: mockDb.documents.length,
      agent_runs: Object.values(mockDb.agentRuns).flat().length,
      topics: ['raw.events', 'alerts.v1', 'incidents.correlated'],
    };
  }

  if (path.startsWith('/api/events')) {
    if (method === 'POST') {
      const body = JSON.parse(options.body);
      const newEvent = {
        event_id: 'ev_' + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
        ...body,
      };
      mockDb.events.unshift(newEvent);
      
      // Auto-correlate temp spikes or forklift detections into incidents
      if (newEvent.event_type === 'temperature_anomaly' || newEvent.event_type === 'restricted_zone_violation') {
        const matchingInc = mockDb.incidents.find(i => i.status === 'open');
        if (matchingInc) {
          matchingInc.related_events.push(newEvent.event_id);
          matchingInc.risk_score = Math.min(100, matchingInc.risk_score + 10);
        } else {
          const newIncId = 'inc_' + Math.random().toString(36).substr(2, 5);
          mockDb.incidents.unshift({
            incident_id: newIncId,
            title: newEvent.event_type === 'temperature_anomaly' ? 'Anomaly: Machine Heat Warning' : 'Anomaly: Restricted Area Intrusion',
            severity: 'high',
            status: 'open',
            summary: `Automated detection generated incident due to event: ${newEvent.event_type}. Ready for investigation.`,
            risk_score: 70,
            risk_indicators: [newEvent.event_type],
            related_events: [newEvent.event_type],
            created_at: new Date().toISOString(),
          });
          
          mockDb.alerts.unshift({
            alert_id: 'alt_' + Math.random().toString(36).substr(2, 5),
            incident_id: newIncId,
            severity: 'high',
            status: 'open',
            message: `Critical event ${newEvent.event_type} registered`,
            created_at: new Date().toISOString(),
          });
        }
      }
      
      saveMockDb();
      return newEvent;
    }
    return mockDb.events;
  }

  if (path.startsWith('/api/incidents/')) {
    const parts = path.split('/');
    const incidentId = parts[3];
    const incident = mockDb.incidents.find(i => i.incident_id === incidentId);
    
    if (parts[4] === 'investigate') {
      const run = {
        run_id: 'run_' + Math.random().toString(36).substr(2, 7),
        status: 'success',
        created_at: new Date().toISOString(),
        workflow_version: 'v1.2.0-prod',
        output: { risk_score: incident ? incident.risk_score + 2 : 75, decision: 'action_governed', actions_triggered: ['mitigate_alert'] },
        trace: {
          observer: 'Signal anomalies confirmed.',
          retriever: 'SOP index loaded correctly.',
          investigator: 'Root cause confirmed from manual procedures.',
          planner: 'Mitigation checklist generated.',
          guard: 'Rules passed policy.',
        }
      };
      if (!mockDb.agentRuns[incidentId]) mockDb.agentRuns[incidentId] = [];
      mockDb.agentRuns[incidentId].unshift(run);
      
      if (incident) {
        incident.summary = 'Investigation complete. Machine A manual SOP indicates critical parameter threshold (90°C) was breached. Recommended action: verify manual shutdown checklist and coordinate with operators in Zone A.';
        incident.risk_indicators.push('sop_matched');
      }
      
      mockDb.audit.unshift({
        audit_id: 'aud_' + Math.random().toString(36).substr(2, 5),
        action: 'agent.investigation',
        actor: 'OmniSight Agent Orchestrator',
        target_type: 'incident',
        target_id: incidentId,
        created_at: new Date().toISOString(),
      });
      
      saveMockDb();
      return { status: 'success', run };
    }
    
    if (parts[4] === 'agent-runs') {
      return mockDb.agentRuns[incidentId] || [];
    }

    if (method === 'PATCH') {
      const body = JSON.parse(options.body);
      if (incident) {
        Object.assign(incident, body);
        mockDb.audit.unshift({
          audit_id: 'aud_' + Math.random().toString(36).substr(2, 5),
          action: `incident.${body.status}`,
          actor: 'admin@example.com',
          target_type: 'incident',
          target_id: incidentId,
          created_at: new Date().toISOString(),
        });
        saveMockDb();
      }
      return incident;
    }
  }

  if (path.startsWith('/api/incidents')) {
    return mockDb.incidents;
  }

  if (path.startsWith('/api/alerts/')) {
    const parts = path.split('/');
    const alertId = parts[3];
    const alert = mockDb.alerts.find(a => a.alert_id === alertId);
    if (parts[4] === 'acknowledge') {
      if (alert) {
        alert.status = 'acknowledged';
        alert.acknowledged_by = 'admin@example.com';
        saveMockDb();
      }
      return alert;
    }
  }

  if (path.startsWith('/api/alerts')) {
    return mockDb.alerts;
  }

  if (path.startsWith('/api/documents/upload')) {
    const text = options.body.get('file');
    const name = options.body.get('file_name') || 'uploaded_doc.txt';
    const asset = options.body.get('asset_id') || 'global';
    const newDoc = {
      document_id: 'doc_' + Math.random().toString(36).substr(2, 5),
      file_name: name,
      document_type: 'manual',
      asset_id: asset,
      chunk_count: 1,
      text: 'Custom Uploaded Document Content. Active operator supervision mandated.',
    };
    mockDb.documents.unshift(newDoc);
    saveMockDb();
    return newDoc;
  }

  if (path.startsWith('/api/documents')) {
    return mockDb.documents;
  }

  if (path.startsWith('/api/actions')) {
    return mockDb.actions;
  }

  if (path.startsWith('/api/knowledge/graph')) {
    const nodes = [];
    const edges = [];
    
    mockDb.incidents.forEach(inc => {
      nodes.push({ id: inc.incident_id, label: inc.title, type: 'Incident' });
      inc.related_events.forEach(evId => {
        edges.push({ source: inc.incident_id, target: evId, relation: 'CORRELATED_WITH' });
      });
    });
    
    mockDb.events.forEach(ev => {
      nodes.push({ id: ev.event_id, label: ev.event_type, type: 'Event' });
      nodes.push({ id: ev.source_id, label: ev.source_id, type: 'Machine' });
      edges.push({ source: ev.event_id, target: ev.source_id, relation: 'EMITTED_BY' });
    });

    return { nodes, edges };
  }

  if (path.startsWith('/api/search/query')) {
    const body = JSON.parse(options.body);
    const query = body.query.toLowerCase();
    const hits = [];
    mockDb.documents.forEach(doc => {
      if (doc.text.toLowerCase().includes(query) || doc.file_name.toLowerCase().includes(query)) {
        hits.push({
          document_id: doc.document_id,
          chunk_id: 'chunk_01',
          score: 0.95,
          text: doc.text,
          metadata: { file_name: doc.file_name, asset_id: doc.asset_id },
        });
      }
    });
    return { hits };
  }

  if (path.startsWith('/api/demo/seed')) {
    seedMockDbDefaults();
    return { status: 'seeded' };
  }

  if (path.startsWith('/api/audit/logs')) {
    return mockDb.audit;
  }

  if (path.startsWith('/api/users')) {
    return mockDb.users;
  }

  return null;
}

/* ==========================================
   DYNAMIC API UTILITY INTERCEPTOR
   ========================================== */

async function api(path, options = {}) {
  startProgress();
  
  if (state.useMocks) {
    // Simulate minor visual network latency for aesthetics
    await new Promise(r => setTimeout(r, 450));
    try {
      const res = handleMockApi(path, options);
      finishProgress(false);
      return res;
    } catch (e) {
      finishProgress(true);
      throw e;
    }
  }

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

/* ==========================================
   VISUAL & THEME CUSTOMIZERS
   ========================================== */

function applyTheme() {
  document.body.classList.toggle('light', state.theme === 'light');
  document.body.classList.toggle('compact', state.density === 'compact');
  
  const sheenEnabled = (state.animations === 'on');
  document.body.style.setProperty('--sheen-opacity', sheenEnabled ? '1' : '0');
}

function showAppAuthed() {
  $('#authScreen').classList.toggle('hidden', Boolean(state.token));
  $('#appShell').classList.toggle('hidden', !state.token);
  $('#sidebarUser').innerHTML = state.email ? `<b>${escapeHtml(state.email)}</b><br><span class="muted">${escapeHtml(state.role)}</span>` : '';
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
    if (!quiet) toast('Dashboard metrics updated', 'success');
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
  
  if (view === 'graph') {
    setTimeout(initInteractiveGraph, 50);
  }
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
    ['Events', stats.events, 'normalized signals', 'rgba(103,232,249,.14)'],
    ['Incidents', stats.incidents, `${openIncidents} open alert desks`, 'rgba(251,113,133,.14)'],
    ['Alerts', stats.alerts, `${openAlerts} verified critical`, 'rgba(251,191,36,.14)'],
    ['Documents', stats.documents, 'semantic chunks', 'rgba(52,211,153,.14)'],
    ['Agent Runs', stats.agent_runs, 'automated checks', 'rgba(167,139,250,.16)'],
  ];
  const html = kpis.map(([label, value, sub, glow]) => `
    <div class="kpi" style="--glow:${glow}">
      <canvas class="kpi-sparkline" data-kpi-spark="${label.toLowerCase().replace(' ', '_')}"></canvas>
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
  drawKpiSparklines();
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
    <div class="insight-card reveal"><b>Incident Pressure</b><p>Active warnings / open alert status load.</p><div class="spark-wrap"><canvas data-spark="incidents"></canvas></div></div>
    <div class="insight-card reveal"><b>Multimodal Coverage</b><p>Vision, IoT sensors, sound signal distribution.</p><div class="spark-wrap"><canvas data-spark="events"></canvas></div></div>
    <div class="insight-card reveal"><b>Agent Operations</b><p>Daily audits & RAG pipeline runs.</p><div class="spark-wrap"><canvas data-spark="agents"></canvas></div></div>`;
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
    
    // Draw Grid Lines (Premium UX touch)
    ctx.strokeStyle = state.theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for(let y=10; y<h; y+=20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#67e8f9');
    grad.addColorStop(1, '#a78bfa');
    
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1 || 1)) * w;
      const y = h - (value / max) * (h - 16) - 8;
      return { x, y };
    });
    
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else {
        // Smooth curve interpolation
        const prev = points[idx - 1];
        const cx = (prev.x + p.x) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, cx, (prev.y + p.y) / 2);
      }
    });
    ctx.lineTo(w, points[points.length - 1].y);
    ctx.stroke();
    
    // Fill background area under curve
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = state.theme === 'light' ? 'rgba(103,232,249,.04)' : 'rgba(103,232,249,.06)';
    ctx.fill();
    
    // Draw interactive glowing node markers
    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#67e8f9';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(103,232,249,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  });
}

function drawKpiSparklines() {
  $$('canvas[data-kpi-spark]').forEach(canvas => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const type = canvas.dataset.kpiSpark;
    const stats = state.data.stats || {};
    
    let trend = [];
    if (type === 'events') {
      const current = state.data.events.length || stats.events || 0;
      trend = [Math.round(current * 0.4), Math.round(current * 0.65), Math.round(current * 0.5), Math.round(current * 0.8), Math.round(current * 0.72), Math.round(current * 0.9), current];
    } else if (type === 'incidents') {
      const current = state.data.incidents.length || stats.incidents || 0;
      trend = [Math.round(current * 0.3), Math.round(current * 0.5), Math.round(current * 0.4), Math.round(current * 0.7), Math.round(current * 0.6), Math.round(current * 0.85), current];
    } else if (type === 'alerts') {
      const current = state.data.alerts.length || stats.alerts || 0;
      trend = [Math.round(current * 0.2), Math.round(current * 0.4), Math.round(current * 0.3), Math.round(current * 0.6), Math.round(current * 0.5), Math.round(current * 0.8), current];
    } else if (type === 'documents') {
      const current = state.data.documents.length || stats.documents || 0;
      trend = [Math.round(current * 0.5), Math.round(current * 0.5), Math.round(current * 0.7), Math.round(current * 0.7), Math.round(current * 0.9), Math.round(current * 0.9), current];
    } else if (type === 'agent_runs') {
      const current = Object.values(mockDb.agentRuns).flat().length || stats.agent_runs || 0;
      trend = [Math.round(current * 0.35), Math.round(current * 0.55), Math.round(current * 0.45), Math.round(current * 0.75), Math.round(current * 0.7), Math.round(current * 0.92), current];
    } else {
      trend = [5, 10, 8, 12, 11, 15, 14];
    }

    trend = trend.map(v => typeof v === 'number' && !isNaN(v) ? v : 0);
    const max = Math.max(...trend, 1);
    const min = Math.min(...trend, 0);
    const range = max - min || 1;

    const points = trend.map((val, idx) => {
      const x = (idx / (trend.length - 1)) * w;
      const y = h - ((val - min) / range) * (h - 8) - 4;
      return { x, y };
    });

    let color = '#67e8f9';
    let glow = 'rgba(103,232,249,0.04)';
    if (type === 'incidents') {
      color = '#fb7185';
      glow = 'rgba(251,113,133,0.04)';
    } else if (type === 'alerts') {
      color = '#fbbf24';
      glow = 'rgba(251,191,36,0.04)';
    } else if (type === 'documents') {
      color = '#34d399';
      glow = 'rgba(52,211,153,0.04)';
    } else if (type === 'agent_runs') {
      color = '#a78bfa';
      glow = 'rgba(167,139,250,0.04)';
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else {
        const prev = points[idx - 1];
        const cx = (prev.x + p.x) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, cx, (prev.y + p.y) / 2);
      }
    });
    ctx.lineTo(w, points[points.length - 1].y);
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = glow;
    ctx.fill();
  });
}

function updateCurlCommand() {
  const form = $('#customEventForm');
  if (!form) return;
  const fd = new FormData(form);
  const auth = $('#apiHeaderAuth')?.value || 'Bearer os_live_79a32c';
  
  let payloadStr = fd.get('payload') || '{}';
  let payloadObj = {};
  try {
    payloadObj = JSON.parse(payloadStr);
  } catch (e) {
    payloadObj = { note: payloadStr };
  }

  const body = {
    source_id: fd.get('source_id') || 'webhook_demo',
    source_type: fd.get('source_type') || 'webhook',
    event_type: fd.get('event_type') || 'manual_observation',
    severity: fd.get('severity') || 'low',
    location: { site: 'plant_1', zone: 'operator_console' },
    payload: payloadObj,
    trace: { producer: 'omnisight-console' }
  };

  const curlStr = `curl -X POST http://localhost:8000/api/events \\\n  -H "Authorization: ${auth}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body)}'`;

  const curlEl = $('#curlCommandLine');
  if (curlEl) {
    curlEl.textContent = curlStr;
  }
}

function selectDocumentForChunkMap(docId) {
  state.selectedDocId = docId;
  const doc = state.data.documents.find(d => d.document_id === docId);
  if (!doc) return;

  $('#chunkGridDocName').textContent = doc.file_name;
  $('#chunkGridContainer').classList.remove('hidden');

  const chunks = [];
  const textParts = doc.text.split('.').map(s => s.trim()).filter(Boolean);
  
  textParts.forEach((part, index) => {
    chunks.push({
      chunk_id: `${docId}_chunk_${index}`,
      text: part + '.',
      token_count: Math.round(part.split(/\s+/).length * 1.3) + 4,
      score: 0
    });
  });

  state.currentDocChunks = chunks;
  renderChunkBlocks(chunks);
}

function renderChunkBlocks(chunks) {
  const grid = $('#chunkGrid');
  if (!grid) return;

  grid.innerHTML = chunks.map((chunk, idx) => {
    let extraClass = '';
    let style = '';
    if (chunk.score > 0) {
      extraClass = 'matched-chunk';
      const opacity = Math.min(1, chunk.score);
      style = `style="background: rgba(103, 232, 249, ${opacity}); border-color: rgba(103, 232, 249, ${opacity + 0.2});"`;
    }
    return `
      <div class="chunk-block ${extraClass}" ${style}>
        <div class="chunk-tooltip">
          <div style="font-weight:700; color:var(--cyan); margin-bottom:4px;">Chunk #${idx + 1}</div>
          <p style="margin:0 0 6px 0; max-height: 80px; overflow-y: auto;">"${escapeHtml(chunk.text)}"</p>
          <div style="display:flex; justify-content:space-between; font-size:9px; color:var(--muted);">
            <span>Tokens: <b>${chunk.token_count}</b></span>
            ${chunk.score > 0 ? `<span style="color:var(--cyan);">Score: <b>${chunk.score.toFixed(2)}</b></span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderGraphDrawer() {
  const listEl = $('#graphDrawerList');
  if (!listEl) return;

  const { nodes = [], edges = [] } = state.data.graph || {};
  const query = (state.graphSearchQuery || '').toLowerCase();

  if (state.graphActiveTab === 'nodes') {
    const filteredNodes = nodes.filter(node => 
      !query || 
      node.label.toLowerCase().includes(query) || 
      node.type.toLowerCase().includes(query) || 
      node.id.toLowerCase().includes(query)
    );

    listEl.innerHTML = filteredNodes.map(node => `
      <div class="item-card graph-drawer-item" data-drawer-node-id="${escapeHtml(node.id)}" style="cursor:pointer; transition:all 0.2s; padding:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <b style="font-size:12px; color:var(--text);">${escapeHtml(node.label)}</b>
          ${pill(node.type)}
        </div>
        <p class="mono muted" style="font-size:10px; margin:4px 0 0 0;">${escapeHtml(node.id)}</p>
      </div>
    `).join('') || `<div class="empty-state" style="padding:16px;">No nodes found</div>`;
  } else {
    const filteredEdges = edges.filter(edge => 
      !query || 
      edge.relation.toLowerCase().includes(query) || 
      edge.source.toLowerCase().includes(query) || 
      edge.target.toLowerCase().includes(query)
    );

    listEl.innerHTML = filteredEdges.map(edge => `
      <div class="item-card graph-drawer-item" style="font-size:11px; padding:10px;">
        <div style="font-weight:700; color:var(--cyan);">${escapeHtml(edge.relation)}</div>
        <div style="display:flex; justify-content:space-between; margin-top:4px; font-family:var(--font-mono); font-size:9px; color:var(--muted);">
          <span>Source: ${shortId(edge.source)}</span>
          <span>→</span>
          <span>Target: ${shortId(edge.target)}</span>
        </div>
      </div>
    `).join('') || `<div class="empty-state" style="padding:16px;">No edges found</div>`;
  }
}

function centerGraphOnNode(nodeId) {
  const pos = state.graphNodePositions?.[nodeId];
  const svg = $('#graphSvg');
  if (!pos || !svg) return;

  const startVb = svg.getAttribute('viewBox').split(' ').map(Number);
  const targetVb = [pos.x - 1100 / 2, pos.y - 540 / 2, 1100, 540];

  const startTime = performance.now();
  const duration = 400;

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const ease = 1 - Math.pow(1 - progress, 3);

    const currentVb = startVb.map((val, idx) => val + (targetVb[idx] - val) * ease);
    svg.setAttribute('viewBox', currentVb.join(' '));

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      const nodeEl = svg.querySelector(`[data-node-id="${nodeId}"]`);
      if (nodeEl) {
        nodeEl.classList.add('highlighted');
        setTimeout(() => nodeEl.classList.remove('highlighted'), 1500);
      }
    }
  }

  requestAnimationFrame(animate);
}

function applyGraphDrawerCollapseState() {
  const drawer = $('#graphDrawer');
  const toggleBtn = $('#toggleGraphDrawerBtn');
  const grid = $('.graph-layout-grid');
  if (!drawer || !grid) return;

  if (state.graphDrawerCollapsed) {
    drawer.classList.add('hidden');
    grid.style.gridTemplateColumns = '1fr';
    if (toggleBtn) toggleBtn.textContent = 'Tactical Sidebar';
  } else {
    drawer.classList.remove('hidden');
    grid.style.gridTemplateColumns = '1fr 340px';
    if (toggleBtn) toggleBtn.textContent = 'Hide Sidebar';
  }
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
  const activeClass = state.selectedIncidentId === incident.incident_id ? 'active-card' : '';
  return `<article class="item-card incident-card ${activeClass}" data-incident-id="${escapeHtml(incident.incident_id)}">
    <div class="rowish"><span>${pill(incident.severity)} ${pill(incident.status)}</span><span class="muted mono">${shortId(incident.incident_id)}</span></div>
    <h4>${escapeHtml(incident.title)}</h4>
    <p>${escapeHtml(compact ? (incident.summary || 'Awaiting agent summary').slice(0, 120) + '...' : (incident.summary || 'No investigation summary yet.'))}</p>
    <div class="rowish" style="margin-top: 10px;"><span class="muted">Risk Score: <b>${incident.risk_score ?? 'n/a'}</b> · ${incident.related_events?.length || 0} signals</span><button class="btn small secondary" data-open-incident="${escapeHtml(incident.incident_id)}">Inspect</button></div>
  </article>`;
}

function alertCard(alert) {
  const action = alert.status === 'open'
    ? `<button class="btn small primary" data-ack-alert="${escapeHtml(alert.alert_id)}">Acknowledge</button>`
    : `<span class="muted">Ack by ${escapeHtml(alert.acknowledged_by || 'operator')}</span>`;
  return `<article class="item-card">${pill(alert.severity)} ${pill(alert.status)}<h4>${escapeHtml(alert.message)}</h4><p class="mono muted">${shortId(alert.alert_id)} · ${fmtDate(alert.created_at)}</p><div style="margin-top:10px;">${action}</div></article>`;
}

function timelineItem(title, sub, severity = '') {
  return `<div class="timeline-item"><div class="timeline-dot"></div><div class="timeline-body">${pill(severity)}<b>${escapeHtml(title)}</b><span>${escapeHtml(sub)}</span></div></div>`;
}

function renderOverview() {
  $('#overviewIncidents').innerHTML = state.data.incidents.slice(0, 5).map(item => incidentCard(item, true)).join('') || empty('No incidents logged yet. Seed demo to generate warning incidents.', '<button class="btn primary" data-seed-inline>Seed Demo</button>');
  $('#overviewAlerts').innerHTML = state.data.alerts.slice(0, 5).map(alertCard).join('') || empty('No active alerts.');
  $('#overviewTimeline').innerHTML = state.data.events.slice(0, 8).map(item => timelineItem(item.event_type, `${item.source_id} · ${fmtDate(item.timestamp)}`, item.severity)).join('') || empty('No events loaded.');
  $('#healthMap').innerHTML = serviceHealth.map(([name, desc]) => `<div class="health-card"><b>${name}</b><p>${desc}</p></div>`).join('');
}

function renderIncidentsPage() {
  const list = filteredIncidents();
  $('#incidentList').innerHTML = list.map(item => incidentCard(item)).join('') || empty('No matching incidents found.');
  if (!state.selectedIncidentId && list[0]) state.selectedIncidentId = list[0].incident_id;
  renderIncidentDetail(state.selectedIncidentId);
}

/* ==========================================
   WAR ROOM INCIDENT COMMAND DETAIL DESK
   ========================================== */

function renderIncidentDetail(id) {
  const el = $('#incidentDetail');
  const incident = state.data.incidents.find(item => item.incident_id === id);
  if (!incident) {
    el.innerHTML = empty('Select an incident to inspect evidence, agent runs, and actions.');
    return;
  }
  
  // Set default tab if not set
  if (!state.incidentActiveTabs[id]) {
    state.incidentActiveTabs[id] = 'dossier';
  }
  
  const currentTab = state.incidentActiveTabs[id];
  const related = state.data.events.filter(event => incident.related_events?.includes(event.event_id));
  const actions = state.data.actions.filter(action => action.incident_id === incident.incident_id);
  
  const hasCameraFeed = related.some(event => event.source_type === 'camera');
  const cameraFeedHtml = hasCameraFeed ? `
    <div class="divider"></div>
    <h4 style="margin-bottom: 8px;">Live CCTV Analytics Feed (SEC_EAST_01)</h4>
    <div class="camera-feed">
      <div class="scanlines"></div>
      <div class="grid-overlay"></div>
      <div class="feed-header">
        <div><span class="live-dot pulse-dot"></span><b>LIVE Feed</b></div>
        <span class="cam-id">CAM_A01_ZONE_A / SEC_EAST_01</span>
        <span class="timestamp">${new Date(incident.created_at).toLocaleTimeString()}</span>
      </div>
      <div class="feed-content">
        <div class="target-box">
          <div class="target-label">WARNING: FORKLIFT IN ZONE A</div>
          <div class="target-corner top-left"></div>
          <div class="target-corner top-right"></div>
          <div class="target-corner bottom-left"></div>
          <div class="target-corner bottom-right"></div>
          <div class="confidence">96.4% CONFIDENCE</div>
        </div>
        <div class="crosshair"></div>
        <div class="telemetry-bar">
          <span>X-BOUNDS: [12.44, 45.89]</span>
          <span>Y-BOUNDS: [88.12, 102.5]</span>
          <span>ZONE_TARGET: PLANT_RESTRICTED_A</span>
        </div>
      </div>
    </div>
  ` : '';
  
  // Build Playbook check status
  if (!state.playbooks[id]) {
    state.playbooks[id] = [
      { text: 'Verify CCTV feed for forklift registration ID', done: false },
      { text: 'Confirm temperature reading calibration parameters', done: false },
      { text: 'Quarantine Machine A operations in SCADA controller', done: false },
      { text: 'Log safety ticket with Zone A supervisor', done: false },
    ];
  }
  
  // High/Medium/Low Gauge classes
  const riskVal = incident.risk_score || 50;
  const lowClass = riskVal > 0 ? 'filled-low' : '';
  const medClass = riskVal > 40 ? 'filled-med' : '';
  const highClass = riskVal > 75 ? 'filled-high' : '';

  el.innerHTML = `
    <div class="detail-head">
      <div class="rowish">
        <span>${pill(incident.severity)} ${pill(incident.status)}</span>
        <span class="muted mono">${escapeHtml(incident.incident_id)}</span>
      </div>
      <h3 style="margin: 12px 0 6px 0; font-size:22px; font-weight:800;">${escapeHtml(incident.title)}</h3>
      <p class="muted" style="margin: 0 0 16px 0;">Logged: ${fmtDate(incident.created_at)}</p>
    </div>
    
    <div class="detail-actions" style="margin-bottom: 20px;">
      <button class="btn primary small" data-run-agent="${escapeHtml(incident.incident_id)}">⚡ Run Agent Investigation</button>
      <button class="btn secondary small" data-status="acknowledged" data-incident-status="${escapeHtml(incident.incident_id)}">✓ Acknowledge</button>
      <button class="btn secondary small" data-status="resolved" data-incident-status="${escapeHtml(incident.incident_id)}">✓ Resolve</button>
      <button class="btn ghost small" data-view-runs="${escapeHtml(incident.incident_id)}">🔍 Trace Agent Runs</button>
    </div>
    
    <div class="detail-tabs">
      <button class="tab-btn ${currentTab === 'dossier' ? 'active' : ''}" data-tab-select="dossier" data-inc-id="${id}">Dossier</button>
      <button class="tab-btn ${currentTab === 'evidence' ? 'active' : ''}" data-tab-select="evidence" data-inc-id="${id}">Evidence (${related.length})</button>
      <button class="tab-btn ${currentTab === 'playbook' ? 'active' : ''}" data-tab-select="playbook" data-inc-id="${id}">Playbook & Mitigation</button>
    </div>
    
    <!-- Tab 1: Dossier -->
    <div class="tab-content ${currentTab === 'dossier' ? 'active' : ''}">
      <h4>Threat Threat Assessment</h4>
      <div class="threat-scale">
        <div class="threat-bar ${lowClass}"></div>
        <div class="threat-bar ${medClass}"></div>
        <div class="threat-bar ${highClass}"></div>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-top:4px;">
        <span>Low Risk</span>
        <span>Medium Threat</span>
        <span style="font-weight:700; color:var(--red);">Threat Level ${riskVal}%</span>
      </div>

      <div class="divider"></div>
      <h4>AI Evidence Synthesis</h4>
      <p style="font-size:14px; line-height:1.6; color:var(--soft);">${escapeHtml(incident.summary || 'No investigation summary generated yet. Press "Run Agent Investigation" to trigger LLM summary synthesis.')}</p>
      
      <div class="divider"></div>
      <h4>Risk Indicators</h4>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${(incident.risk_indicators || []).map(pill).join(' ') || '<span class="muted">None matched</span>'}
      </div>
      
      ${cameraFeedHtml}
    </div>
    
    <!-- Tab 2: Evidence Timeline -->
    <div class="tab-content ${currentTab === 'evidence' ? 'active' : ''}">
      <h4>Related Event Logs</h4>
      <div class="stack" style="margin-top:12px;">
        ${related.map(event => `
          <div class="item-card">
            <div class="rowish">
              <b>${escapeHtml(event.event_type)}</b>
              <span>${pill(event.severity)}</span>
            </div>
            <p class="muted">${escapeHtml(event.source_id)} · ${fmtDate(event.timestamp)}</p>
            ${jsonBlock({ location: event.location, payload: event.payload })}
          </div>
        `).join('') || '<p class="muted">No raw events matched to this incident yet.</p>'}
      </div>
    </div>
    
    <!-- Tab 3: Playbook & Mitigation -->
    <div class="tab-content ${currentTab === 'playbook' ? 'active' : ''}">
      <h4>Mitigation Playbook Checklist</h4>
      <p class="muted">CTO mandated manual SOP safety verification checklist:</p>
      
      <div class="playbook-list">
        ${state.playbooks[id].map((item, idx) => `
          <div class="playbook-item ${item.done ? 'checked' : ''}" data-playbook-check="${idx}" data-inc-id="${id}">
            <input type="checkbox" ${item.done ? 'checked' : ''} />
            <span>${escapeHtml(item.text)}</span>
          </div>
        `).join('')}
      </div>
      
      <div class="divider"></div>
      <h4>Action Logs</h4>
      <div class="stack">
        ${actions.map(action => `
          <div class="item-card">
            <div class="rowish">
              <b>${escapeHtml(action.action_type)}</b> 
              ${pill(action.status)}
            </div>
            <p class="muted">${fmtDate(action.created_at)}</p>
            ${jsonBlock(action.payload)}
          </div>
        `).join('') || '<p class="muted">No mitigations executed yet.</p>'}
      </div>
    </div>
  `;
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
  $('#eventTable').innerHTML = rows || `<tr><td colspan="6">No events found matching current query.</td></tr>`;
}

function renderDocumentsPage() {
  $('#documentList').innerHTML = state.data.documents.map(doc => `
    <article class="item-card" data-document-card-id="${escapeHtml(doc.document_id)}" style="cursor:pointer; transition:border-color 0.2s;">
      <span class="badge">${escapeHtml(doc.document_type)}</span>
      <h4>${escapeHtml(doc.file_name)}</h4>
      <p>Asset ID: ${escapeHtml(doc.asset_id || 'global')} · ${doc.chunk_count} chunks</p>
      <p class="mono muted">${shortId(doc.document_id)}</p>
    </article>`).join('') || empty('No documents uploaded.');
}

function renderAgentsPage() {
  $('#agentIncidentPicker').innerHTML = state.data.incidents.map(incident => `<div class="item-card"><b>${escapeHtml(incident.title)}</b><p class="muted">${shortId(incident.incident_id)} · risk ${incident.risk_score ?? 'n/a'}</p><button class="btn small primary" data-run-agent="${escapeHtml(incident.incident_id)}">⚡ Investigate</button> <button class="btn small secondary" data-view-runs="${escapeHtml(incident.incident_id)}">Trace Runs</button></div>`).join('') || empty('No incidents loaded.');
}

async function showAgentRuns(incidentId) {
  try {
    $('#agentTraceViewer').innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Loading trace...</div>';
    const runs = await api(`/api/incidents/${incidentId}/agent-runs`, { headers: authHeaders(false) });
    $('#agentTraceViewer').innerHTML = runs.map(run => {
      const riskScore = run.output?.risk_score ?? 'N/A';
      const summary = escapeHtml(run.output?.summary ?? 'No summary provided.');
      return `
      <div class="ai-chat-card">
        <div class="ai-chat-header rowish">
          <div class="ai-avatar">A</div>
          <div style="flex:1">
            <b style="font-size:14px;">OmniSight Agent ${shortId(run.run_id)}</b>
            <p class="muted" style="margin:0; font-size:11px;">Workflow: ${escapeHtml(run.workflow_version)} · ${fmtDate(run.created_at)}</p>
          </div>
          ${pill(run.status)}
        </div>
        <div class="ai-chat-body">
          <div class="ai-summary-box">
            <h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; color:var(--cyan);">Investigation Conclusion</h4>
            <p style="margin:0; line-height:1.6; font-size:14px; color:var(--text);">${summary}</p>
          </div>
          <div class="ai-metric-row" style="display:flex; gap:16px; margin: 16px 0;">
            <div class="ai-metric" style="background:var(--bg); padding:10px 16px; border-radius:8px; border:1px solid var(--line);">
              <span style="font-size:11px; color:var(--muted); display:block; text-transform:uppercase;">Calculated Risk</span>
              <b style="font-size:16px; color:var(--red);">${riskScore}</b>
            </div>
          </div>
          <details class="ai-details" style="margin-top:12px;">
            <summary style="cursor:pointer; color:var(--blue); font-size:13px; font-weight:600;">View Raw Output</summary>
            <div style="margin-top:10px;">${jsonBlock(run.output)}</div>
          </details>
          <details class="ai-details" style="margin-top:8px;">
            <summary style="cursor:pointer; color:var(--blue); font-size:13px; font-weight:600;">View Execution Trace</summary>
            <div style="margin-top:10px;">${jsonBlock(run.trace)}</div>
          </details>
        </div>
      </div>`;
    }).join('') || empty('No agent traces found.');
    setView('agents');
  } catch (error) {
    toast(error.message, 'error');
    $('#agentTraceViewer').innerHTML = empty('Failed to load agent traces.');
  }
}

function renderGraphPage() {
  const { nodes = [], edges = [] } = state.data.graph || {};
  $('#graphCanvas').innerHTML = renderGraphSvg(nodes, edges);
  
  if (state.graphActiveTab === undefined) state.graphActiveTab = 'nodes';
  if (state.graphSearchQuery === undefined) state.graphSearchQuery = '';
  
  renderGraphDrawer();
  applyGraphDrawerCollapseState();
}

/* ==========================================
   INTERACTIVE SVG KNOWLEDGE GRAPH WITH DRAG & HOVER
   ========================================== */

function renderGraphSvg(nodes, edges) {
  if (!nodes.length) return empty('No graph data found. Load elements or seed the demo scenario.');
  const w = 1100;
  const h = 540;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.32;
  
  const pos = {};
  nodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
    const jitter = (index % 3) * 12;
    pos[node.id] = { x: cx + Math.cos(angle) * (r + jitter), y: cy + Math.sin(angle) * (r + jitter) };
  });
  state.graphNodePositions = pos; // Save computed node positions to state for centering
  
  const color = type => ({ Incident: '#fb7185', Event: '#67e8f9', Machine: '#34d399', Zone: '#fbbf24', Document: '#a78bfa' }[type] || '#cbd5e1');
  
  const edgeSvg = edges.map(edge => {
    const a = pos[edge.source];
    const b = pos[edge.target];
    if (!a || !b) return '';
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    return `<g class="graph-edge" data-source="${edge.source}" data-target="${edge.target}"><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#334155" stroke-width="1.8" marker-end="url(#arrow)"/><text class="edge-label" x="${mx}" y="${my}">${escapeHtml(edge.relation)}</text></g>`;
  }).join('');
  
  const nodeSvg = nodes.map((node, index) => {
    const p = pos[node.id];
    const c = color(node.type);
    return `<g data-node-id="${escapeHtml(node.id)}" class="graph-node" style="animation:fadeUp .35s ease ${index * 20}ms both"><circle cx="${p.x}" cy="${p.y}" r="15" fill="${c}" opacity=".9"/><circle cx="${p.x}" cy="${p.y}" r="26" fill="${c}" opacity=".1"/><text class="node-label" x="${p.x + 22}" y="${p.y + 4}">${escapeHtml(String(node.label).slice(0, 24))}</text></g>`;
  }).join('');
  
  return `<svg viewBox="0 0 ${w} ${h}" id="graphSvg" role="img" aria-label="Knowledge graph"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="18" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#334155"/></marker></defs>${edgeSvg}${nodeSvg}</svg>`;
}

function initInteractiveGraph() {
  const svg = $('#graphSvg');
  if (!svg) return;
  
  // 1. Mouse Drag to Pan Support
  let isPanning = false;
  let startX = 0, startY = 0;
  let viewX = 0, viewY = 0;
  
  svg.addEventListener('mousedown', event => {
    if (event.target.closest('.graph-node')) return; // Ignore drag on node click
    isPanning = true;
    startX = event.clientX;
    startY = event.clientY;
    const vb = svg.getAttribute('viewBox').split(' ').map(Number);
    viewX = vb[0];
    viewY = vb[1];
  });

  window.addEventListener('mousemove', event => {
    if (!isPanning) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    svg.setAttribute('viewBox', `${viewX - dx} ${viewY - dy} 1100 540`);
  });

  window.addEventListener('mouseup', () => { isPanning = false; });

  // 2. Hover highlights logic
  const nodes = $$('.graph-node', svg);
  const edges = $$('.graph-edge', svg);
  const canvasContainer = $('#graphCanvas');

  nodes.forEach(node => {
    node.addEventListener('mouseover', () => {
      const nodeId = node.dataset.nodeId;
      canvasContainer.classList.add('dimmed');
      node.classList.add('highlighted');
      
      edges.forEach(edge => {
        const source = edge.dataset.source;
        const target = edge.dataset.target;
        if (source === nodeId || target === nodeId) {
          edge.querySelector('line').classList.add('highlighted');
          
          // Also highlight the connected node
          const connectedId = source === nodeId ? target : source;
          const connectedNode = svg.querySelector(`[data-node-id="${connectedId}"]`);
          if (connectedNode) connectedNode.classList.add('highlighted');
        }
      });
    });

    node.addEventListener('mouseout', () => {
      canvasContainer.classList.remove('dimmed');
      $$('.highlighted', svg).forEach(el => el.classList.remove('highlighted'));
      $$('line.highlighted', svg).forEach(el => el.classList.remove('highlighted'));
    });
  });
}

function renderObservabilityPage() {
  const stats = state.data.stats || {};
  const values = [
    ['Event Ingestion Rate', Math.min(100, (stats.events || 0) * 12), `${stats.events || 0} events`],
    ['Incident Pressure Gauge', Math.min(100, (stats.incidents || 0) * 35), `${stats.incidents || 0} incidents`],
    ['Active Alert Queue', Math.min(100, (stats.alerts || 0) * 20), `${stats.alerts || 0} alerts`],
    ['Semantic Memory Load', Math.min(100, (stats.documents || 0) * 20), `${stats.documents || 0} docs`],
    ['Agent Runtime Core Usage', Math.min(100, (stats.agent_runs || 0) * 18), `${stats.agent_runs || 0} runs`],
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
    ? (state.data.users.map(user => `<div class="item-card"><b>${escapeHtml(user.email)}</b> ${pill(user.role)}<p class="muted">${user.is_active ? 'Active' : 'Disabled'}</p></div>`).join('') || empty('No active system users.'))
    : empty('Admin security privileges required.');
  $('#auditLogList').innerHTML = state.role === 'Admin'
    ? (state.data.audit.map(log => timelineItem(log.action, `${log.actor} · ${log.target_type || ''} ${log.target_id || ''} · ${fmtDate(log.created_at)}`, 'audit')).join('') || empty('No audit logs.'))
    : empty('Admin security privileges required.');
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
    el.style.animationDelay = `${Math.random() * 0.3}s`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
}

async function seedDemo() {
  await api('/api/demo/seed', { method: 'POST', headers: authHeaders() });
  toast('Demo sandbox environment re-seeded', 'success');
  confetti();
  await refreshAll({ quiet: true });
}

async function emitVision() {
  await api('/api/events', { 
    method: 'POST', 
    headers: authHeaders(), 
    body: JSON.stringify({
      event_type: 'restricted_zone_violation',
      severity: 'high',
      source_type: 'camera',
      source_id: 'camera_zone_a',
      location: { site: 'plant_1', zone: 'zone_a' },
      payload: { object_detected: 'forklift', confidence: 0.96 },
      trace: { producer: 'camera_mock_edge' }
    })
  });
  toast('Vision zone alert event published', 'success');
  await refreshAll({ quiet: true });
}

async function emitTemp() {
  await api('/api/events', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      event_type: 'temperature_anomaly',
      severity: 'high',
      source_type: 'iot_sensor',
      source_id: 'temp_machine_a',
      location: { site: 'plant_1', zone: 'zone_a' },
      payload: { temperature: 94.2, threshold: 85.0 },
      trace: { producer: 'iot_gateway' }
    })
  });
  toast('Sensor heat overload event published', 'success');
  await refreshAll({ quiet: true });
}

async function emitAudio() {
  await api('/api/events', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      event_type: 'grinding_noise',
      severity: 'medium',
      source_type: 'microphone',
      source_id: 'mic_mach_a',
      location: { site: 'plant_1', zone: 'zone_a' },
      payload: { decibels: 94, frequency: 'high_pitch_harmonic' },
      trace: { producer: 'audio_node' }
    })
  });
  toast('Audio grinding warning event published', 'success');
  await refreshAll({ quiet: true });
}

/* ==========================================
   LIVE AGENT PIPELINE RUN SIMULATOR
   ========================================== */

async function runAgent(incidentId) {
  setView('agents');
  
  const term = $('#agentTerminal');
  const pipeline = $('#agentPipeline');
  
  term.classList.remove('hidden');
  term.innerHTML = `<div class="log-ln info">[SYSTEM] Active trigger initiated for Incident: ${escapeHtml(incidentId)}...</div>`;
  
  // Helper to log with delays
  const writeLog = (text, type = 'info') => {
    const ln = document.createElement('div');
    ln.className = `log-ln ${type}`;
    ln.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    term.appendChild(ln);
    term.scrollTop = term.scrollHeight;
  };
  
  // Highlight helper
  const highlightStep = (nodeId) => {
    $$('.agent-node', pipeline).forEach(node => {
      if (node.dataset.node === nodeId) {
        node.className = 'agent-node active';
      } else {
        // mark previous ones as completed
        const steps = ['observer', 'retriever', 'investigator', 'planner', 'guard', 'executor'];
        const currentIdx = steps.indexOf(nodeId);
        const targetIdx = steps.indexOf(node.dataset.node);
        if (targetIdx < currentIdx) {
          node.className = 'agent-node completed';
        } else {
          node.className = 'agent-node';
        }
      }
    });
  };

  try {
    // Stage 1: Observer
    highlightStep('observer');
    writeLog('[Observer] Parsing normalized event bus stream for Incident ' + incidentId, 'info');
    await new Promise(r => setTimeout(r, 1000));
    writeLog('[Observer] Event patterns matching template [RestrictedZone + TemperatureOverload]. Risk window confirmed.', 'success');
    
    // Stage 2: Retriever
    highlightStep('retriever');
    writeLog('[Retriever] Executing vector database index search against knowledge graph...', 'info');
    await new Promise(r => setTimeout(r, 1000));
    writeLog('[Retriever] SOP document match found: safety_sop_zones.txt (score 0.94)', 'success');
    writeLog('[Retriever] Context buffer successfully loaded with SOP guidelines.', 'success');

    // Stage 3: Investigator
    highlightStep('investigator');
    writeLog('[Investigator] Synthesizing hypotheses for Machine A parameter breach...', 'info');
    await new Promise(r => setTimeout(r, 1200));
    writeLog('[Investigator] Hypothesis: Forklift operation near machine disrupted airflow, causing safety thermal trip.', 'warning');

    // Stage 4: Planner
    highlightStep('planner');
    writeLog('[Planner] Creating action execution tickets & routing alerts...', 'info');
    await new Promise(r => setTimeout(r, 1000));
    writeLog('[Planner] Ticket quarantine_zone resolved. Alert notification dispatched.', 'success');

    // Stage 5: Guard
    highlightStep('guard');
    writeLog('[Guard] Evaluating action playbook against plant policy restrictions...', 'info');
    await new Promise(r => setTimeout(r, 1000));
    writeLog('[Guard] Policy checks: PASS. Actions match standard incident mitigation rules.', 'success');

    // Stage 6: Executor
    highlightStep('executor');
    writeLog('[Executor] Finalizing incident report and triggering database updates...', 'info');
    
    // Run the actual API call
    await api(`/api/incidents/${incidentId}/investigate`, { method: 'POST', headers: authHeaders() });
    
    await new Promise(r => setTimeout(r, 800));
    writeLog('[Executor] Run successfully committed. Summary written.', 'success');
    
    // Complete
    $$('.agent-node', pipeline).forEach(node => node.className = 'agent-node completed');
    
    toast('Agent investigation simulation complete', 'success');
    confetti();
    
    await refreshAll({ quiet: true });
    await showAgentRuns(incidentId);
    
    // Set selected incident and open detail view
    state.selectedIncidentId = incidentId;
    setView('incidents');
    renderIncidentDetail(incidentId);
    
  } catch (error) {
    writeLog('[ERROR] Execution halted: ' + error.message, 'error');
    toast(error.message, 'error');
  }
}

async function updateIncidentStatus(incidentId, status) {
  await api(`/api/incidents/${incidentId}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }) });
  toast(`Incident marked as ${status}`, 'success');
  await refreshAll({ quiet: true });
}

async function acknowledgeAlert(alertId) {
  await api(`/api/alerts/${alertId}/acknowledge`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ note: 'Operator acknowledged from OmniSight Cockpit' }) });
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
  
  if (state.useMocks) {
    // Directly handle simulation upload
    const body = new FormData();
    body.append('file', text);
    body.append('file_name', name);
    body.append('asset_id', asset);
    await api('/api/documents/upload', { method: 'POST', body });
  } else {
    const response = await fetch('/api/documents/upload', { method: 'POST', headers: { Authorization: `Bearer ${state.token}` }, body: form });
    if (!response.ok) throw new Error(await response.text());
  }
  
  toast('Document indexed into semantic memory', 'success');
  await refreshAll({ quiet: true });
}

async function ragSearch() {
  const query = $('#ragQuery').value.trim();
  if (!query) return;
  const data = await api('/api/search/query', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ query, top_k: 8 }) });
  $('#ragResults').innerHTML = data.hits.map(hit => `<article class="item-card"><div class="rowish"><b>${escapeHtml(hit.metadata?.file_name || hit.document_id)}</b><span class="badge">score ${hit.score}</span></div><p>${escapeHtml(hit.text)}</p><p class="mono muted">chunk ${escapeHtml(hit.chunk_id)} · asset ${escapeHtml(hit.metadata?.asset_id || 'global')}</p></article>`).join('') || empty('No matching Sop citations found.');

  // Automatically select matching document for chunk map visual RAG highlights
  if (data.hits && data.hits.length > 0) {
    const matchDocId = data.hits[0].document_id;
    selectDocumentForChunkMap(matchDocId);
    
    if (state.currentDocChunks && state.selectedDocId === matchDocId) {
      state.currentDocChunks.forEach(chunk => {
        const hit = data.hits.find(h => chunk.text.includes(h.text) || h.text.includes(chunk.text));
        if (hit) {
          chunk.score = hit.score || 0.95;
        } else {
          chunk.score = calculateFuzzyMatchScore(chunk.text, query);
        }
      });
      renderChunkBlocks(state.currentDocChunks);
    }
  }
}

function calculateFuzzyMatchScore(text, query) {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (!words.length) return 0;
  let matches = 0;
  words.forEach(w => {
    if (text.toLowerCase().includes(w)) matches++;
  });
  return matches > 0 ? (matches / words.length) * 0.8 : 0;
}

async function publishCustomEvent(form) {
  const fd = new FormData(form);
  let payload = {};
  try { payload = JSON.parse(fd.get('payload') || '{}'); } catch { throw new Error('Payload format must be valid JSON'); }
  const body = {
    source_id: fd.get('source_id'),
    source_type: fd.get('source_type'),
    event_type: fd.get('event_type'),
    severity: fd.get('severity'),
    location: { site: 'plant_1', zone: 'operator_console' },
    payload,
    trace: { producer: 'omnisight-console' },
  };

  const statusEl = $('#playgroundResponseStatus');
  const headersEl = $('#playgroundResponseHeaders');
  const payloadEl = $('#playgroundResponsePayload');

  if (statusEl) {
    statusEl.textContent = 'HTTP/1.1 100 Continue (Sending request...)';
    statusEl.style.color = '#fbbf24';
  }

  try {
    const resData = await api('/api/events', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    
    if (statusEl) {
      statusEl.textContent = 'HTTP/1.1 201 Created';
      statusEl.style.color = '#34d399';
    }
    if (headersEl) {
      const dateStr = new Date().toUTCString();
      const contentLen = JSON.stringify(resData).length;
      headersEl.textContent = `date: ${dateStr}\nserver: uvicorn/fastapi\ncontent-type: application/json\ncontent-length: ${contentLen}\nx-ratelimit-limit: 1000\nx-ratelimit-remaining: 999\naccess-control-allow-origin: *`;
    }
    if (payloadEl) {
      payloadEl.textContent = JSON.stringify(resData, null, 2);
    }

    toast('Custom event ingested', 'success');
    await refreshAll({ quiet: true });
  } catch (error) {
    if (statusEl) {
      statusEl.textContent = 'HTTP/1.1 400 Bad Request';
      statusEl.style.color = '#fca5a5';
    }
    if (headersEl) {
      headersEl.textContent = `date: ${new Date().toUTCString()}\nserver: uvicorn/fastapi\ncontent-type: application/json`;
    }
    if (payloadEl) {
      payloadEl.textContent = JSON.stringify({ detail: error.message }, null, 2);
    }
    throw error;
  }
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
  a.download = `omnisight-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Workspace backup JSON downloaded', 'success');
}

function toggleLive() {
  state.live = !state.live;
  $('#liveBtn').textContent = state.live ? 'Live On' : 'Live Off';
  $('#liveBtn').classList.toggle('pulse-ring', state.live);
  clearInterval(state.liveTimer);
  if (state.live) {
    state.liveTimer = setInterval(() => refreshAll({ quiet: true }), 8000);
    toast('Live dashboard monitoring enabled', 'success');
  } else {
    toast('Live updates paused');
  }
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('amif_theme', state.theme);
  applyTheme();
  toast(`${state.theme} theme applied`);
  if (state.currentView === 'overview') drawSparklines();
}

/* ==========================================
   SETTINGS DIALOG & DATABASE CONFIGURES
   ========================================== */

function openSettings() {
  $('#settingsModal').classList.remove('hidden');
  $('#settingApiMode').value = state.apiMode;
  $('#settingDensity').value = state.density;
  $('#settingAnimations').value = state.animations;
}

function closeSettings() {
  $('#settingsModal').classList.add('hidden');
}

async function saveSettings() {
  const mode = $('#settingApiMode').value;
  const dens = $('#settingDensity').value;
  const anim = $('#settingAnimations').value;

  state.apiMode = mode;
  state.density = dens;
  state.animations = anim;

  localStorage.setItem('amif_api_mode', mode);
  localStorage.setItem('amif_density', dens);
  localStorage.setItem('amif_animations', anim);

  closeSettings();
  applyTheme();
  toast('UX & DB configurations saved', 'success');
  
  // Re-evaluate API Mode connections
  await evaluateApiMode();
  await refreshAll({ quiet: true });
}

async function evaluateApiMode() {
  let mode = state.apiMode;
  
  // Force sandbox mock mode on Github Pages
  if (window.location.hostname.includes('github.io')) {
    state.useMocks = true;
    $('#sandboxBanner').classList.remove('hidden');
    return;
  }

  if (mode === 'mock') {
    state.useMocks = true;
    $('#sandboxBanner').classList.remove('hidden');
    return;
  }
  
  if (mode === 'live') {
    state.useMocks = false;
    $('#sandboxBanner').classList.add('hidden');
    return;
  }

  // Auto Detect mode: Ping backend to see if FastAPI is online
  startProgress();
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1200); // 1.2s timeout limit
    
    const response = await fetch('/api/system/stats', { signal: controller.signal });
    clearTimeout(id);
    
    if (response.ok) {
      state.useMocks = false;
      $('#sandboxBanner').classList.add('hidden');
      console.log('FastAPI server detected. Live mode activated.');
    } else {
      throw new Error('Server offline');
    }
  } catch (e) {
    state.useMocks = true;
    $('#sandboxBanner').classList.remove('hidden');
    console.warn('FastAPI server offline. Fallback to Local Sandbox Mode.');
  } finally {
    finishProgress(false);
  }
}

/* ==========================================
   SPOTLIGHT SEARCH COMMANDS
   ========================================== */

function buildCommands() {
  const commands = [
    { title: 'Go to Overview Screen', hint: 'Navigation', run: () => setView('overview') },
    { title: 'Go to Incidents Command Desk', hint: 'Navigation', run: () => setView('incidents') },
    { title: 'Go to Event Logs Explorer', hint: 'Navigation', run: () => setView('events') },
    { title: 'Go to Document SOP Corpus', hint: 'Navigation', run: () => setView('documents') },
    { title: 'Go to Agent Orchestrator Runs', hint: 'Navigation', run: () => setView('agents') },
    { title: 'Go to Relationship Knowledge Graph', hint: 'Navigation', run: () => setView('graph') },
    { title: 'Go to Observability Metrics', hint: 'Navigation', run: () => setView('observability') },
    { title: 'Go to Security & Audit Matrix', hint: 'Navigation', run: () => setView('security') },
    { title: 'Seed mock workspace databases', hint: 'Action', run: seedDemo },
    { title: 'Ingest mock CCTV forklift event', hint: 'Action', run: emitVision },
    { title: 'Ingest mock heating temperature alert', hint: 'Action', run: emitTemp },
    { title: 'Ingest mock bearing sound anomaly', hint: 'Action', run: emitAudio },
    { title: 'Reload cockpit statistics', hint: 'Action', run: refreshAll },
    { title: 'Backup system data (JSON export)', hint: 'Action', run: exportState },
    { title: 'Toggle real-time streaming sync', hint: 'Action', run: toggleLive },
    { title: 'Toggle Light/Dark Theme', hint: 'Action', run: toggleTheme },
    { title: 'Open Cockpit Configuration Manager', hint: 'Action', run: openSettings },
  ];
  state.data.incidents.forEach(incident => commands.push({
    title: `Open active Incident: ${incident.title}`,
    hint: `Severity: ${incident.severity} · Risk ${incident.risk_score}%`,
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

/* ==========================================
   EVENT SUBSCRIBERS
   ========================================== */

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
  
  const customForm = $('#customEventForm');
  if (customForm) {
    customForm.addEventListener('input', updateCurlCommand);
    customForm.addEventListener('change', updateCurlCommand);
    $('#apiHeaderAuth')?.addEventListener('input', updateCurlCommand);
    updateCurlCommand();
  }
  
  $('#commandBtn').addEventListener('click', openSpotlight);
  $('#themeBtn').addEventListener('click', toggleTheme);
  $('#liveBtn').addEventListener('click', toggleLive);
  $('#exportBtn').addEventListener('click', exportState);
  
  // Settings Modal Bindings
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#bannerSettingsBtn').addEventListener('click', openSettings);
  $('#closeSettingsBtn').addEventListener('click', closeSettings);
  $('#saveSettingsBtn').addEventListener('click', saveSettings);
  $('#settingsModal').addEventListener('click', event => { if (event.target.id === 'settingsModal') closeSettings(); });

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
    
    // Tab switching listener in Incident Command
    const tabSelect = event.target.closest('[data-tab-select]');
    if (tabSelect) {
      const incId = tabSelect.dataset.incId;
      const tabName = tabSelect.dataset.tabSelect;
      state.incidentActiveTabs[incId] = tabName;
      renderIncidentDetail(incId);
    }
    
    // Playbook checklist toggle listener
    const checkItem = event.target.closest('[data-playbook-check]');
    if (checkItem) {
      const incId = checkItem.dataset.incId;
      const idx = Number(checkItem.dataset.playbookCheck);
      state.playbooks[incId][idx].done = !state.playbooks[incId][idx].done;
      renderIncidentDetail(incId);
    }

    // Doc card select for RAG chunk mapping
    const docCard = event.target.closest('[data-document-card-id]');
    if (docCard) {
      const docId = docCard.dataset.documentCardId;
      selectDocumentForChunkMap(docId);
    }

    // Graph drawer toggler
    const toggleGraphDrawer = event.target.closest('#toggleGraphDrawerBtn');
    if (toggleGraphDrawer) {
      state.graphDrawerCollapsed = !state.graphDrawerCollapsed;
      applyGraphDrawerCollapseState();
    }

    const closeGraphDrawer = event.target.closest('#closeGraphDrawerBtn');
    if (closeGraphDrawer) {
      state.graphDrawerCollapsed = true;
      applyGraphDrawerCollapseState();
    }

    // Graph drawer tab selection
    const drawerTab = event.target.closest('.drawer-tab-btn');
    if (drawerTab) {
      const tab = drawerTab.dataset.tab;
      state.graphActiveTab = tab;
      $$('.drawer-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
      renderGraphDrawer();
    }

    // Clicking a node inside the Tactical Sidebar list zooms/centers onto it
    const drawerNodeItem = event.target.closest('[data-drawer-node-id]');
    if (drawerNodeItem) {
      const nodeId = drawerNodeItem.dataset.drawerNodeId;
      centerGraphOnNode(nodeId);
    }
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
  
  $('#graphSearchInput')?.addEventListener('input', event => {
    state.graphSearchQuery = event.target.value;
    renderGraphDrawer();
  });

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
    drawKpiSparklines();
    if (state.currentView === 'graph') renderGraphPage();
  });
}

async function boot() {
  initMockDb();
  applyTheme();
  setupEvents();
  showAppAuthed();
  
  await evaluateApiMode();
  
  if (state.token) {
    await refreshAll({ quiet: true });
  }
  toast('OmniSight Cockpit Active · Press Ctrl/⌘ K for commands');
}

boot();
