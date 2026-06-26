/* ================================================================
   CURVE MODEL
   ================================================================ */
const CurveModel = (() => {
  function _resp(t, rise, decay) {
    if (t <= 0 || rise <= 0 || decay <= 0) return 0;
    return (1 - Math.exp(-t / rise)) * Math.exp(-t / decay);
  }
  function peakTime(rise, decay) {
    if (rise <= 0 || decay <= 0) return 0;
    return rise * Math.log(1 + decay / rise);
  }
  function peakValue(rise, decay) {
    const tp = peakTime(rise, decay);
    return _resp(tp, rise, decay);
  }
  function evaluate(t, params) {
    const { rise, decay, amplitude, delay, duration } = params;
    const pv = peakValue(rise, decay);
    if (pv === 0) return 0;
    const tau = (t - delay) / duration;
    return (amplitude / pv) * _resp(tau, rise, decay);
  }
  function sample(params, n = 400, tMax = null) {
    const { rise, decay, delay, duration } = params;
    const tp = peakTime(rise, decay);
    const end = tMax !== null ? tMax : delay + duration * tp * 7;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * end;
      pts.push({ t, y: Math.max(0, evaluate(t, params)) });
    }
    return { pts, tEnd: end };
  }
  function naturalEnd(params) {
    const { rise, decay, delay, duration } = params;
    return delay + duration * (peakTime(rise, decay) * 7);
  }
  return { evaluate, sample, peakTime, peakValue, naturalEnd };
})();

/* ================================================================
   CHANNEL DEFINITIONS
   Each channel declares its display label, amplitude slider config,
   and how to serialise/deserialise its peak range in JSON.
   ================================================================ */
const CHANNELS = {
  voc:  {
    label: 'VOC',
    unit: '',
    ampMin: 0.01, ampMax: 1,    ampStep: 0.01, ampFmt: v => v.toFixed(2),
    decayMax: 1200,
    // serialize: returns the channel block given amplitude
    serialize: (rise, decay, amplitude) => ({
      rise, decay,
      peakRange: [+(amplitude * 0.85).toFixed(3), +(amplitude * 1.15).toFixed(3)],
    }),
    // deserialize: returns amplitude given a channel block
    deserialize: ch => ch.peakRange ? (ch.peakRange[0] + ch.peakRange[1]) / 2 : 0.7,
  },
  co2:  {
    label: 'CO₂',
    unit: 'ppm',
    ampMin: 1,    ampMax: 2000, ampStep: 1,    ampFmt: v => Math.round(v) + ' ppm',
    decayMax: 7200,
    serialize: (rise, decay, amplitude) => ({
      rise, decay,
      peakRange: [+(amplitude * 0.85).toFixed(1), +(amplitude * 1.15).toFixed(1)],
    }),
    deserialize: ch => ch.peakRange ? (ch.peakRange[0] + ch.peakRange[1]) / 2 : 150,
  },
  pm1:  {
    label: 'PM1',
    unit: 'µg/m³',
    ampMin: 0.1,  ampMax: 500,  ampStep: 0.1,  ampFmt: v => v.toFixed(1) + ' µg/m³',
    decayMax: 7200,
    serialize: (rise, decay, amplitude) => ({
      rise, decay,
      pm1Range: [+(amplitude * 0.85).toFixed(1), +(amplitude * 1.15).toFixed(1)],
    }),
    deserialize: ch => ch.pm1Range ? (ch.pm1Range[0] + ch.pm1Range[1]) / 2 : 20,
  },
  pm25: {
    label: 'PM2.5',
    unit: 'µg/m³',
    ampMin: 0.1,  ampMax: 500,  ampStep: 0.1,  ampFmt: v => v.toFixed(1) + ' µg/m³',
    decayMax: 7200,
    serialize: (rise, decay, amplitude) => ({
      rise, decay,
      pm25Range: [+(amplitude * 0.85).toFixed(1), +(amplitude * 1.15).toFixed(1)],
    }),
    deserialize: ch => ch.pm25Range ? (ch.pm25Range[0] + ch.pm25Range[1]) / 2 : 40,
  },
  pm10: {
    label: 'PM10',
    unit: 'µg/m³',
    ampMin: 0.1,  ampMax: 500,  ampStep: 0.1,  ampFmt: v => v.toFixed(1) + ' µg/m³',
    decayMax: 7200,
    serialize: (rise, decay, amplitude) => ({
      rise, decay,
      pm10Range: [+(amplitude * 0.85).toFixed(1), +(amplitude * 1.15).toFixed(1)],
    }),
    deserialize: ch => ch.pm10Range ? (ch.pm10Range[0] + ch.pm10Range[1]) / 2 : 50,
  },
};

/* ================================================================
   PROFILES & GROUPS
   ================================================================ */
const COLORS = ['#4f8ef7','#3ecf8e','#f5a623','#f76f6f','#a78bfa','#2dd4bf','#f472b6','#94a3b8'];

// Group presets: each entry is an event name → { channel: params, ... }
// The amplitude for PM/CO2 channels is in physical units.
const GROUP_PRESETS = {
  cooking: {
    voc:  { rise: 15,  decay: 120,  amplitude: 0.85, delay: 5,  duration: 1.2 },
    co2:  { rise: 300, decay: 2400, amplitude: 150,  delay: 10, duration: 1.5 },
    pm1:  { rise: 45,  decay: 1200, amplitude: 50,   delay: 5,  duration: 1.0 },
    pm25: { rise: 45,  decay: 1200, amplitude: 95,   delay: 5,  duration: 1.0 },
    pm10: { rise: 45,  decay: 1200, amplitude: 115,  delay: 5,  duration: 1.0 },
  },
  traffic: {
    voc:  { rise: 90,  decay: 600,  amplitude: 0.35, delay: 20, duration: 2.0 },
    co2:  { rise: 180, decay: 1800, amplitude: 80,   delay: 20, duration: 2.0 },
    pm25: { rise: 120, decay: 900,  amplitude: 35,   delay: 20, duration: 2.0 },
    pm10: { rise: 120, decay: 900,  amplitude: 55,   delay: 20, duration: 2.0 },
  },
  occupant: {
    voc:  { rise: 30,  decay: 900,  amplitude: 0.55, delay: 0,  duration: 1.0 },
    co2:  { rise: 60,  decay: 3600, amplitude: 200,  delay: 0,  duration: 1.0 },
  },
  pedestrian: {
    voc:  { rise: 8,   decay: 60,   amplitude: 0.70, delay: 2,  duration: 0.7 },
    pm1:  { rise: 10,  decay: 90,   amplitude: 12,   delay: 2,  duration: 0.7 },
    pm25: { rise: 10,  decay: 90,   amplitude: 25,   delay: 2,  duration: 0.7 },
  },
  fragrance: {
    voc:  { rise: 5,   decay: 300,  amplitude: 0.95, delay: 0,  duration: 1.5 },
  },
  vacuum: {
    voc:  { rise: 20,  decay: 180,  amplitude: 0.055,delay: 0,  duration: 1.0 },
    pm1:  { rise: 60,  decay: 600,  amplitude: 12,   delay: 0,  duration: 1.0 },
    pm25: { rise: 60,  decay: 600,  amplitude: 25,   delay: 0,  duration: 1.0 },
    pm10: { rise: 60,  decay: 600,  amplitude: 37,   delay: 0,  duration: 1.0 },
  },
};

// Single-channel presets (legacy / for individual profiles)
const PRESETS = {
  cooking:    GROUP_PRESETS.cooking.voc,
  traffic:    GROUP_PRESETS.traffic.voc,
  occupant:   GROUP_PRESETS.occupant.voc,
  pedestrian: GROUP_PRESETS.pedestrian.voc,
  fragrance:  GROUP_PRESETS.fragrance.voc,
};

const PARAM_DEFS = [
  { key: 'rise',      label: 'Rise',      min: 1,   max: 300,  step: 1,    fmt: v => Math.round(v) + 's'  },
  { key: 'decay',     label: 'Decay',     min: 1,   max: 1200, step: 1,    fmt: v => Math.round(v) + 's'  },
  { key: 'amplitude', label: 'Amplitude', min: 0.01,max: 1,    step: 0.01, fmt: v => v.toFixed(2)          },
  { key: 'delay',     label: 'Delay',     min: 0,   max: 300,  step: 0.5,  fmt: v => v.toFixed(1) + 's'   },
  { key: 'duration',  label: 'Duration',  min: 0.1, max: 5,    step: 0.05, fmt: v => v.toFixed(2) + '×'   },
];

let profiles  = [];
let groups    = [];   // [{ id, name }]
let activeId  = null;
let _colorIdx = 0;

/* ── Display mode ── */
let displayMode = 'realtime';
const ABS_T_MAX = 1200;

function setDisplayMode(mode) {
  displayMode = mode;
  document.querySelectorAll('input[name="dispmode"]').forEach(r => { r.checked = r.value === mode; });
  const mSel = document.getElementById('mobile-mode-select');
  if (mSel) mSel.value = mode;
  zt = d3.zoomIdentity;
  if (zoomBehavior) d3.select('#gsvg').call(zoomBehavior.transform, d3.zoomIdentity);
  render();
}

function mkProfile(name, params, channel, groupId) {
  const ch = channel || 'voc';
  const chDef = CHANNELS[ch];
  return {
    id:      Math.random().toString(36).slice(2),
    name:    name || 'profile',
    visible: true,
    color:   COLORS[_colorIdx++ % COLORS.length],
    channel: ch,
    groupId: groupId || null,
    params:  {
      rise: 30, decay: 200,
      amplitude: chDef ? (chDef.ampMax * 0.7) : 0.7,
      delay: 0, duration: 1,
      ...params
    },
  };
}

function mkGroup(name) {
  return { id: Math.random().toString(36).slice(2), name: name || 'group' };
}

function activeProfile() { return profiles.find(p => p.id === activeId) || null; }

function setActive(id) {
  activeId = id;
  const p = activeProfile();
  if (p) {
    document.getElementById('profile-name-input').value = p.name;
    syncSliders(p.params, p.channel);
    syncChannelSelect(p.channel);
    syncGroupSelect(p.groupId);
  }
  renderProfileList();
  render();
}

/* ================================================================
   SLIDERS — channel-aware
   ================================================================ */
function buildSliders() {
  const c = document.getElementById('sliders');
  c.innerHTML = '';
  PARAM_DEFS.forEach(def => {
    const row = document.createElement('div');
    row.className = 'srow';
    row.innerHTML = `
      <label>${def.label}</label>
      <input type="range" id="sl-${def.key}" min="${def.min}" max="${def.max}" step="${def.step}">
      <span class="sval" id="sv-${def.key}">—</span>`;
    row.querySelector('input').addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      const p = activeProfile();
      if (!p) return;
      p.params[def.key] = val;
      // Use channel-specific amplitude formatter if this is the amp slider
      const fmt = (def.key === 'amplitude' && CHANNELS[p.channel])
        ? CHANNELS[p.channel].ampFmt
        : def.fmt;
      document.getElementById('sv-' + def.key).textContent = fmt(val);
      render();
    });
    c.appendChild(row);
  });
}

function syncSliders(params, channel) {
  const chDef = CHANNELS[channel] || {};
  PARAM_DEFS.forEach(def => {
    const el = document.getElementById('sl-' + def.key);
    const sv = document.getElementById('sv-' + def.key);
    if (!el || !sv) return;
    // Override amplitude slider range per channel
    if (def.key === 'amplitude' && chDef.ampMin != null) {
      el.min  = chDef.ampMin;
      el.max  = chDef.ampMax;
      el.step = chDef.ampStep;
    } else if (def.key === 'amplitude') {
      el.min = 0.01; el.max = 1; el.step = 0.01;
    }
    // Override decay max per channel
    if (def.key === 'decay' && chDef.decayMax) {
      el.max = chDef.decayMax;
    } else if (def.key === 'decay') {
      el.max = 1200;
    }
    el.value = params[def.key];
    const fmt = (def.key === 'amplitude' && chDef.ampFmt) ? chDef.ampFmt : def.fmt;
    sv.textContent = fmt(params[def.key]);
  });
}

function onNameChange(val) {
  const p = activeProfile();
  if (p) { p.name = val; renderProfileList(); }
}

function onChannelChange(val) {
  const p = activeProfile();
  if (!p) return;
  const prevCh = CHANNELS[p.channel];
  const newCh  = CHANNELS[val];
  if (!newCh) return;
  p.channel = val;
  // Rescale amplitude to the new channel's range proportionally
  if (prevCh) {
    const ratio = (p.params.amplitude - prevCh.ampMin) / (prevCh.ampMax - prevCh.ampMin);
    p.params.amplitude = newCh.ampMin + ratio * (newCh.ampMax - newCh.ampMin);
    p.params.amplitude = Math.max(newCh.ampMin, Math.min(newCh.ampMax, +p.params.amplitude.toFixed(3)));
  }
  // Update decay max clamp
  if (p.params.decay > newCh.decayMax) p.params.decay = newCh.decayMax;
  syncSliders(p.params, p.channel);
  render();
}

/* ================================================================
   GROUP MANAGEMENT
   ================================================================ */
function addGroup(name) {
  const g = mkGroup(name);
  groups.push(g);
  renderGroupSelect();
  renderProfileList();
  return g;
}

function renameGroup(id, name) {
  const g = groups.find(g => g.id === id);
  if (g) { g.name = name; renderProfileList(); renderGroupSelect(); }
}

function delGroup(id) {
  // Unassign all profiles in this group
  profiles.forEach(p => { if (p.groupId === id) p.groupId = null; });
  groups = groups.filter(g => g.id !== id);
  renderGroupSelect();
  renderProfileList();
  const p = activeProfile();
  if (p) syncGroupSelect(p.groupId);
}

function renderGroupSelect() {
  const sel = document.getElementById('group-select');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— none —</option>';
  groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id; opt.textContent = g.name;
    sel.appendChild(opt);
  });
  sel.value = current;
}

function syncGroupSelect(groupId) {
  const sel = document.getElementById('group-select');
  if (sel) sel.value = groupId || '';
}

/* ================================================================
   PROFILE LIST UI
   ================================================================ */
function renderProfileList() {
  const list = document.getElementById('plist');
  list.innerHTML = '';

  // Collect grouped and ungrouped
  const grouped   = {};
  const ungrouped = [];
  profiles.forEach(p => {
    if (p.groupId) {
      if (!grouped[p.groupId]) grouped[p.groupId] = [];
      grouped[p.groupId].push(p);
    } else {
      ungrouped.push(p);
    }
  });

  // Render groups first
  groups.forEach(g => {
    const gps = grouped[g.id] || [];

    const header = document.createElement('div');
    header.className = 'pgroup-header';
    header.innerHTML = `
      <span class="pgroup-label">${escHtml(g.name)}</span>
      <button class="pibtn pibtn-sm" title="Export group JSON"
        onclick="event.stopPropagation();exportGroupJSON('${g.id}')">↓ JSON</button>
      <button class="pibtn pibtn-sm" title="Delete group"
        onclick="event.stopPropagation();delGroup('${g.id}')">✕</button>`;
    list.appendChild(header);

    if (gps.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pgroup-empty';
      empty.textContent = 'No profiles in this group';
      list.appendChild(empty);
    } else {
      gps.forEach(p => list.appendChild(makeProfileItem(p)));
    }
  });

  // Ungrouped section header only if there are also groups
  if (groups.length > 0 && ungrouped.length > 0) {
    const sep = document.createElement('div');
    sep.className = 'pgroup-header pgroup-header--ungrouped';
    sep.innerHTML = '<span class="pgroup-label">Individual</span>';
    list.appendChild(sep);
  }

  ungrouped.forEach(p => list.appendChild(makeProfileItem(p)));
}

function makeProfileItem(p) {
  const chDef = CHANNELS[p.channel] || {};
  const item = document.createElement('div');
  item.className = 'pi' + (p.id === activeId ? ' active' : '');
  item.innerHTML = `
    <div class="pswatch" style="background:${p.color}"></div>
    <div class="pname"><input value="${escHtml(p.name)}"
      onclick="event.stopPropagation()"
      onchange="renameProfile('${p.id}',this.value)"></div>
    <span class="pch-tag" style="color:${p.color}">${chDef.label || p.channel}</span>
    <button class="pibtn" title="${p.visible ? 'Hide' : 'Show'}"
      onclick="event.stopPropagation();toggleVis('${p.id}')">${p.visible ? '●' : '○'}</button>
    <button class="pibtn" title="Duplicate"
      onclick="event.stopPropagation();dupProfile('${p.id}')">⧉</button>
    <button class="pibtn" title="Delete"
      onclick="event.stopPropagation();delProfile('${p.id}')">✕</button>`;
  item.addEventListener('click', () => setActive(p.id));
  return item;
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function addProfile(params, name, channel, groupId) {
  const p = mkProfile(name || `profile ${profiles.length + 1}`, params, channel, groupId);
  profiles.push(p);
  setActive(p.id);
}

function dupProfile(id) {
  const src = profiles.find(p => p.id === id);
  if (!src) return;
  const p = mkProfile(src.name + ' copy', { ...src.params }, src.channel, src.groupId);
  profiles.push(p);
  setActive(p.id);
}

function delProfile(id) {
  if (profiles.length <= 1) return;
  const idx = profiles.findIndex(p => p.id === id);
  profiles = profiles.filter(p => p.id !== id);
  setActive(profiles[Math.min(idx, profiles.length - 1)].id);
}

function renameProfile(id, name) {
  const p = profiles.find(p => p.id === id);
  if (!p) return;
  p.name = name;
  if (p.id === activeId) document.getElementById('profile-name-input').value = name;
  renderProfileList();
}

function toggleVis(id) {
  const p = profiles.find(p => p.id === id);
  if (p) { p.visible = !p.visible; renderProfileList(); render(); }
}

function loadPreset(key) {
  if (!key) return;
  const groupDef = GROUP_PRESETS[key];
  if (!groupDef) return;

  const channelKeys = Object.keys(groupDef);

  if (channelKeys.length === 1) {
    // Single-channel preset — load into active profile
    const p = activeProfile();
    if (!p) return;
    const ch = channelKeys[0];
    p.params  = { ...groupDef[ch] };
    p.channel = ch;
    p.name    = key;
    document.getElementById('profile-name-input').value = key;
    syncSliders(p.params, p.channel);
    syncChannelSelect(p.channel);
    renderProfileList();
    render();
  } else {
    // Multi-channel preset — create a group with one profile per channel
    const g = addGroup(key);
    channelKeys.forEach((ch, i) => {
      addProfile({ ...groupDef[ch] }, `${key} · ${CHANNELS[ch]?.label || ch}`, ch, g.id);
    });
    renderProfileList();
  }

  document.getElementById('preset-select').value = '';
}

/* ================================================================
   GRAPH
   ================================================================ */
const M = { top: 32, right: 28, bottom: 52, left: 58 };
let gRoot, gGrid, gAxes, gCurves;
let xBase, yBase;
let zt = d3.zoomIdentity;
let zoomBehavior;

function dims() {
  const el = document.getElementById('gwrap');
  const W = el.clientWidth  || el.offsetWidth  || 800;
  const H = el.clientHeight || el.offsetHeight || 500;
  return { W, H, iW: W - M.left - M.right, iH: H - M.top - M.bottom };
}

function initGraph() {
  const { W, H, iW, iH } = dims();
  if (iW <= 0 || iH <= 0) return;

  const svg = d3.select('#gsvg');
  svg.selectAll('*').remove();

  svg.append('defs').append('clipPath').attr('id','pclip')
    .append('rect').attr('width', iW).attr('height', iH);

  gRoot   = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);
  gGrid   = gRoot.append('g');
  gAxes   = gRoot.append('g');
  gCurves = gRoot.append('g').attr('clip-path','url(#pclip)');

  xBase = d3.scaleLinear().domain([0, 600]).range([0, iW]);
  yBase = d3.scaleLinear().domain([0, 1.1]).range([iH, 0]);

  zoomBehavior = d3.zoom()
    .scaleExtent([0.2, 30])
    .on('zoom', e => { zt = e.transform; render(); });
  svg.call(zoomBehavior).on('dblclick.zoom', null);

  render();
}

function render() {
  if (!gCurves) return;
  const { iW, iH } = dims();
  if (iW <= 0 || iH <= 0) return;

  const visible = profiles.filter(p => p.visible);
  let xDomain, yDomain, xLabel, yLabel;

  if (displayMode === 'normalized') {
    xDomain = [0, 1];         yDomain = [0, 1.08];
    xLabel  = 'Normalised time (τ)'; yLabel = 'Normalised amplitude';
  } else if (displayMode === 'absolute') {
    xDomain = [0, ABS_T_MAX]; yDomain = [0, 1.08];
    xLabel  = 'Time (seconds) — fixed scale'; yLabel = 'Response amplitude';
  } else {
    const tMax = visible.length
      ? Math.max(...visible.map(p => CurveModel.naturalEnd(p.params)))
      : 600;
    xDomain = [0, tMax]; yDomain = [0, 1.08];
    xLabel  = 'Time (seconds)'; yLabel = 'Response amplitude';
  }

  xBase.domain(xDomain).range([0, iW]);
  yBase.domain(yDomain).range([iH, 0]);

  const xs = zt.rescaleX(xBase);
  const ys = yBase;

  drawGrid(xs, ys, iW, iH);
  drawAxes(xs, ys, iW, iH, xLabel, yLabel);
  drawCurves(visible, xs, ys);
  updateStatus();
}

function drawGrid(xs, ys, iW, iH) {
  gGrid.selectAll('*').remove();
  xs.ticks(10).forEach(t => {
    const x = xs(t);
    if (isNaN(x)) return;
    gGrid.append('line').attr('class','grid-line')
      .attr('x1',x).attr('x2',x).attr('y1',0).attr('y2',iH);
  });
  ys.ticks(8).forEach(t => {
    const y = ys(t);
    if (isNaN(y)) return;
    gGrid.append('line').attr('class','grid-line')
      .attr('x1',0).attr('x2',iW).attr('y1',y).attr('y2',y);
  });
}

function drawAxes(xs, ys, iW, iH, xLabel, yLabel) {
  gAxes.selectAll('*').remove();
  gAxes.append('line').attr('class','axis-line').attr('x1',0).attr('x2',iW).attr('y1',iH).attr('y2',iH);
  gAxes.append('line').attr('class','axis-line').attr('x1',0).attr('x2',0).attr('y1',0).attr('y2',iH);
  const xFmt = displayMode === 'normalized' ? t => t.toFixed(2) + 'τ' : t => t + 's';
  xs.ticks(8).forEach(t => {
    const x = xs(t);
    if (isNaN(x)) return;
    gAxes.append('text').attr('class','alabel')
      .attr('x',x).attr('y',iH+16).attr('text-anchor','middle').text(xFmt(t));
  });
  gAxes.append('text').attr('class','alabel')
    .attr('x',iW/2).attr('y',iH+40).attr('text-anchor','middle')
    .attr('fill','#9aa3b8').text(xLabel);
  const yFmt = displayMode === 'normalized' ? t => t.toFixed(1) : t => t.toFixed(2);
  ys.ticks(6).forEach(t => {
    const y = ys(t);
    if (isNaN(y)) return;
    gAxes.append('text').attr('class','alabel')
      .attr('x',-8).attr('y',y+4).attr('text-anchor','end').text(yFmt(t));
  });
  gAxes.append('text').attr('class','alabel')
    .attr('transform',`rotate(-90) translate(${-iH/2},-44)`)
    .attr('text-anchor','middle').attr('fill','#9aa3b8').text(yLabel);
}

// In real-time / absolute modes, normalise each curve's Y to [0,1] for display
// so that all channels can coexist on the same axis (like normalized mode but
// preserving real time offsets and durations).
function transformPoints(pts, p) {
  const { rise, decay, amplitude, delay, duration } = p.params;
  if (displayMode === 'normalized') {
    const tp     = CurveModel.peakTime(rise, decay);
    const tauEnd = tp * 7;
    return pts.map(d => {
      const tau = (d.t - delay) / duration;
      const xN  = tauEnd > 0 ? tau / tauEnd : 0;
      const yN  = amplitude > 0 ? d.y / amplitude : 0;
      return { t: xN, y: yN };
    });
  }
  // For real-time and absolute: normalise Y by amplitude so all channels fit [0,1]
  return pts.map(d => ({ t: d.t, y: amplitude > 0 ? d.y / amplitude : 0 }));
}

function drawCurves(visible, xs, ys) {
  gCurves.selectAll('*').remove();
  const tMax      = xBase.domain()[1];
  const sampleEnd = displayMode === 'normalized' ? null : tMax;

  visible.forEach(p => {
    const { pts } = CurveModel.sample(p.params, 500, sampleEnd);
    const tpts    = transformPoints(pts, p);

    const line = d3.line()
      .x(d => xs(d.t)).y(d => ys(d.y))
      .defined(d => !isNaN(xs(d.t)) && !isNaN(ys(d.y)))
      .curve(d3.curveCatmullRom.alpha(0.5));

    const area = d3.area()
      .x(d => xs(d.t)).y0(ys(0)).y1(d => ys(d.y))
      .defined(d => !isNaN(xs(d.t)) && !isNaN(ys(d.y)))
      .curve(d3.curveCatmullRom.alpha(0.5));

    const areaD = area(tpts);
    const lineD = line(tpts);
    if (areaD) gCurves.append('path').attr('class','curve-area').attr('d',areaD).attr('fill',p.color);
    if (lineD) gCurves.append('path').attr('class','curve-path').attr('d',lineD)
      .attr('stroke',p.color).attr('opacity',p.id === activeId ? 1 : 0.5);

    // Label near peak
    const { rise, decay, amplitude, delay, duration } = p.params;
    const tp = CurveModel.peakTime(rise, decay);
    let labelX, labelY;
    if (displayMode === 'normalized') {
      const tauEnd = tp * 7;
      labelX = xs(tauEnd > 0 ? tp / tauEnd : 0.15);
      labelY = ys(1.0) - 10;
    } else {
      labelX = xs(delay + duration * tp);
      labelY = ys(1.0) - 10;   // amplitude is always normalised to 1.0 now
    }
    if (!isNaN(labelX) && !isNaN(labelY)) {
      const chDef = CHANNELS[p.channel];
      const tag   = chDef ? chDef.label : p.channel.toUpperCase();
      gCurves.append('text')
        .attr('x',labelX).attr('y',labelY)
        .attr('text-anchor','middle').attr('font-size',10)
        .attr('fill',p.color).attr('opacity',0.75)
        .text(`${p.name} (${tag})`);
    }
  });
}

/* ── Status bar ── */
const MODE_LABELS = { normalized:'Normalised', realtime:'Real-time', absolute:'Absolute' };
function updateStatus() {
  const p = activeProfile();
  const badge = document.getElementById('s-mode-badge');
  if (badge) badge.textContent = MODE_LABELS[displayMode] || displayMode;
  if (!p) return;
  const { rise, decay, amplitude, delay, duration } = p.params;
  const tp    = CurveModel.peakTime(rise, decay);
  const peakT = delay + duration * tp;
  const t10   = tp + decay * Math.log(10);
  const d10   = delay + duration * t10;
  const chDef = CHANNELS[p.channel] || {};
  const ampFmt = chDef.ampFmt || (v => v.toFixed(3));
  document.getElementById('s-peak').textContent = ampFmt(amplitude);
  document.getElementById('s-ttp').textContent  = peakT.toFixed(1) + 's';
  document.getElementById('s-d10').textContent  = d10.toFixed(1)   + 's';
}

/* ================================================================
   EXPORT / IMPORT
   ================================================================ */

// Serialise a single profile into the channel block used in JSON
function serializeProfile(p) {
  const { rise, decay, amplitude, delay, duration } = p.params;
  const chDef = CHANNELS[p.channel];
  if (!chDef) return null;
  return {
    channelBlock: chDef.serialize(rise, decay, amplitude),
    meta: { delay, duration, amplitude },
    channelKey: p.channel,
  };
}

function exportJSON() {
  const p = activeProfile();
  if (!p) return;
  const s = serializeProfile(p);
  if (!s) return;
  const out = {
    name: p.name,
    [s.channelKey]: s.channelBlock,
    meta: s.meta,
  };
  dl(JSON.stringify(out, null, 2), p.name + '.json', 'application/json');
}

function exportGroupJSON(groupId) {
  const g = groups.find(g => g.id === groupId);
  if (!g) return;
  const members = profiles.filter(p => p.groupId === groupId);
  if (members.length === 0) return;

  // Build the event object: { [groupName]: { voc: {...}, co2: {...}, pm: {...} } }
  // PM channels are merged into a single "pm" block with pm1Range/pm25Range/pm10Range
  const channelBlocks = {};
  const pmBlock = {};
  let hasPm = false;

  members.forEach(p => {
    const { rise, decay, amplitude } = p.params;
    const chDef = CHANNELS[p.channel];
    if (!chDef) return;

    if (['pm1','pm25','pm10'].includes(p.channel)) {
      // Merge PM channels: share rise/decay from first encountered, merge ranges
      if (!pmBlock.rise) { pmBlock.rise = rise; pmBlock.decay = decay; }
      const rangeKey = p.channel === 'pm1'  ? 'pm1Range'
                     : p.channel === 'pm25' ? 'pm25Range'
                     :                        'pm10Range';
      pmBlock[rangeKey] = [+(amplitude * 0.85).toFixed(1), +(amplitude * 1.15).toFixed(1)];
      hasPm = true;
    } else {
      channelBlocks[p.channel] = chDef.serialize(rise, decay, amplitude);
    }
  });

  if (hasPm) channelBlocks['pm'] = pmBlock;

  // Also store meta for each member so round-trip import works
  const metaBlocks = {};
  members.forEach(p => {
    const { delay, duration, amplitude } = p.params;
    metaBlocks[p.channel] = { delay, duration, amplitude };
  });

  const out = {
    [g.name]: {
      ...channelBlocks,
      _meta: metaBlocks,
    }
  };

  dl(JSON.stringify(out, null, 2), g.name + '.json', 'application/json');
}

function importJSON() { document.getElementById('import-file').click(); }

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      importData(data);
    } catch (err) { alert('Could not parse JSON: ' + err.message); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function importData(data) {
  // Detect format:
  // 1. Legacy single-profile: { name, voc|co2|pm, meta }
  // 2. Group export:          { [eventName]: { voc?, co2?, pm?, _meta? } }

  const keys = Object.keys(data);

  // If it has a direct channel key at top level → legacy / single profile
  const directChannels = ['voc','co2','pm','pm1','pm25','pm10'];
  const hasDirectChannel = keys.some(k => directChannels.includes(k));

  if (hasDirectChannel || data.meta) {
    importSingleProfile(data, data.name || 'imported');
    return;
  }

  // Otherwise assume it's a group export: first key is the event name
  const eventName = keys[0];
  if (!eventName) return;
  const eventData = data[eventName];
  if (typeof eventData !== 'object') return;

  importGroupData(eventName, eventData);
}

function importSingleProfile(data, name) {
  // Try each known channel key
  let ch = null, chBlock = null;
  for (const key of ['voc','co2','pm1','pm25','pm10']) {
    if (data[key]) { ch = key; chBlock = data[key]; break; }
  }
  // Legacy: data.pm → treat as pm25 (best guess)
  if (!ch && data.pm) {
    ch = 'pm25';
    chBlock = data.pm;
  }
  if (!ch) { ch = 'voc'; chBlock = {}; }

  const chDef = CHANNELS[ch] || CHANNELS.voc;
  const meta  = data.meta || {};
  const amplitude = meta.amplitude != null
    ? meta.amplitude
    : chDef.deserialize(chBlock || {});

  const params = {
    rise:      chBlock?.rise  || 30,
    decay:     chBlock?.decay || 200,
    amplitude,
    delay:     meta.delay    || 0,
    duration:  meta.duration || 1,
  };
  addProfile(params, name, ch, null);
}

function importGroupData(eventName, eventData) {
  const g = addGroup(eventName);
  const meta = eventData._meta || {};

  // Expand pm block into individual pm1/pm25/pm10 if present
  const channelsToImport = [];

  Object.entries(eventData).forEach(([key, val]) => {
    if (key === '_meta') return;
    if (key === 'pm') {
      // Expand compound pm block
      const pmMeta = meta['pm'] || {};
      ['pm1','pm25','pm10'].forEach(pmKey => {
        const rangeKey = pmKey === 'pm1' ? 'pm1Range' : pmKey === 'pm25' ? 'pm25Range' : 'pm10Range';
        if (val[rangeKey]) {
          channelsToImport.push({
            ch: pmKey,
            block: { rise: val.rise, decay: val.decay, [rangeKey]: val[rangeKey] },
            m: pmMeta,
          });
        }
      });
    } else if (CHANNELS[key]) {
      channelsToImport.push({ ch: key, block: val, m: meta[key] || {} });
    }
  });

  channelsToImport.forEach(({ ch, block, m }) => {
    const chDef = CHANNELS[ch] || CHANNELS.voc;
    const amplitude = m.amplitude != null ? m.amplitude : chDef.deserialize(block);
    const params = {
      rise:      block.rise  || 30,
      decay:     block.decay || 200,
      amplitude,
      delay:     m.delay    || 0,
      duration:  m.duration || 1,
    };
    addProfile(params, `${eventName} · ${chDef.label}`, ch, g.id);
  });

  renderProfileList();
}

function exportSVG() {
  const { W, H, iW, iH } = dims();
  const visible = profiles.filter(p => p.visible);
  const tMax    = visible.length ? Math.max(...visible.map(p => CurveModel.naturalEnd(p.params))) : 600;
  const xs      = d3.scaleLinear().domain([0, tMax]).range([0, iW]);
  const ys      = d3.scaleLinear().domain([0, 1.1]).range([iH, 0]);

  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="background:#0d0f12">`;
  s += `<g transform="translate(${M.left},${M.top})">`;
  xs.ticks(10).forEach(t => {
    s += `<line x1="${xs(t).toFixed(1)}" x2="${xs(t).toFixed(1)}" y1="0" y2="${iH}" stroke="#1e2330" stroke-width="0.5"/>`;
  });
  ys.ticks(8).forEach(t => {
    s += `<line x1="0" x2="${iW}" y1="${ys(t).toFixed(1)}" y2="${ys(t).toFixed(1)}" stroke="#1e2330" stroke-width="0.5"/>`;
  });
  s += `<line x1="0" x2="${iW}" y1="${iH}" y2="${iH}" stroke="#3a4258"/>`;
  s += `<line x1="0" x2="0" y1="0" y2="${iH}" stroke="#3a4258"/>`;
  xs.ticks(8).forEach(t => {
    s += `<text x="${xs(t).toFixed(1)}" y="${iH+16}" text-anchor="middle" font-size="11" fill="#5a6278" font-family="sans-serif">${t}s</text>`;
  });
  ys.ticks(6).forEach(t => {
    s += `<text x="-8" y="${(ys(t)+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#5a6278" font-family="sans-serif">${t.toFixed(2)}</text>`;
  });
  visible.forEach(p => {
    const { pts } = CurveModel.sample(p.params, 300, tMax);
    const { amplitude } = p.params;
    // Normalise Y for display consistency
    const normPts = pts.map(pt => ({ t: pt.t, y: amplitude > 0 ? pt.y / amplitude : 0 }));
    const d = normPts.map((pt,i) => `${i===0?'M':'L'}${xs(pt.t).toFixed(2)},${ys(pt.y).toFixed(2)}`).join(' ');
    s += `<path d="${d}" fill="none" stroke="${p.color}" stroke-width="2" stroke-linecap="round"/>`;
    const tp  = CurveModel.peakTime(p.params.rise, p.params.decay);
    const ptx = xs(p.params.delay + p.params.duration * tp);
    const pty = ys(1.0) - 9;
    const chLabel = CHANNELS[p.channel]?.label || p.channel.toUpperCase();
    s += `<text x="${ptx.toFixed(1)}" y="${pty.toFixed(1)}" text-anchor="middle" font-size="11" fill="${p.color}" font-family="sans-serif">${p.name} (${chLabel})</text>`;
  });
  s += '</g></svg>';
  dl(s, 'event-profiles.svg', 'image/svg+xml');
}

function dl(content, name, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name;
  a.click();
}

/* ================================================================
   MOBILE PANEL
   ================================================================ */
function isMobile() { return window.innerWidth <= 700; }

function showMobileElements(yes) {
  const mobileIds = ['panel-header-mobile','mobile-mode-section','mobile-actions'];
  mobileIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = yes ? (id === 'mobile-actions' ? 'flex' : 'block') : 'none';
  });
}

function openPanel() {
  const panel    = document.getElementById('panel');
  const backdrop = document.getElementById('panel-backdrop');
  const toggle   = document.getElementById('menu-toggle');
  panel.classList.add('open');
  backdrop.classList.add('visible');
  if (toggle) toggle.setAttribute('aria-expanded','true');
}

function closePanel() {
  const panel    = document.getElementById('panel');
  const backdrop = document.getElementById('panel-backdrop');
  const toggle   = document.getElementById('menu-toggle');
  panel.classList.remove('open');
  backdrop.classList.remove('visible');
  if (toggle) toggle.setAttribute('aria-expanded','false');
}

/* ================================================================
   CHANNEL SELECT — syncs panel dropdown
   ================================================================ */
function syncChannelSelect(channel) {
  const sel = document.getElementById('channel-select');
  if (sel) sel.value = channel || 'voc';
}

/* ================================================================
   BOOT
   ================================================================ */
buildSliders();
addProfile(PRESETS.cooking, 'cooking', 'voc', null);

function initUI() {
  /* Display mode radios */
  document.querySelectorAll('input[name="dispmode"]').forEach(radio => {
    radio.addEventListener('change', e => setDisplayMode(e.target.value));
  });

  /* Mobile mode select */
  const mSel = document.getElementById('mobile-mode-select');
  if (mSel) mSel.addEventListener('change', e => setDisplayMode(e.target.value));

  /* Channel select */
  const chSel = document.getElementById('channel-select');
  if (chSel) chSel.addEventListener('change', e => onChannelChange(e.target.value));

  /* Group select */
  const gSel = document.getElementById('group-select');
  if (gSel) gSel.addEventListener('change', e => {
    const p = activeProfile();
    if (p) { p.groupId = e.target.value || null; renderProfileList(); }
  });

  /* Add group button */
  document.getElementById('add-group')?.addEventListener('click', () => {
    const name = prompt('Group name:');
    if (name && name.trim()) addGroup(name.trim());
  });

  /* Desktop buttons */
  document.getElementById('import-json').addEventListener('click', importJSON);
  document.getElementById('export-json').addEventListener('click', exportJSON);
  document.getElementById('export-svg').addEventListener('click', exportSVG);

  /* Mobile action buttons */
  document.getElementById('mobile-import-json').addEventListener('click', importJSON);
  document.getElementById('mobile-export-json').addEventListener('click', exportJSON);
  document.getElementById('mobile-export-svg').addEventListener('click', exportSVG);

  /* File input */
  document.getElementById('import-file').addEventListener('change', handleImport);

  /* Profile name */
  document.getElementById('profile-name-input').addEventListener('input', e => onNameChange(e.target.value));

  /* Preset select */
  document.getElementById('preset-select').addEventListener('change', e => loadPreset(e.target.value));

  /* Add profile */
  document.getElementById('add-profile').addEventListener('click', () => addProfile());

  /* Mobile panel open/close */
  document.getElementById('menu-toggle').addEventListener('click', () => {
    const panel = document.getElementById('panel');
    panel.classList.contains('open') ? closePanel() : openPanel();
  });
  document.getElementById('panel-backdrop').addEventListener('click', closePanel);
  document.getElementById('panel-close').addEventListener('click', closePanel);

  /* Responsive */
  function applyResponsive() {
    const mobile = isMobile();
    showMobileElements(mobile);
    if (!mobile) closePanel();
  }
  applyResponsive();
  window.addEventListener('resize', applyResponsive);
}

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    initGraph();
    window.addEventListener('resize', () => { zt = d3.zoomIdentity; initGraph(); });
  });
});

initUI();

// Expose for inline onclick
window.toggleVis       = toggleVis;
window.dupProfile      = dupProfile;
window.delProfile      = delProfile;
window.renameProfile   = renameProfile;
window.exportGroupJSON = exportGroupJSON;
window.delGroup        = delGroup;