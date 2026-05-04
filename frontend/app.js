// TactiTrack — Command Operations System
// Real-time military dashboard with Dijkstra routing + WebSocket simulation

// ─── DATA ─────────────────────────────────────────────────────────────────

const UNITS = [
  { id: 'ALPHA-1', name: 'ALPHA-1', lat: 28.62, lng: 77.22, color: 'green',   shape: 'triangle', status: 'ACTIVE — Advancing',  statusClass: 'green',  personnel: 6,  callsign: 'Viper',   weapon: 'INSAS 1B1',  vehicle: 'BMP-II',     fuel: 82, ammo: 74, comms: 'SECURE' },
  { id: 'BRAVO-2', name: 'BRAVO-2', lat: 28.65, lng: 77.28, color: 'amber',   shape: 'square',   status: 'HOLDING — Perimeter', statusClass: 'amber',  personnel: 8,  callsign: 'Raptor',  weapon: 'AK-203',     vehicle: 'Tata LPTA',  fuel: 41, ammo: 60, comms: 'SECURE' },
  { id: 'CHARLIE-3', name: 'CHARLIE-3', lat: 28.59, lng: 77.30, color: 'red', shape: 'diamond',  status: 'CONTACT — Under fire', statusClass: 'red',   personnel: 5,  callsign: 'Ghost',   weapon: 'INSAS LMG',  vehicle: 'Foot patrol', fuel: 30, ammo: 28, comms: 'INTERMITTENT' },
  { id: 'DELTA-4', name: 'DELTA-4', lat: 28.67, lng: 77.25, color: 'green',   shape: 'circle',   status: 'STANDBY — Reserve',   statusClass: 'green',  personnel: 10, callsign: 'Hammer',  weapon: 'Carl Gustav', vehicle: 'T-90 Bhishma', fuel: 91, ammo: 85, comms: 'SECURE' },
  { id: 'ECHO-5',  name: 'ECHO-5',  lat: 28.64, lng: 77.18, color: 'purple', shape: 'star',     status: 'RECON — Moving',       statusClass: 'purple', personnel: 4,  callsign: 'Shadow',  weapon: 'Dragunov',   vehicle: 'Quad bike',  fuel: 67, ammo: 55, comms: 'DEGRADED' },
];

const ALERTS = [
  { type: 'red', badge: 'HIGH PRIORITY', title: '⚠ HOSTILE CONTACT', body: 'CHARLIE-3 engaging unknown hostiles. Grid 28.59N 77.30E. Requesting immediate backup and medevac.', time: '14:32:08 UTC' },
  { type: 'amber', badge: 'MEDIUM', title: '⚡ COMMS DEGRADED', body: 'ECHO-5 signal intermittent. Last confirmed position: 28.64N 77.18E. Attempting re-establish.', time: '14:29:41 UTC' },
  { type: 'green', badge: 'INFO', title: '✓ DELTA-4 READY', body: 'DELTA-4 T-90 Bhishma in position. Awaiting fire mission orders from command.', time: '14:25:00 UTC' },
];

const RESOURCES = [
  { label: 'AMMUNITION', val: 74, color: '#22c55e' },
  { label: 'FUEL SUPPLY', val: 41, color: '#f59e0b' },
  { label: 'MEDICAL KIT', val: 88, color: '#22c55e' },
  { label: 'RATIONS', val: 62, color: '#22c55e' },
  { label: 'COMMS GEAR', val: 55, color: '#f59e0b' },
];

// ─── DIJKSTRA GRAPH (unit adjacency with distances in km) ──────────────────

const GRAPH = {
  'ALPHA-1':   { 'BRAVO-2': 8, 'ECHO-5': 5, 'DELTA-4': 10 },
  'BRAVO-2':   { 'ALPHA-1': 8, 'CHARLIE-3': 6, 'DELTA-4': 4 },
  'CHARLIE-3': { 'BRAVO-2': 6, 'DELTA-4': 12 },
  'DELTA-4':   { 'ALPHA-1': 10, 'BRAVO-2': 4, 'CHARLIE-3': 12, 'ECHO-5': 14 },
  'ECHO-5':    { 'ALPHA-1': 5, 'DELTA-4': 14 },
};

function dijkstra(src, dst) {
  const dist = {}, prev = {}, visited = new Set();
  Object.keys(GRAPH).forEach(n => dist[n] = Infinity);
  dist[src] = 0;
  const queue = Object.keys(GRAPH);

  while (queue.length) {
    queue.sort((a, b) => dist[a] - dist[b]);
    const u = queue.shift();
    if (u === dst) break;
    visited.add(u);
    (Object.keys(GRAPH[u] || {})).forEach(v => {
      if (visited.has(v)) return;
      const alt = dist[u] + GRAPH[u][v];
      if (alt < dist[v]) { dist[v] = alt; prev[v] = u; }
    });
  }

  const path = []; let cur = dst;
  while (cur) { path.unshift(cur); cur = prev[cur]; }
  if (path[0] !== src) return null;
  return { path, dist: dist[dst] };
}

// ─── MAP SETUP ─────────────────────────────────────────────────────────────

let map, unitMarkers = {}, routeLayer = null, selectedUnit = null;
const missionStart = Date.now() - (4 * 3600 + 17 * 60 + 32) * 1000;

function initMap() {
  map = L.map('map', { zoomControl: false, attributionControl: false })
    .setView([28.63, 77.24], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
  }).addTo(map);

  map.on('mousemove', e => {
    document.getElementById('coordDisplay').textContent =
      `LAT ${e.latlng.lat.toFixed(4)}° N  ·  LON ${e.latlng.lng.toFixed(4)}° E`;
  });

  drawThreats();
  drawObjectives();
  drawUnits();
  connectUnits();
}

function makeIcon(unit) {
  const colors = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444', purple: '#a78bfa' };
  const c = colors[unit.color] || '#4ab8ff';
  const shapes = {
    triangle: `<polygon points="12,2 22,20 2,20" fill="${c}44" stroke="${c}" stroke-width="2"/>`,
    square:   `<rect x="2" y="2" width="20" height="20" fill="${c}44" stroke="${c}" stroke-width="2"/>`,
    diamond:  `<polygon points="12,1 22,12 12,23 2,12" fill="${c}44" stroke="${c}" stroke-width="2"/>`,
    circle:   `<circle cx="12" cy="12" r="10" fill="${c}44" stroke="${c}" stroke-width="2"/>`,
    star:     `<polygon points="12,2 14.5,9 22,9 16,14 18.5,22 12,17 5.5,22 8,14 2,9 9.5,9" fill="${c}44" stroke="${c}" stroke-width="2"/>`,
  };
  const pulse = unit.color === 'red' ? `<circle cx="12" cy="12" r="18" fill="none" stroke="${c}" stroke-width="1" opacity="0.4"><animate attributeName="r" from="12" to="22" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite"/></circle>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${pulse}${shapes[unit.shape]}</svg>`;
  return L.divIcon({
    className: '', html: svg, iconSize: [24, 24], iconAnchor: [12, 12]
  });
}

function drawUnits() {
  UNITS.forEach(u => {
    const marker = L.marker([u.lat, u.lng], { icon: makeIcon(u) })
      .addTo(map)
      .bindPopup(makePopup(u));
    marker.on('click', () => openUnitModal(u));
    unitMarkers[u.id] = marker;
  });
}

function makePopup(u) {
  const colors = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444', purple: '#a78bfa' };
  const c = colors[u.color];
  return `<div style="font-family:'Share Tech Mono',monospace;font-size:10px;min-width:140px">
    <div style="color:${c};font-weight:500;margin-bottom:4px">${u.name}</div>
    <div style="color:#6a8aaa">${u.status}</div>
    <div style="color:#3a5a7a;margin-top:2px">${u.lat.toFixed(4)}°N ${u.lng.toFixed(4)}°E</div>
  </div>`;
}

function drawThreats() {
  // Threat zone around CHARLIE-3
  L.circle([28.59, 77.30], {
    radius: 600, color: '#ef4444', fillColor: '#ef4444',
    fillOpacity: 0.08, weight: 1, dashArray: '5,5'
  }).addTo(map).bindTooltip('⚠ THREAT ZONE', { className: '', permanent: false });

  L.circle([28.615, 77.22], {
    radius: 400, color: '#f59e0b', fillColor: '#f59e0b',
    fillOpacity: 0.05, weight: 1, dashArray: '3,3'
  }).addTo(map).bindTooltip('WATCH ZONE', { className: '', permanent: false });
}

function drawObjectives() {
  const objectives = [
    { lat: 28.66, lng: 77.20, label: 'OBJ-ALPHA · NW RIDGE' },
    { lat: 28.61, lng: 77.33, label: 'OBJ-BRAVO · EAST FLANK' },
  ];
  objectives.forEach(o => {
    L.circle([o.lat, o.lng], {
      radius: 300, color: '#22c55e', fillColor: '#22c55e',
      fillOpacity: 0.07, weight: 1.5
    }).addTo(map);
    L.marker([o.lat, o.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="background:#0a1a10;border:1px solid #22c55e;color:#22c55e;font-family:'Share Tech Mono',monospace;font-size:8px;padding:2px 6px;white-space:nowrap;border-radius:2px">${o.label}</div>`,
        iconAnchor: [0, 0]
      })
    }).addTo(map);
  });
}

function connectUnits() {
  const latlngs = UNITS.map(u => [u.lat, u.lng]);
  Object.keys(GRAPH).forEach(fromId => {
    const from = UNITS.find(u => u.id === fromId);
    Object.keys(GRAPH[fromId]).forEach(toId => {
      const to = UNITS.find(u => u.id === toId);
      L.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
        color: '#1a3a5c', weight: 1, dashArray: '4,6', opacity: 0.5
      }).addTo(map);
    });
  });
}

// ─── UI RENDERERS ──────────────────────────────────────────────────────────

function renderUnits() {
  const el = document.getElementById('unitList');
  el.innerHTML = '';
  UNITS.forEach(u => {
    const card = document.createElement('div');
    card.className = `unit-card ${u.color} ${u.color === 'red' ? 'pulse-unit' : ''}`;
    card.id = `unit-${u.id}`;
    const shapes = { triangle: '▲', square: '■', diamond: '◆', circle: '●', star: '✦' };
    card.innerHTML = `
      <div class="unit-name">${shapes[u.shape]} ${u.name}</div>
      <div class="unit-meta">Grid ${u.lat.toFixed(2)}°N ${u.lng.toFixed(2)}°E · ${u.personnel} pers.</div>
      <div class="unit-status ${u.statusClass}">● ${u.status}</div>
    `;
    card.onclick = () => {
      document.querySelectorAll('.unit-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      map.setView([u.lat, u.lng], 15);
      unitMarkers[u.id].openPopup();
      selectedUnit = u.id;
    };
    el.appendChild(card);
  });

  // populate route selects
  ['routeFrom', 'routeTo'].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = `<option value="">${id === 'routeFrom' ? 'From' : 'To'} unit...</option>`;
    UNITS.forEach(u => sel.innerHTML += `<option value="${u.id}">${u.name}</option>`);
  });
}

function renderResources() {
  const el = document.getElementById('resourceList');
  el.innerHTML = RESOURCES.map(r => {
    const c = r.val > 70 ? '#22c55e' : r.val > 40 ? '#f59e0b' : '#ef4444';
    return `<div class="res-item">
      <div class="res-label"><span>${r.label}</span><span class="res-val">${r.val}%</span></div>
      <div class="res-bar"><div class="res-fill" style="width:${r.val}%;background:${c}"></div></div>
    </div>`;
  }).join('');
}

function renderAlerts() {
  const el = document.getElementById('alertList');
  el.innerHTML = ALERTS.map(a => `
    <div class="alert-card ${a.type}">
      <div class="alert-badge badge-${a.type}">${a.badge}</div>
      <div class="alert-title">${a.title}</div>
      <div class="alert-body">${a.body}</div>
      <div class="alert-time">${a.time}</div>
    </div>
  `).join('');
}

function renderMission() {
  document.getElementById('missionInfo').innerHTML = `
    <div class="mission-row">
      <div class="mission-label">OPERATION</div>
      <div class="mission-val">IRON SHIELD</div>
    </div>
    <div class="mission-row">
      <div class="mission-label">CURRENT PHASE</div>
      <div class="mission-val">Phase 2 — Advance</div>
    </div>
    <div class="mission-row">
      <div class="mission-label">PRIMARY OBJECTIVE</div>
      <div class="mission-val">Secure NW Ridge (OBJ-ALPHA)</div>
      <div class="mission-bar"><div class="mission-fill" style="width:55%;background:#f59e0b"></div></div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:8px;color:#6a8aaa;margin-top:3px">55% COMPLETE</div>
    </div>
    <div class="mission-row">
      <div class="mission-label">UNITS ACTIVE</div>
      <div class="mission-val">5 of 5</div>
    </div>
    <div class="mission-row">
      <div class="mission-label">COMMANDER</div>
      <div class="mission-val">Col. R.K. Sharma</div>
    </div>
  `;
}

function renderWeather() {
  const wx = [
    { label: 'CONDITIONS', val: 'Overcast' },
    { label: 'TEMPERATURE', val: '18°C' },
    { label: 'VISIBILITY', val: '6.2 km' },
    { label: 'WIND', val: 'NNE 14km/h' },
    { label: 'HUMIDITY', val: '72%' },
    { label: 'PRESSURE', val: '1012 hPa' },
  ];
  document.getElementById('weatherGrid').innerHTML = wx.map(w => `
    <div class="wx-item">
      <div class="wx-label">${w.label}</div>
      <div class="wx-val">${w.val}</div>
    </div>
  `).join('');
}

function renderThreatChart() {
  const hours = ['10H', '11H', '12H', '13H', '14H', 'NOW'];
  const vals =  [12,    8,     31,    24,    68,    91  ];
  document.getElementById('threatChart').innerHTML = hours.map((h, i) => {
    const pct = vals[i];
    const c = pct > 60 ? '#ef4444' : pct > 30 ? '#f59e0b' : '#22c55e';
    return `<div class="threat-bar-wrap">
      <div class="threat-bar-outer" style="height:60px">
        <div class="threat-bar-inner" style="height:${pct}%;background:${c}"></div>
      </div>
      <div class="threat-bar-label">${h}</div>
    </div>`;
  }).join('');
}

// ─── ROUTE FINDER ──────────────────────────────────────────────────────────

function findRoute() {
  const from = document.getElementById('routeFrom').value;
  const to   = document.getElementById('routeTo').value;
  const res  = document.getElementById('routeResult');

  if (!from || !to) { res.style.color='#ef4444'; res.textContent = 'Select both units.'; return; }
  if (from === to) { res.style.color='#f59e0b'; res.textContent = 'Same unit selected.'; return; }

  const result = dijkstra(from, to);
  if (!routeLayer) map.eachLayer(l => { if (l._routeLine) map.removeLayer(l); });
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }

  if (!result) {
    res.style.color = '#ef4444';
    res.textContent = 'NO ROUTE FOUND';
    return;
  }

  const coords = result.path.map(id => {
    const u = UNITS.find(u => u.id === id);
    return [u.lat, u.lng];
  });

  routeLayer = L.polyline(coords, {
    color: '#4ab8ff', weight: 2.5, dashArray: '6,3'
  }).addTo(map);
  routeLayer._routeLine = true;
  map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });

  res.style.color = '#22c55e';
  res.innerHTML = `ROUTE: ${result.path.join(' → ')}<br>DISTANCE: ${result.dist} km<br>ETA: ~${Math.round(result.dist * 4)} min`;
}

// ─── UNIT MODAL ────────────────────────────────────────────────────────────

function openUnitModal(u) {
  document.getElementById('modalTitle').textContent = `UNIT — ${u.name}`;
  const rows = [
    ['CALLSIGN', u.callsign], ['STATUS', u.status], ['PERSONNEL', u.personnel],
    ['POSITION', `${u.lat.toFixed(4)}°N ${u.lng.toFixed(4)}°E`],
    ['PRIMARY WEAPON', u.weapon], ['VEHICLE', u.vehicle],
    ['FUEL', `${u.fuel}%`], ['AMMUNITION', `${u.ammo}%`],
    ['COMMS STATUS', u.comms],
  ];
  document.getElementById('modalBody').innerHTML = rows.map(([k, v]) =>
    `<div class="modal-row"><span class="modal-key">${k}</span><span class="modal-val">${v}</span></div>`
  ).join('');
  document.getElementById('unitModal').classList.add('open');
}

function closeModal() {
  document.getElementById('unitModal').classList.remove('open');
}

// ─── CLOCKS ────────────────────────────────────────────────────────────────

function updateClocks() {
  const now = new Date();
  const h = String(now.getUTCHours()).padStart(2,'0');
  const m = String(now.getUTCMinutes()).padStart(2,'0');
  const s = String(now.getUTCSeconds()).padStart(2,'0');
  document.getElementById('utcClock').textContent = `${h}:${m}:${s}`;

  const elapsed = Math.floor((Date.now() - missionStart) / 1000);
  const eh = String(Math.floor(elapsed / 3600)).padStart(2,'0');
  const em = String(Math.floor((elapsed % 3600) / 60)).padStart(2,'0');
  const es = String(elapsed % 60).padStart(2,'0');
  document.getElementById('elapsedClock').textContent = `${eh}:${em}:${es}`;
}

// ─── REAL-TIME UNIT POSITION SIMULATION (mimics WebSocket/IoT GPS stream) ──

function simulateMovement() {
  UNITS.forEach(u => {
    if (u.statusClass === 'red') return;
    const drift = (Math.random() - 0.5) * 0.0008;
    const driftLng = (Math.random() - 0.5) * 0.0008;
    u.lat = parseFloat((u.lat + drift).toFixed(6));
    u.lng = parseFloat((u.lng + driftLng).toFixed(6));
    if (unitMarkers[u.id]) {
      unitMarkers[u.id].setLatLng([u.lat, u.lng]);
      unitMarkers[u.id].setPopupContent(makePopup(u));
    }
    const card = document.getElementById(`unit-${u.id}`);
    if (card) {
      card.querySelector('.unit-meta').textContent =
        `Grid ${u.lat.toFixed(2)}°N ${u.lng.toFixed(2)}°E · ${u.personnel} pers.`;
    }
  });
}

// ─── BOOT SEQUENCE ─────────────────────────────────────────────────────────

function boot() {
  const lines = [
    '> Initializing TactiTrack Command Ops System v2.4.1',
    '> Loading tactical grid data...',
    '> Establishing satellite uplink... [OK]',
    '> Syncing unit GPS beacons... [5/5 ONLINE]',
    '> Loading threat intelligence feed... [OK]',
    '> Running Dijkstra routing engine... [OK]',
    '> Connecting to WebSocket server: ws://tactitrack.ops:4000',
    '> Authentication: JWT TOKEN VALID',
    '> Establishing secure AES-256 channel... [OK]',
    '> All systems nominal. Launching dashboard.',
  ];

  const bootLines = document.getElementById('bootLines');
  const bootBar = document.getElementById('bootBar');
  let i = 0;

  function nextLine() {
    if (i < lines.length) {
      bootLines.innerHTML += lines[i] + '\n';
      bootLines.scrollTop = bootLines.scrollHeight;
      const pct = Math.round(((i + 1) / lines.length) * 100);
      bootBar.style.width = pct + '%';
      i++;
      setTimeout(nextLine, 200 + Math.random() * 200);
    } else {
      setTimeout(launch, 400);
    }
  }
  nextLine();
}

function launch() {
  document.getElementById('boot-screen').style.opacity = '0';
  document.getElementById('boot-screen').style.transition = 'opacity 0.5s';
  setTimeout(() => {
    document.getElementById('boot-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    initMap();
    renderUnits();
    renderResources();
    renderAlerts();
    renderMission();
    renderWeather();
    renderThreatChart();
    setInterval(updateClocks, 1000);
    setInterval(simulateMovement, 3000);
    updateClocks();
  }, 500);
}

boot();
