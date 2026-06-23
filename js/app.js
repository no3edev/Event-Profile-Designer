/* ================================================================
   CURVE MODEL
   ================================================================ */
const CurveModel = (() => {
  function _resp(t, rise, decay) {
    if (t <= 0 || rise <= 0 || decay <= 0) return 0;
    return (1 - Math.exp(-t / rise)) * Math.exp(-t / decay);
  }
  function peakTime(rise, decay) {
    // analytical: t_peak = rise * ln(1 + decay/rise)
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
   PROFILES
   ================================================================ */
const COLORS = ['#4f8ef7','#3ecf8e','#f5a623','#f76f6f','#a78bfa','#2dd4bf','#f472b6','#94a3b8'];
const PRESETS = {
  cooking:    { rise:15,  decay:120,  amplitude:0.85, delay:5,  duration:1.2 },
  traffic:    { rise:90,  decay:600,  amplitude:0.35, delay:20, duration:2.0 },
  occupant:   { rise:30,  decay:900,  amplitude:0.55, delay:0,  duration:1.0 },
  pedestrian: { rise:8,   decay:60,   amplitude:0.70, delay:2,  duration:0.7 },
  fragrance:  { rise:5,   decay:300,  amplitude:0.95, delay:0,  duration:1.5 },
};
const PARAM_DEFS = [
  { key:'rise',      label:'Rise',      min:1,    max:300,  step:1,    fmt: v => Math.round(v)+'s'   },
  { key:'decay',     label:'Decay',     min:1,    max:1200, step:1,    fmt: v => Math.round(v)+'s'   },
  { key:'amplitude', label:'Amplitude', min:0.01, max:1,    step:0.01, fmt: v => v.toFixed(2)        },
  { key:'delay',     label:'Delay',     min:0,    max:300,  step:0.5,  fmt: v => v.toFixed(1)+'s'    },
  { key:'duration',  label:'Duration',  min:0.1,  max:5,    step:0.05, fmt: v => v.toFixed(2)+'×'    },
];

let profiles = [];
let activeId  = null;
let _colorIdx = 0;

/* ── Display mode ── */
// 'normalized' : each curve peak → 1.0, time axis per-curve (0→1 normalised tau)
// 'realtime'   : shared time axis in seconds, true amplitudes (default)
// 'absolute'   : shared time axis fixed 0–tAbsMax, y fixed 0–1
let displayMode = 'realtime';
const ABS_T_MAX = 1200; // fixed x ceiling for absolute mode

function setDisplayMode(mode) {
  displayMode = mode;
  zt = d3.zoomIdentity; // reset zoom on mode switch so axes are sensible
  if (zoomBehavior) d3.select('#gsvg').call(zoomBehavior.transform, d3.zoomIdentity);
  render();
}

function mkProfile(name, params) {
  return {
    id: Math.random().toString(36).slice(2),
    name: name || 'profile',
    visible: true,
    color: COLORS[_colorIdx++ % COLORS.length],
    channel: 'voc',
    params: { rise:30, decay:200, amplitude:0.7, delay:0, duration:1, ...params },
  };
}
function activeProfile() { return profiles.find(p => p.id === activeId) || null; }

function setActive(id) {
  activeId = id;
  const p = activeProfile();
  if (p) {
    document.getElementById('profile-name-input').value = p.name;
    syncSliders(p.params);
  }
  renderProfileList();
  render();
}

/* ================================================================
   SLIDERS
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
      document.getElementById('sv-'+def.key).textContent = def.fmt(val);
      render();
    });
    c.appendChild(row);
  });
}

function syncSliders(params) {
  PARAM_DEFS.forEach(def => {
    const el = document.getElementById('sl-'+def.key);
    const sv = document.getElementById('sv-'+def.key);
    if (el) { el.value = params[def.key]; }
    if (sv) { sv.textContent = def.fmt(params[def.key]); }
  });
}

function onNameChange(val) {
  const p = activeProfile();
  if (p) { p.name = val; renderProfileList(); }
}

/* ================================================================
   PROFILE LIST UI
   ================================================================ */
function renderProfileList() {
  const list = document.getElementById('plist');
  list.innerHTML = '';
  profiles.forEach(p => {
    const item = document.createElement('div');
    item.className = 'pi' + (p.id === activeId ? ' active' : '');
    item.innerHTML = `
      <div class="pswatch" style="background:${p.color}"></div>
      <div class="pname"><input value="${escHtml(p.name)}"
        onclick="event.stopPropagation()"
        onchange="renameProfile('${p.id}',this.value)"></div>
      <button class="pibtn" title="${p.visible?'Hide':'Show'}"
        onclick="event.stopPropagation();toggleVis('${p.id}')">${p.visible?'●':'○'}</button>
      <button class="pibtn" title="Duplicate"
        onclick="event.stopPropagation();dupProfile('${p.id}')">⧉</button>
      <button class="pibtn" title="Delete"
        onclick="event.stopPropagation();delProfile('${p.id}')">✕</button>`;
    item.addEventListener('click', () => setActive(p.id));
    list.appendChild(item);
  });
}
function escHtml(s){ return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function addProfile(params, name) {
  const p = mkProfile(name || `profile ${profiles.length+1}`, params);
  profiles.push(p);
  setActive(p.id);
}
function dupProfile(id) {
  const src = profiles.find(p => p.id === id);
  if (!src) return;
  const p = mkProfile(src.name+' copy', { ...src.params });
  profiles.push(p);
  setActive(p.id);
}
function delProfile(id) {
  if (profiles.length <= 1) return;
  const idx = profiles.findIndex(p => p.id === id);
  profiles = profiles.filter(p => p.id !== id);
  setActive(profiles[Math.min(idx, profiles.length-1)].id);
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
  const p = activeProfile();
  if (!p) return;
  p.params = { ...PRESETS[key] };
  p.name = key;
  document.getElementById('profile-name-input').value = key;
  document.getElementById('preset-select').value = '';
  syncSliders(p.params);
  renderProfileList();
  render();
}

/* ================================================================
   GRAPH
   ================================================================ */
const M = { top:32, right:28, bottom:52, left:58 }; // margins
let gRoot, gGrid, gAxes, gCurves, gHandles;
// base scales (pixel space, no zoom applied)
let xBase, yBase;
// current zoom transform
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
  // guard: don't render into a zero-size container
  if (iW <= 0 || iH <= 0) return;

  const svg = d3.select('#gsvg');
  svg.selectAll('*').remove();

  // clip path
  svg.append('defs').append('clipPath').attr('id','pclip')
    .append('rect').attr('width', iW).attr('height', iH);

  gRoot   = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);
  gGrid   = gRoot.append('g');
  gAxes   = gRoot.append('g');
  gCurves = gRoot.append('g').attr('clip-path','url(#pclip)');
  gHandles= gRoot.append('g').attr('clip-path','url(#pclip)');

  // base scales — domain will be updated each render
  xBase = d3.scaleLinear().domain([0, 600]).range([0, iW]);
  yBase = d3.scaleLinear().domain([0, 1.1]).range([iH, 0]);

  // zoom
  zoomBehavior = d3.zoom()
    .scaleExtent([0.2, 30])
    .on('zoom', e => { zt = e.transform; render(); });
  svg.call(zoomBehavior).on('dblclick.zoom', null);

  render();
}

/* Compute visible x-domain from base scale + zoom transform */
function visibleXScale() {
  const { iW } = dims();
  if (!xBase) return null;
  // rescaled copy via zoom transform
  return zt.rescaleX(xBase);
}

function render() {
  if (!gCurves) return;
  const { iW, iH } = dims();
  if (iW <= 0 || iH <= 0) return;

  const visible = profiles.filter(p => p.visible);

  let xDomain, yDomain, xLabel, yLabel;

  if (displayMode === 'normalized') {
    // x = normalised time 0→1 (tau = (t-delay)/duration/tp), y = normalised amplitude 0→1
    xDomain = [0, 1];
    yDomain = [0, 1.08];
    xLabel  = 'Normalised time (τ)';
    yLabel  = 'Normalised amplitude';
  } else if (displayMode === 'absolute') {
    xDomain = [0, ABS_T_MAX];
    yDomain = [0, 1.08];
    xLabel  = 'Time (seconds) — fixed scale';
    yLabel  = 'Response amplitude';
  } else {
    // realtime: auto-fit tMax across visible profiles
    const tMax = visible.length
      ? Math.max(...visible.map(p => CurveModel.naturalEnd(p.params)))
      : 600;
    xDomain = [0, tMax];
    yDomain = [0, 1.08];
    xLabel  = 'Time (seconds)';
    yLabel  = 'Response amplitude';
  }

  xBase.domain(xDomain).range([0, iW]);
  yBase.domain(yDomain).range([iH, 0]);

  const xs = zt.rescaleX(xBase);
  const ys = yBase;

  drawGrid(xs, ys, iW, iH);
  drawAxes(xs, ys, iW, iH, xLabel, yLabel);
  drawCurves(visible, xs, ys, iH);
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

function drawAxes(xs, ys, iW, iH, xLabel='Time (seconds)', yLabel='Response amplitude') {
  gAxes.selectAll('*').remove();
  // axis lines
  gAxes.append('line').attr('class','axis-line').attr('x1',0).attr('x2',iW).attr('y1',iH).attr('y2',iH);
  gAxes.append('line').attr('class','axis-line').attr('x1',0).attr('x2',0).attr('y1',0).attr('y2',iH);
  // x tick labels
  const xFmt = displayMode === 'normalized'
    ? t => t.toFixed(2)+'τ'
    : t => t+'s';
  xs.ticks(8).forEach(t => {
    const x = xs(t);
    if (isNaN(x)) return;
    gAxes.append('text').attr('class','alabel')
      .attr('x', x).attr('y', iH+16).attr('text-anchor','middle').text(xFmt(t));
  });
  // axis title x
  gAxes.append('text').attr('class','alabel')
    .attr('x', iW/2).attr('y', iH+40).attr('text-anchor','middle')
    .attr('fill','#9aa3b8').text(xLabel);
  // y tick labels
  const yFmt = displayMode === 'normalized'
    ? t => t.toFixed(1)
    : t => t.toFixed(2);
  ys.ticks(6).forEach(t => {
    const y = ys(t);
    if (isNaN(y)) return;
    gAxes.append('text').attr('class','alabel')
      .attr('x',-8).attr('y', y+4).attr('text-anchor','end').text(yFmt(t));
  });
  // axis title y
  gAxes.append('text').attr('class','alabel')
    .attr('transform',`rotate(-90) translate(${-iH/2},-44)`)
    .attr('text-anchor','middle').attr('fill','#9aa3b8').text(yLabel);
}

/**
 * Transform raw {t, y} sample points into display-space coordinates
 * depending on the current displayMode.
 *
 * normalized : x = tau (0→1 across peak), y = y / peakAmplitude  (both 0→1)
 * realtime   : x = t in seconds, y = y as-is
 * absolute   : x = t in seconds (against fixed ABS_T_MAX), y = y as-is
 */
function transformPoints(pts, p) {
  if (displayMode === 'normalized') {
    const { rise, decay, amplitude, delay, duration } = p.params;
    const tp = CurveModel.peakTime(rise, decay);
    const tauPeak = tp; // natural peak happens at tau=tp in the (t-delay)/duration space
    // map real t → tau in [0..1] where tau_peak normalised → ~0.15 area of axis
    // We want each curve to fill the x-axis: tau_end = tp*7 → map to 1.0
    const tauEnd = tp * 7;
    return pts.map(d => {
      const tau = (d.t - delay) / duration; // raw tau
      const xN  = tauEnd > 0 ? tau / tauEnd : 0; // 0→1
      const yN  = amplitude > 0 ? d.y / amplitude : 0;
      return { t: xN, y: yN };
    });
  }
  return pts; // realtime & absolute: use raw values
}

function drawCurves(visible, xs, ys, iH) {
  gCurves.selectAll('*').remove();
  gHandles.selectAll('*').remove();

  const tMax = xBase.domain()[1];

  // In realtime/absolute mode sample at tMax; in normalized sample a fixed window
  const sampleEnd = displayMode === 'normalized' ? null : tMax;

  visible.forEach(p => {
    const { pts } = CurveModel.sample(p.params, 500, sampleEnd);
    const tpts = transformPoints(pts, p);

    const line = d3.line()
      .x(d => xs(d.t))
      .y(d => ys(d.y))
      .defined(d => !isNaN(xs(d.t)) && !isNaN(ys(d.y)))
      .curve(d3.curveCatmullRom.alpha(0.5));

    const area = d3.area()
      .x(d => xs(d.t))
      .y0(iH)
      .y1(d => ys(d.y))
      .defined(d => !isNaN(xs(d.t)) && !isNaN(ys(d.y)))
      .curve(d3.curveCatmullRom.alpha(0.5));

    const areaD = area(tpts);
    const lineD = line(tpts);
    if (areaD) gCurves.append('path').attr('class','curve-area').attr('d', areaD).attr('fill', p.color);
    if (lineD) gCurves.append('path').attr('class','curve-path').attr('d', lineD)
      .attr('stroke', p.color).attr('opacity', p.id === activeId ? 1 : 0.5);

    // Profile name label near peak
    const { rise, decay, amplitude, delay, duration } = p.params;
    const tp = CurveModel.peakTime(rise, decay);
    let labelX, labelY;
    if (displayMode === 'normalized') {
      const tauEnd = tp * 7;
      labelX = xs(tauEnd > 0 ? tp / tauEnd : 0.15);
      labelY = ys(1.0) - 10;
    } else {
      labelX = xs(delay + duration * tp);
      labelY = ys(amplitude) - 10;
    }
    if (!isNaN(labelX) && !isNaN(labelY)) {
      gCurves.append('text')
        .attr('x', labelX).attr('y', labelY)
        .attr('text-anchor','middle').attr('font-size', 10)
        .attr('fill', p.color).attr('opacity', 0.75)
        .text(p.name);
    }

    // Only draw interactive handles in realtime/absolute modes
    // (normalized handles would need inverse transform — skip for clarity)
    if (p.id === activeId && displayMode !== 'normalized') {
      drawHandles(p, xs, ys, iH);
    }
  });
}

/* ── Draggable handles ── */
function drawHandles(p, xs, ys, iH) {
  const { rise, decay, amplitude, delay, duration } = p.params;
  const tp = CurveModel.peakTime(rise, decay);

  // positions in data space
  const peakT = delay + duration * tp;
  const peakY = amplitude;

  const tailT = delay + duration * (tp + decay * 1.5);
  const tailY = Math.max(0, CurveModel.evaluate(tailT, p.params));

  // pixel positions — guard NaN
  const dPx  = xs(delay);
  const pkPx = [xs(peakT), ys(peakY)];
  const tlPx = [xs(tailT), ys(tailY)];

  if ([dPx, pkPx[0], pkPx[1], tlPx[0], tlPx[1]].some(isNaN)) return;

  const g = gHandles.append('g').attr('class','hgrp');
  const col = p.color;

  /* Delay handle */
  const dh = g.append('g').style('cursor','ew-resize');
  dh.append('line').attr('x1',dPx).attr('x2',dPx).attr('y1',0).attr('y2',iH)
    .attr('stroke',col).attr('stroke-width',.8).attr('stroke-dasharray','4,3').attr('opacity',.35);
  dh.append('circle').attr('cx',dPx).attr('cy',iH-1).attr('r',6).attr('fill',col);
  attachDrag(dh, p, xs, ys, 'delay');

  /* Peak handle */
  const ph = g.append('g').style('cursor','move');
  ph.append('circle').attr('class','handle-ring').attr('cx',pkPx[0]).attr('cy',pkPx[1]).attr('r',11).attr('stroke',col);
  ph.append('circle').attr('cx',pkPx[0]).attr('cy',pkPx[1]).attr('r',5).attr('fill',col);
  g.append('text').attr('x',pkPx[0]).attr('y',pkPx[1]-16)
    .attr('text-anchor','middle').attr('font-size',10).attr('fill','#9aa3b8')
    .text(`peak ${peakY.toFixed(2)}`);
  attachDrag(ph, p, xs, ys, 'peak');

  /* Tail / decay handle */
  const th = g.append('g').style('cursor','ew-resize');
  th.append('circle').attr('cx',tlPx[0]).attr('cy',tlPx[1]).attr('r',5)
    .attr('fill','#0d0f12').attr('stroke',col).attr('stroke-width',1.5);
  attachDrag(th, p, xs, ys, 'tail');
}

function attachDrag(el, profile, xs, ys, type) {
  let sp, sparams;
  el.call(d3.drag()
    .on('start', function(ev) {
      sp = { x: ev.x, y: ev.y };
      sparams = { ...profile.params };
    })
    .on('drag', function(ev) {
      const dtData = xs.invert(ev.x) - xs.invert(sp.x);
      const dyData = ys.invert(ev.y) - ys.invert(sp.y);
      const q = profile.params;

      if (type === 'delay') {
        q.delay = Math.max(0, sparams.delay + dtData);
      } else if (type === 'peak') {
        // horizontal: shift peak time by changing rise & duration together
        const rawRise = sparams.rise - dtData * 0.4;
        q.rise = Math.max(1, Math.min(300, rawRise));
        const rawDur = sparams.duration + dtData * 0.004;
        q.duration = Math.max(0.1, Math.min(5, rawDur));
        // vertical: amplitude
        q.amplitude = Math.max(0.01, Math.min(1, sparams.amplitude - dyData));
      } else if (type === 'tail') {
        q.decay = Math.max(1, Math.min(1200, sparams.decay + dtData * 1.5));
      }

      syncSliders(profile.params);
      render();
    })
  );
}

/* ── Status bar ── */
const MODE_LABELS = { normalized:'Normalised', realtime:'Real-time', absolute:'Absolute' };
function updateStatus() {
  const p = activeProfile();
  const badge = document.getElementById('s-mode-badge');
  if (badge) badge.textContent = MODE_LABELS[displayMode] || displayMode;
  if (!p) return;
  const { rise, decay, amplitude, delay, duration } = p.params;
  const tp = CurveModel.peakTime(rise, decay);
  const peakT = delay + duration * tp;
  const t10 = tp + decay * Math.log(10);
  const d10 = delay + duration * t10;
  document.getElementById('s-peak').textContent = amplitude.toFixed(3);
  document.getElementById('s-ttp').textContent  = peakT.toFixed(1)+'s';
  document.getElementById('s-d10').textContent  = d10.toFixed(1)+'s';
}

/* ================================================================
   EXPORT / IMPORT
   ================================================================ */
function exportJSON() {
  const p = activeProfile();
  if (!p) return;
  const { rise, decay, amplitude, delay, duration } = p.params;
  const pr = [+(amplitude * 0.85).toFixed(3), +(amplitude * 1.15).toFixed(3)];
  const out = {
    name: p.name,
    [p.channel]: { rise, decay, peakRange: pr },
    meta: { delay, duration, amplitude }
  };
  dl(JSON.stringify(out, null, 2), p.name+'.json', 'application/json');
}
function importJSON() { document.getElementById('import-file').click(); }
function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      const ch = data.voc || data.co2 || data.pm || {};
      const meta = data.meta || {};
      const params = {
        rise:      ch.rise      || 30,
        decay:     ch.decay     || 200,
        amplitude: meta.amplitude != null ? meta.amplitude : (ch.peakRange ? (ch.peakRange[0]+ch.peakRange[1])/2 : 0.7),
        delay:     meta.delay   || 0,
        duration:  meta.duration|| 1,
      };
      addProfile(params, data.name || 'imported');
    } catch(err) { alert('Could not parse JSON: '+err.message); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function exportSVG() {
  const { W, H, iW, iH } = dims();
  const visible = profiles.filter(p => p.visible);
  const tMax = visible.length ? Math.max(...visible.map(p => CurveModel.naturalEnd(p.params))) : 600;
  const xs = d3.scaleLinear().domain([0, tMax]).range([0, iW]);
  const ys = d3.scaleLinear().domain([0, 1.1]).range([iH, 0]);

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
    const d = pts.map((pt,i) => `${i===0?'M':'L'}${xs(pt.t).toFixed(2)},${ys(pt.y).toFixed(2)}`).join(' ');
    s += `<path d="${d}" fill="none" stroke="${p.color}" stroke-width="2" stroke-linecap="round"/>`;
    const tp = CurveModel.peakTime(p.params.rise, p.params.decay);
    const ptx = xs(p.params.delay + p.params.duration * tp);
    const pty = ys(p.params.amplitude) - 9;
    s += `<text x="${ptx.toFixed(1)}" y="${pty.toFixed(1)}" text-anchor="middle" font-size="11" fill="${p.color}" font-family="sans-serif">${p.name}</text>`;
  });

  s += '</g></svg>';
  dl(s, 'event-profiles.svg', 'image/svg+xml');
}

function dl(content, name, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], {type: mime}));
  a.download = name;
  a.click();
}
const presetSelect = document.getElementById('preset-select');

presetSelect.addEventListener('change', (event) => {
    loadPreset(event.target.value);
});
/* ================================================================
   BOOT
   ================================================================ */
buildSliders();
addProfile(PRESETS.cooking, 'cooking');

// Init graph after layout is painted
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    initGraph();
    window.addEventListener('resize', () => { zt = d3.zoomIdentity; initGraph(); });
  });
});