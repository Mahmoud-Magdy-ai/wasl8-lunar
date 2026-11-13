// Wasl8 — UI: planner, cockpit, report.
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const HOUR = Model.HOUR;
  const T = I18N.T;
  const MONTHS = () => T('months');
  const fmtDate = ms => { const d = new Date(ms); return I18N.lang === 'ar' ? `${d.getUTCDate()} ${MONTHS()[d.getUTCMonth()]} ${d.getUTCFullYear()}` : `${MONTHS()[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
  const TAGS_AR = { 'Artemis candidate region': 'منطقة مرشحة لمهمات Artemis', 'Reference: one of the best-lit spots': 'مرجع: من أكتر الأماكن إضاءة', 'Real mission · Feb 22, 2024': 'مهمة حقيقية · 22 فبراير 2024', 'Real mission · Aug 23, 2023': 'مهمة حقيقية · 23 أغسطس 2023', 'Contrast: equator': 'للمقارنة: خط الاستواء', 'Future CLPS target': 'هدف CLPS قادم', 'Real mission · Mar 6, 2025': 'مهمة حقيقية · 6 مارس 2025', 'Real mission · Mar 2, 2025': 'مهمة حقيقية · 2 مارس 2025', 'Apollo · 1971': 'أبولو · 1971', 'Apollo · 1972': 'أبولو · 1972' };
  const tagOf = s => I18N.lang === 'ar' ? (TAGS_AR[s.tag] || s.tag) : s.tag;
  const nameOf = s => s.id === 'custom' ? T('customName') : s.name;
  const landerLabel = () => T(Model.settings.landerClass);
  const fmtDT = ms => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const fmtDur = h => {
    if (h == null || !isFinite(h)) return '—'; h = Math.max(0, h); const d = Math.floor(h / 24), r = Math.round(h - d * 24);
    const [D, Hh, M] = I18N.lang === 'ar' ? [' يوم', ' س', ' د'] : ['d', 'h', 'm'];
    return d ? `${d}${D} ${r}${Hh}` : `${Math.floor(h)}${Hh} ${Math.round((h % 1) * 60)}${M}`;
  };
  const days = h => { const v = Math.round(h / 24 * 10) / 10; return Number.isInteger(v) ? String(v) : v.toFixed(1); };

  const state = { site: SITES[0], year: 2027, scores: null, three: null, selDay: null, mission: null, lastMission: null };

  /* ---------------- views ---------------- */
  function show(view) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === view));
    $$('.tab[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    if (view !== 'cockpit') pause(); else resizeCanvas();
    if (view === 'explore') openExplore(); else exStop();
    window.scrollTo(0, 0);
  }
  $$('.tab[data-view]').forEach(b => b.onclick = () => {
    if (b.dataset.view === 'cockpit' && !state.mission && state.scores) {
      const ev = state.scores.filter(x => x.sunAtStart && x.firstSunsetH != null && x.firstSunsetH >= 3 && x.firstSunsetH <= 48 && !x.survivedAll)
        .sort((a, b) => a.survivedH - b.survivedH)[0];
      startMission(state.site, (ev || state.three.worst).t);
    }
    show(b.dataset.view);
  });

  /* ---------------- planner ---------------- */
  function renderSites() {
    $('#siteList').innerHTML = SITES.map(s => `
      <button class="site ${s.id === state.site.id ? 'active' : ''}" data-id="${s.id}">
        <span class="tag">${tagOf(s)}</span><b>${s.name}</b>
        <span class="co"><bdi>${s.lat.toFixed(2)}°, ${s.lon.toFixed(2)}°E</bdi> ${Model.horizonFor(s) ? T('lolaTerrain') : T('noTerrain')}</span>
        ${s.landing && s.id !== 'im2' ? `<span class="ref"><a href="#" class="replay" data-id="${s.id}">${T('replay')}</a></span>` : ''}
        ${s.optimized ? `<span class="ref">${T('bestLit', distKm(s).toFixed(1), '<bdi>' + s.pubLat.toFixed(2) + '°, ' + s.pubLon.toFixed(2) + '°E</bdi>')} · <a href="#" class="usePub" data-lat="${s.pubLat}" data-lon="${s.pubLon}">${T('usePub')}</a></span>` : ''}
      </button>`).join('') + (state.site.id === 'custom' ? `<button class="site active"><span class="tag">${T('yourPoint')}</span><b>${nameOf(state.site)}</b><span class="co"><bdi>${state.site.lat.toFixed(2)}°, ${state.site.lon.toFixed(2)}°E</bdi> · ${Model.horizonFor(state.site) ? T('lola480') : T('noTerrain2')}</span></button>` : '');
    $$('.site[data-id]').forEach(b => b.onclick = e => { if (e.target.closest('a')) return; state.site = SITES.find(s => s.id === b.dataset.id); refresh(); });
    $$('.replay').forEach(a => a.onclick = e => { e.preventDefault(); e.stopPropagation(); const st = SITES.find(x => x.id === a.dataset.id); state.site = st; startMission(st, st.landing); show('cockpit'); });
    $$('.usePub').forEach(a => a.onclick = e => { e.preventDefault(); e.stopPropagation(); useCustom(+a.dataset.lat, +a.dataset.lon); });
    drawMap();
  }
  function distKm(s) {
    const r = Math.PI / 180, a = Math.sin(s.lat * r) * Math.sin(s.pubLat * r) + Math.cos(s.lat * r) * Math.cos(s.pubLat * r) * Math.cos((s.lon - s.pubLon) * r);
    return Lunar.R_MOON_KM * Math.acos(Math.min(1, a));
  }

  /* ---- south-pole map (LOLA hillshade, polar stereographic, 80S..pole) ---- */
  const MAP_HALF_M = 302880, mapImg = new Image();
  mapImg.onload = () => drawMap(); mapImg.src = 'southpole_map.jpg';
  function mapXY(lat, lon, W) {
    const r = 2 * 1737400 * Math.tan((90 + lat) * Math.PI / 360);
    const x = r * Math.sin(lon * Math.PI / 180), y = r * Math.cos(lon * Math.PI / 180);
    return [W / 2 + x / MAP_HALF_M * W / 2, W / 2 - y / MAP_HALF_M * W / 2];
  }
  function drawMap() {
    const c = $('#map'); if (!c) return; const g = c.getContext('2d'), W = c.width;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, W);
    if (mapImg.complete && mapImg.naturalWidth) g.drawImage(mapImg, 0, 0, W, W);
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.font = '20px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)';
    for (const lat of [-85, -88]) { const [, y] = mapXY(lat, 0, W); g.beginPath(); g.arc(W / 2, W / 2, W / 2 - y, 0, 7); g.stroke(); g.fillText(lat + '°', W / 2 + 4, y - 4); }
    g.fillText(T('earthSide'), 12, W - 14);
    const all = [...SITES.filter(s => s.lat < -79.5), ...(state.site.id === 'custom' ? [state.site] : [])];
    for (const s of all) {
      const [x, y] = mapXY(s.lat, s.lon, W), on = s.id === state.site.id;
      g.beginPath(); g.arc(x, y, on ? 14 : 9, 0, 7); g.fillStyle = on ? '#FC3D21' : '#fff'; g.fill();
      g.lineWidth = 3; g.strokeStyle = '#0B3D91'; g.stroke();
      g.font = (on ? 'bold ' : '') + '22px Inter, sans-serif'; g.fillStyle = '#fff';
      g.shadowColor = '#000'; g.shadowBlur = 6; const dy = { im2: 22, monsmouton: -6, ridge: 14, degerlache: -4 }[s.id] || 7; g.fillText(s.id === 'custom' ? T('yourPoint') : s.name.replace(' (IM-1 landing)', '').replace(' (CLPS target)', ''), x + 16, Math.max(26, y + dy)); g.shadowBlur = 0;
    }
  }
  $('#map').addEventListener('click', e => {
    const c = $('#map'), r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width * 2 - 1) * MAP_HALF_M, y = (1 - (e.clientY - r.top) / r.height * 2) * MAP_HALF_M;
    const rr = Math.hypot(x, y), lat = -90 + 2 * Math.atan(rr / (2 * 1737400)) * 180 / Math.PI, lon = Math.atan2(x, y) * 180 / Math.PI;
    $('#cLat').value = lat.toFixed(3); $('#cLon').value = lon.toFixed(3);
    useCustom(lat, lon);
  });

  async function useCustom(lat, lon) {
    const site = { id: 'custom', name: 'Custom point', lat, lon, tag: 'Your coordinates', note: '' };
    delete window.HORIZONS.custom;
    state.site = site; Model.clearCache();
    if (Terrain.covers(lat)) {
      $('#calendar').innerHTML = `<p class="muted">${T('loadingTerrain')}</p>`;
      try { await Terrain.load(f => { $('#calendar').innerHTML = `<div class="progress"><i style="width:${(f * 100).toFixed(0)}%"></i></div><p class="muted">${T('loadingTerrain')} ${(f * 100).toFixed(0)}%</p>`; }); const h = Terrain.horizon(lat, lon, 0.5); window.HORIZONS.custom = h; site.elev = h.elev; Model.clearCache(); }
      catch (err) { console.warn(err); }
    }
    refresh();
  }
  $('#cGo').onclick = () => {
    const lat = +$('#cLat').value, lon = +$('#cLon').value;
    if (!(lat >= -90 && lat <= 90) || !isFinite(lon)) return alert(T('latErr'));
    useCustom(lat, lon);
  };
  $('#year').onchange = e => { state.year = +e.target.value; refresh(); };
  const LKEYS = [['panelW', 'pPanel'], ['batteryWh', 'pBattery'], ['baseW', 'pBase'], ['radioW', 'pRadio'], ['heaterW', 'pHeater'], ['cameraW', 'pCamera']];
  function renderLanderEdit() {
    const L = Model.settings.lander;
    $('#landerEdit').innerHTML = LKEYS.map(([k, l]) => `<label>${T(l)} <input type="number" min="0" data-k="${k}" value="${L[k]}"></label>`).join('');
    $$('#landerEdit input').forEach(i => i.onchange = () => { L[i.dataset.k] = Math.max(0, +i.value || 0); refresh(); });
    $('#devHeater').nextElementSibling.textContent = T('heater', L.heaterW);
    $('#devCamera').nextElementSibling.textContent = T('camera', L.cameraW);
  }
  $('#lander').onchange = e => { Model.settings.landerClass = e.target.value; Object.assign(Model.settings.lander, Model.LANDERS[e.target.value]); renderLanderEdit(); refresh(); };
  $('#panelMode').onchange = e => { const v = e.target.value; Model.settings.panel.mode = v === 'tracking' ? 'tracking' : 'fixed'; Model.settings.panel.az = v === 'tracking' ? 0 : +v; refresh(); };
  $('#margin').onchange = e => { Model.settings.earthMarginDeg = +e.target.value; Model.clearCache(); refresh(); };
  $('#colorBy').onchange = () => { renderLegend(); refresh(); };
  function renderLegend() {
    const L = T($('#colorBy').value === 'both' ? 'legBoth' : 'legSurv');
    $('#legendItems').innerHTML = ['s4', 's3', 's2', 's1'].map((c, i) => `<span class="lg"><i class="sw ${c}"></i>${L[i].replace('<', '&lt;').replace(' ●', '')}</span>`).join('');
  }
  Object.assign(Model.settings.lander, Model.LANDERS.small); renderLanderEdit(); renderLegend();
  $('#mdays').onchange = e => { Model.settings.missionDays = +e.target.value; Model.clearCache(); refresh(); };

  function level(s) {
    if ($('#colorBy').value === 'both') { const b = s.bothPct; return b >= 60 ? 4 : b >= 40 ? 3 : b >= 20 ? 2 : 1; }
    const f = s.survivedH / (Model.settings.missionDays * 24); return f >= 1 ? 4 : f >= 0.66 ? 3 : f >= 0.33 ? 2 : 1;
  }

  function refresh() {
    renderSites();
    const site = state.site;
    $('#siteTitle').textContent = `· ${nameOf(site)}`;
    $('#terrainNote').textContent = Model.horizonFor(site) ? '' :
      T('noTerrainNote');
    $('#calendar').innerHTML = `<p class="muted">${T('computing')}</p>`;
    const token = state.token = (state.token || 0) + 1;
    Model.prepareYear(site, state.year, f => { if (token === state.token) $('#calendar').innerHTML = `<div class="progress"><i style="width:${(f * 100).toFixed(0)}%"></i></div><p class="muted">${T('computing')} ${(f * 100).toFixed(0)}%</p>`; }).then(() => {
      if (token !== state.token) return;
      state.scores = Model.yearScores(site, state.year);
      state.three = Model.pickThree(state.scores, $('#colorBy').value);
      renderCards(); renderCalendar();
      selectDay(state.three.best.day);
      if ($('#explore').classList.contains('active')) openExplore();
    });
  }

  function cardHTML(kind, label, s) {
    return `<div class="card ${kind}"><div class="k">${label}</div>
      <div class="d">${fmtDate(s.t)}</div>
      <div class="big">${T('sunEarth', s.sunPct.toFixed(0), s.earthPct.toFixed(0))}</div>
      <div class="sub">${T('bothLongest', s.bothPct.toFixed(0), fmtDur(s.longestDarkH))}</div>
      <div class="m">${landerLabel()}: ${s.survivedAll ? T('survivesAll', Model.settings.missionDays) : T('emptyAfter', days(s.survivedH))}</div>
      <button class="btn" data-day="${s.day}">${T('inspect')}</button>
      </div>`;
  }
  function findChallenge() {
    const L = Model.settings.lander, mh = Model.settings.missionDays * 24, start = Date.UTC(state.year, 0, 1);
    const days = state.scores.length, ser = Model.series(state.site, start, days * 24 + mh);
    const hib = { ...L, baseW: L.baseW * 0.25, radioW: 0 };
    let best = null, bestDark = -1;
    for (const sc of state.scores) {
      if (sc.survivedAll) continue;
      if (Model.simulate(ser, sc.day * 24, mh, hib).hoursAlive >= mh && sc.longestDarkH > bestDark) { best = sc.day; bestDark = sc.longestDarkH; }
    }
    return best;
  }
  function renderCards() {
    const { best, median, worst } = state.three;
    $('#cards').innerHTML = cardHTML('best', T('best'), best) + cardHTML('median', T('typical'), median) + cardHTML('worst', T('worst'), worst);

    $$('#cards .btn[data-day]').forEach(b => b.onclick = () => { selectDay(+b.dataset.day); focusDay(); });
    $$('#cards .card').forEach(c => { const b = c.querySelector('.btn[data-day]'); if (b) c.onclick = e => { if (!e.target.closest('.challenge')) b.click(); }; });

  }

  // year strip: one bar per landing day, height + brightness = share of hours with Sun and Earth together (or survival)
  const STRIP = ['#1c2433', '#5b3a12', '#b26b16', '#ffc04d'];
  function drawStrip() {
    const c = $('#strip'); if (!c || !state.scores) return; const g = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = 90; c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const n = state.scores.length, bw = W / n, base = H - 18, mode = $('#colorBy').value;
    state.scores.forEach((sc, i) => {
      const v = mode === 'both' ? sc.bothPct / 100 : Math.min(1, sc.survivedH / (Model.settings.missionDays * 24));
      g.fillStyle = STRIP[level(sc) - 1]; const hgt = 6 + v * (base - 10);
      g.fillRect(i * bw, base - hgt, Math.max(1, bw - (bw > 3 ? 1 : 0)), hgt);
    });
    if (state.selDay != null) { g.fillStyle = '#fff'; g.fillRect(state.selDay * bw - 1, 0, Math.max(2, bw + 2), base); }
    g.fillStyle = '#a3b1cc'; g.font = '11px Inter, sans-serif'; g.textAlign = 'left';
    for (let m = 0; m < 12; m++) { const d0 = (Date.UTC(state.year, m, 1) - Date.UTC(state.year, 0, 1)) / 864e5; g.fillRect(d0 * bw, base + 2, 1, 4); if (W > 420 || m % 2 === 0) g.fillText(MONTHS()[m], d0 * bw + 2, H - 3); }
  }
  $('#strip').addEventListener('click', e => {
    if (!state.scores) return; const r = $('#strip').getBoundingClientRect();
    const d = Math.max(0, Math.min(state.scores.length - 1, Math.floor((e.clientX - r.left) / r.width * state.scores.length)));
    selectDay(d); focusDay();
  });
  window.addEventListener('resize', drawStrip);

  function renderCalendar() {
    const sc = state.scores; let html = '';
    for (let m = 0; m < 12; m++) {
      const first = Date.UTC(state.year, m, 1), dow = new Date(first).getUTCDay();
      const n = new Date(Date.UTC(state.year, m + 1, 0)).getUTCDate();
      const d0 = (first - Date.UTC(state.year, 0, 1)) / 864e5;
      let cells = '<i></i>'.repeat(dow);
      for (let i = 0; i < n; i++) {
        const s = sc[d0 + i];
        cells += `<button class="day l${level(s)}" data-day="${d0 + i}" title="${fmtDate(s.t)}: ${s.survivedAll ? T('tipSurv') : T('tipDies', days(s.survivedH))} · ${T('tipBoth', s.bothPct.toFixed(0))}">${i + 1}</button>`;
      }
      html += `<div class="month"><b>${MONTHS()[m].toUpperCase()}</b><div class="days">${cells}</div></div>`;
    }
    $('#calendar').innerHTML = html; drawStrip();
    $$('.day').forEach(b => b.onclick = () => { selectDay(+b.dataset.day); focusDay(); });
  }

  state.hour = 0; state.cmp = '';
  $('#landHour').innerHTML = Array.from({ length: 24 }, (_, i) => `<option value="${i}">${String(i).padStart(2, '0')}:00</option>`).join('');
  $('#landHour').onchange = e => { state.hour = +e.target.value; selectDay(state.selDay); };
  $('#cmpSite').onchange = e => { state.cmp = e.target.value; selectDay(state.selDay); };
  function fillCmp() {
    $('#cmpSite').innerHTML = `<option value="">${T('none')}</option>` + SITES.filter(x => x.id !== state.site.id).map(x => `<option value="${x.id}" ${x.id === state.cmp ? 'selected' : ''}>${x.name}</option>`).join('');
    if (state.cmp === state.site.id) state.cmp = '';
  }
  function focusDay() {
    const p = $('#dayPanel'); p.scrollIntoView({ behavior: 'smooth', block: 'start' });
    p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash');
  }
  $('#openSettings').onclick = () => { const d = $('.settings'); d.open = true; d.scrollIntoView({ behavior: 'smooth' }); };
  function statBox(v, l) { return `<div class="stat"><div class="v${/\d/.test(v) ? '' : ' tx'}">${v}</div><div class="l">${l}</div></div>`; }

  function selectDay(d) {
    state.selDay = d;
    $$('.day').forEach(b => b.classList.toggle('sel', +b.dataset.day === d)); drawStrip();
    fillCmp();
    const s = state.hour ? { ...Model.statsAt(state.site, state.scores[d].t + state.hour * HOUR), day: d } : state.scores[d];
    $('#dayPanel').hidden = false;
    $('#dayTitle').textContent = T('landAt', nameOf(state.site), fmtDate(s.t)) + ` · ${String(new Date(s.t).getUTCHours()).padStart(2, '0')}:00 UTC`;
    $('#dayStats').innerHTML =
      statBox(`${s.sunPct.toFixed(0)}%`, T('sInSun')) +
      statBox(`${s.earthPct.toFixed(0)}%`, T('sEarth')) +
      statBox(s.longestDarkH < 0.5 ? T('vsNever') : fmtDur(s.longestDarkH), T('sDark')) +
      statBox(s.longestNoEarthH < 0.5 ? T('vsNever') : fmtDur(s.longestNoEarthH), T('sNoEarth')) +
      statBox(`${s.maxSunEl.toFixed(1)}°`, T('maxEl')) +
      statBox(s.meanLitSunEl == null ? '—' : `${s.meanLitSunEl.toFixed(1)}°`, T('meanEl')) +
      statBox(!s.sunAtStart ? T('darkAtStart') : s.firstSunsetH == null ? T('none2') : fmtDur(s.firstSunsetH), T('firstSunset')) +
      statBox(!s.earthAtStart ? T('noEarthStart') : s.firstEarthLossH == null ? T('none2') : fmtDur(s.firstEarthLossH), T('firstLoss')) +
      statBox(s.survivedAll ? `✓ ${Model.settings.missionDays} ${T('dUnit')}` : `✗ ${days(s.survivedH)} ${T('dUnit')}`, T('sModel', landerLabel()));
    // launch slips
    const slips = [-7, -1, 1, 7, 30];
    $('#slips').innerHTML = slips.map(k => {
      const t = s.t + k * 864e5, o = Model.statsAt(state.site, t);
      const diff = o.survivedH - s.survivedH;
      const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
      return `<button class="slip" data-t="${t}"><span class="d">${k > 0 ? '+' : ''}${k} ${Math.abs(k) > 1 ? T('daysWord') : T('dayWord')} · ${fmtDate(t)}</span>
        ☀ ${o.sunPct.toFixed(0)}% · 🌍 ${o.earthPct.toFixed(0)}% · ${o.survivedAll ? T('survives') : T('diesAfter', days(o.survivedH))} <br><span class="${cls}">${diff ? (diff > 0 ? T('slipBetter', days(diff)) : T('slipWorse', days(-diff))) : T('same')}</span></button>`;
    }).join('');
    $$('.slip').forEach(b => b.onclick = () => {
      const t = +b.dataset.t, y = new Date(t).getUTCFullYear();
      if (y !== state.year) { state.year = y; $('#year').value = y; }
      const dd = Math.round((t - Date.UTC(state.year, 0, 1)) / 864e5);
      if (state.scores && y === state.year && state.scores[dd]) selectDay(dd); else refresh();
    });
    // compare sites
    $('#compare').innerHTML = SITES.filter(x => x.id !== state.site.id).map(x => {
      const o = Model.statsAt(x, s.t);
      return `<button class="cmp" data-id="${x.id}"><b>${x.name}</b>☀ ${o.sunPct.toFixed(0)}% · 🌍 ${o.earthPct.toFixed(0)}%<br><span class="muted">${o.survivedAll ? '✓ ' + T('survives') : '✗ ' + T('diesAfter', days(o.survivedH))}</span></button>`;
    }).join('');
    $$('.cmp').forEach(b => b.onclick = () => { state.site = SITES.find(x => x.id === b.dataset.id); refresh(); });
    $('#liveDay').onclick = () => { startMission(state.site, s.t); show('cockpit'); };
    // links to the same Sun/Earth table straight from NASA/JPL Horizons (observer on the Moon: coord@301)
    const hz = body => {
      const st = state.site, lonE = ((st.lon % 360) + 360) % 360, d0 = new Date(s.t), d1 = new Date(s.t + Model.settings.missionDays * 864e5);
      const f = d => d.toISOString().slice(0, 16).replace('T', ' ');
      return 'https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27' + body + '%27&CENTER=%27coord@301%27&COORD_TYPE=%27GEODETIC%27&SITE_COORD=%27'
        + lonE.toFixed(4) + ',' + st.lat.toFixed(4) + ',' + ((st.elev || 0) / 1000).toFixed(3) + '%27&EPHEM_TYPE=%27OBSERVER%27&START_TIME=%27' + encodeURIComponent(f(d0)) + '%27&STOP_TIME=%27' + encodeURIComponent(f(d1)) + '%27&STEP_SIZE=%276h%27&QUANTITIES=%274%27&ANG_FORMAT=%27DEG%27';
    };
    $('#hzSun').href = hz('10'); $('#hzEarth').href = hz('399');
    drawTimeline(s.t);
    renderWindows(s.t);
    if ($('#box3d').open) open3D();
    renderCmpTable(s);
    $('#csvBtn').onclick = () => downloadCSV(s.t);
  }

  /* ---- timeline: Sun & Earth elevation vs. the terrain in their direction, over the mission ---- */
  function missionSeries(t0, site = state.site) { const mh = Model.settings.missionDays * 24; return Model.series(site, Math.floor(t0 / HOUR) * HOUR, mh); }
  const cmpSite = () => state.cmp ? SITES.find(x => x.id === state.cmp) : null;
  function renderWindows(t0) {
    const w = Model.windows(missionSeries(t0));
    const fmt = ms => { const d = new Date(ms); return `${fmtDate(ms).replace(/,? \d{4}$/, '')} ${String(d.getUTCHours()).padStart(2, '0')}:00`; };
    const col = (title, arr) => `<div><b>${title}</b><table class="vt"><tr><th>${T('wFrom')}</th><th>${T('wTo')}</th><th>${T('wDur')}</th></tr>${arr.length ? arr.map(x => `<tr><td>${fmt(x.start)}</td><td>${fmt(x.end)}</td><td>${fmtDur(x.hours)}${x.open ? ' *' : ''}</td></tr>`).join('') : `<tr><td colspan="3">${T('none2')}</td></tr>`}</table></div>`;
    $('#windows').innerHTML = col(T('wSun'), w.sun) + col(T('wEarth'), w.earth) + `<p class="hint">* ${T('wOpen')}</p>`;
  }
  function renderCmpTable(s) {
    const c = cmpSite(); if (!c) { $('#cmpTable').innerHTML = ''; return; }
    const o = Model.statsAt(c, s.t), short = n => n.replace(/\s*\(.*\)\s*$/, '');
    const dur = h => h < 0.5 ? `<span class="vsNone">${T('vsNever')}</span>` : fmtDur(h);
    // [label, a, b, display a, display b, higher is better?, bar max]
    const rows = [
      [T('sInSun'), s.sunPct, o.sunPct, s.sunPct.toFixed(0) + '%', o.sunPct.toFixed(0) + '%', true, 100],
      [T('sEarth'), s.earthPct, o.earthPct, s.earthPct.toFixed(0) + '%', o.earthPct.toFixed(0) + '%', true, 100],
      [T('sDark'), s.longestDarkH, o.longestDarkH, dur(s.longestDarkH), dur(o.longestDarkH), false, 0],
      [T('sNoEarth'), s.longestNoEarthH, o.longestNoEarthH, dur(s.longestNoEarthH), dur(o.longestNoEarthH), false, 0],
      [T('maxEl'), s.maxSunEl, o.maxSunEl, s.maxSunEl.toFixed(1) + '°', o.maxSunEl.toFixed(1) + '°', true, 0],
      [T('sModel', landerLabel()), s.survivedAll ? 1e9 : s.survivedH, o.survivedAll ? 1e9 : o.survivedH,
        s.survivedAll ? `<span class="vsOk">${Icons.icon('check')} ${T('survives')}</span>` : `<span class="vsBad">${Icons.icon('x')} ${days(s.survivedH)} ${T('dUnit')}</span>`,
        o.survivedAll ? `<span class="vsOk">${Icons.icon('check')} ${T('survives')}</span>` : `<span class="vsBad">${Icons.icon('x')} ${days(o.survivedH)} ${T('dUnit')}</span>`, true, 0]];
    let wa = 0, wb = 0;
    const body = rows.map(([l, va, vb, da, db, hi, max]) => {
      const win = Math.abs(va - vb) < 1e-6 ? 0 : (va > vb) === hi ? 1 : 2; if (win === 1) wa++; if (win === 2) wb++;
      const bar = (v, k) => max ? `<i class="cxBar ${k}"><b style="width:${Math.max(2, v / max * 100)}%"></b></i>` : '';
      return `<tr><th scope="row">${l}</th><td class="a${win === 1 ? ' win' : ''}"><bdi>${da}</bdi>${bar(va, 'a')}</td><td class="b${win === 2 ? ' win' : ''}"><bdi>${db}</bdi>${bar(vb, 'b')}</td></tr>`;
    }).join('');
    $('#cmpTable').innerHTML = `<div class="cxWrap"><table class="cx">
      <colgroup><col class="cxL"><col><col></colgroup>
      <thead><tr><th>${T('metric')}</th><th class="a"><i></i>${short(nameOf(state.site))}<small>${T('vsWins', wa)}</small></th><th class="b"><i></i>${short(c.name)}<small>${T('vsWins', wb)}</small></th></tr></thead>
      <tbody>${body}</tbody></table></div>`;
  }

  function drawTimeline(t0) {
    const c = $('#timeline'), g = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
    const Wc = c.clientWidth || 800, Hc = 240; c.width = Wc * dpr; c.height = Hc * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ser = missionSeries(t0), n = ser.length, cs = cmpSite(), ser2 = cs ? missionSeries(t0, cs) : null;
    let lo = Infinity, hi = -Infinity;
    [ser, ser2].filter(Boolean).forEach(S => S.forEach(h => { lo = Math.min(lo, h.sunEl, h.earthEl, h.hSun, h.hEarth); hi = Math.max(hi, h.sunEl, h.earthEl, h.hSun, h.hEarth); }));
    lo = Math.floor(Math.max(lo, -12)) - 1; hi = Math.ceil(Math.min(hi, 80)) + 1;
    const L = 40, R = 10, Tp = 14, B = 26, pw = Wc - L - R, ph = Hc - Tp - B;
    const x = i => L + i / (n - 1) * pw, y = v => Tp + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * ph;
    g.clearRect(0, 0, Wc, Hc);
    // sunlight and Earth bands
    ser.forEach((h, i) => {
      if (h.fSun >= 0.5) { g.fillStyle = 'rgba(255,192,77,.85)'; g.fillRect(x(i), Tp - 6, pw / n + 1, 4); }
      g.fillStyle = h.earth ? 'rgba(90,169,255,.55)' : 'rgba(252,61,33,.35)'; g.fillRect(x(i), Tp + ph + 4, pw / n + 1, 5);
    });
    // grid
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.fillStyle = '#a3b1cc'; g.font = '11px Inter, sans-serif'; g.textAlign = 'right';
    const stepE = (hi - lo) > 20 ? 10 : (hi - lo) > 8 ? 2 : 1;
    for (let v = Math.ceil(lo / stepE) * stepE; v <= hi; v += stepE) { g.beginPath(); g.moveTo(L, y(v)); g.lineTo(L + pw, y(v)); g.stroke(); g.fillText(v + '°', L - 6, y(v) + 4); }
    g.textAlign = 'center';
    const dStep = Wc < 520 ? (Model.settings.missionDays > 14 ? 14 : 7) : Model.settings.missionDays > 14 ? 7 : 2;
    for (let d = 0; d <= Model.settings.missionDays; d += dStep) { g.textAlign = d === 0 ? 'left' : d === Model.settings.missionDays ? 'right' : 'center'; g.fillText(T('dShort') + d, Math.min(x(Math.min(d * 24, n - 1)), L + pw), Hc - 4); }
    const line = (key, col, dash) => { g.strokeStyle = col; g.lineWidth = 2; g.setLineDash(dash || []); g.beginPath(); ser.forEach((h, i) => i ? g.lineTo(x(i), y(h[key])) : g.moveTo(x(i), y(h[key]))); g.stroke(); g.setLineDash([]); };
    line('hSun', 'rgba(255,192,77,.6)', [4, 4]); line('hEarth', 'rgba(90,169,255,.6)', [4, 4]);
    line('sunEl', '#ffc04d'); line('earthEl', '#5aa9ff');
    if (ser2) { const line2 = (key, col) => { g.strokeStyle = col; g.lineWidth = 2; g.setLineDash([1, 3]); g.beginPath(); ser2.forEach((h, i) => i ? g.lineTo(x(i), y(h[key])) : g.moveTo(x(i), y(h[key]))); g.stroke(); g.setLineDash([]); };
      line2('sunEl', '#ff7b54'); line2('earthEl', '#b48cff'); }
    $('#tlLegend').innerHTML = `<span><i style="background:#ffc04d"></i>${T('tlSun')}</span><span><i class="dash" style="border-color:#ffc04d"></i>${T('tlSunH')}</span><span><i style="background:#5aa9ff"></i>${T('tlEarth')}</span><span><i class="dash" style="border-color:#5aa9ff"></i>${T('tlEarthH')}</span><span><i style="background:rgba(255,192,77,.3)"></i>${T('tlLit')}</span><span><i style="background:#5aa9ff;height:5px"></i>/<i style="background:rgba(252,61,33,.6);height:5px"></i> ${T('tlLink')}</span>` + (cs ? `<span><i class="dash" style="border-color:#ff7b54;border-top-style:dotted"></i>${cs.name}: ${T('tlSun')}</span><span><i class="dash" style="border-color:#b48cff;border-top-style:dotted"></i>${cs.name}: ${T('tlEarth')}</span>` : '');
  }
  function downloadCSV(t0) {
    const ser = missionSeries(t0);
    const rows = ['utc,sun_az_deg,sun_el_deg,terrain_toward_sun_deg,sun_disk_visible_fraction,earth_az_deg,earth_el_deg,terrain_toward_earth_deg,earth_in_view'];
    ser.forEach(h => rows.push([new Date(h.t).toISOString(), h.sunAz.toFixed(3), h.sunEl.toFixed(3), h.hSun.toFixed(3), h.fSun.toFixed(3), h.earthAz.toFixed(3), h.earthEl.toFixed(3), h.hEarth.toFixed(3), h.earth ? 1 : 0].join(',')));
    const head = `# Lunar Landing Site Navigator (Team Wasl8) — ${state.site.name} (${state.site.lat.toFixed(4)}, ${state.site.lon.toFixed(4)}E), Earth margin ${Model.settings.earthMarginDeg} deg\n# Ephemeris: Astronomy Engine (validated vs JPL Horizons, <0.002 deg). Terrain: LRO LOLA LDEM_75S_240M (NASA PDS).\n`;
    const text = head + rows.join('\n'), name = `wasl8_${state.site.id}_${new Date(t0).toISOString().slice(0, 10)}.csv`;
    const url = 'data:text/csv;charset=utf-8,' + encodeURIComponent(text);
    exportBox(`<textarea class="exportTxt" readonly>${text.replace(/</g, '&lt;')}</textarea><div class="row"><button class="btn" id="copyCsv">${T('copy')}</button><a class="btn primary" href="${url}" download="${name}">${T('download')}</a></div><p class="hint">${T('dlHint')}</p>`);
    $('#copyCsv').onclick = async () => { try { await navigator.clipboard.writeText(text); $('#copyCsv').textContent = '✓'; } catch (e) { $('.exportTxt').select(); document.execCommand('copy'); $('#copyCsv').textContent = '✓'; } };
  }
  window.addEventListener('resize', () => { if (state.selDay != null && state.scores) drawTimeline(state.scores[state.selDay].t); });

  /* ---- 3D terrain (lazy: only loads three.js + terrain patches when opened) ---- */
  let V3 = null, v3dT0 = null, v3dPlay = null;
  async function open3D() {
    const box = $('#box3d'); if (!box.open || state.selDay == null) return;
    const t0 = state.hour ? state.scores[state.selDay].t + state.hour * HOUR : state.scores[state.selDay].t;
    if (!window.PATCHES) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'patches.js'; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
    if (!V3) { V3 = await import('./view3d.js'); V3.init($('#v3d')); } else V3.attach($('#v3d'));
    const p = window.PATCHES[state.site.id];
    $('#v3dMsg').textContent = p ? '' : T('v3dNone'); $('#v3dMsg').hidden = !!p;
    if (!p) return;
    V3.setTerrain(p, +$('#v3dEx').value);
    v3dT0 = t0; $('#v3dTime').max = Model.settings.missionDays * 24 - 1; set3DTime(+$('#v3dTime').value);
  }
  function set3DTime(i) {
    if (!V3 || v3dT0 == null) return;
    const ser = missionSeries(v3dT0), h = ser[Math.min(i, ser.length - 1)];
    V3.setSky(h.sunAz, h.sunEl, h.earthAz, h.earthEl);
    $('#v3dInfo').innerHTML = `${fmtDT(h.t)} · ☀ ${h.sunEl.toFixed(2)}° (${(h.fSun * 100).toFixed(0)}% ${T('v3dVis')}) · 🌍 ${h.earth ? T('connected') : T('noSignal')} — ${T('v3dNote')}`;
  }
  $('#box3d').addEventListener('toggle', open3D);
  $('#v3dTime').oninput = e => set3DTime(+e.target.value);
  $('#v3dEx').onchange = () => { const p = window.PATCHES && window.PATCHES[state.site.id]; if (V3 && p) V3.setTerrain(p, +$('#v3dEx').value); };
  $('#v3dPlay').onclick = () => {
    if (v3dPlay) { clearInterval(v3dPlay); v3dPlay = null; return; }
    v3dPlay = setInterval(() => { const r = $('#v3dTime'); r.value = (+r.value + 1) % (+r.max + 1); set3DTime(+r.value); }, 60);
  };

  /* ---------------- 3D Explore (full screen, NASA-Eyes style) ---------------- */
  const POLAR = () => SITES.filter(x => x.lat < -79.5);
  let exT0 = null, exSer = null, exRaf = null, exPlaying = false, exSpeed = 6, exLast = 0, exPos = 0;
  async function openExplore() {
    if (!window.PATCHES) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'patches.js'; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
    if (!V3) { V3 = await import('./view3d.js'); V3.init($('#exHost')); } else V3.attach($('#exHost'));
    $('#exSites').innerHTML = POLAR().map(x => `<button class="exChip ${x.id === state.site.id ? 'active' : ''}" data-id="${x.id}">${x.name.replace(' (IM-1 landing)', '').replace(' (CLPS target)', '')}</button>`).join('');
    $$('#exSites .exChip').forEach(b => b.onclick = () => { state.site = SITES.find(x => x.id === b.dataset.id); refresh(); });
    const p = window.PATCHES[state.site.id];
    $('#exMsg').hidden = !!p; $('#exMsg').textContent = T('exNo3d');
    $('#exSite').textContent = nameOf(state.site);
    $('#exCoords').textContent = `${state.site.lat.toFixed(3)}°, ${state.site.lon.toFixed(3)}°E${state.site.elev ? ' · ' + state.site.elev + ' m' : ''}`;
    if (!p) return;
    V3.setTerrain(p, 2); V3.setView(30, 0.35);
    exT0 = state.scores && state.selDay != null ? state.scores[state.selDay].t + (state.hour || 0) * HOUR : Date.UTC(state.year, 0, 1);
    exSer = missionSeries(exT0); $('#exTime').max = exSer.length - 1;
    // sunlight / Earth bands under the timeline
    $('#exBands').innerHTML = `<svg viewBox="0 0 ${exSer.length} 10" preserveAspectRatio="none">${exSer.map((h, i) => `<rect x="${i}" y="0" width="1.05" height="7" fill="${h.fSun >= .5 ? 'rgba(255,214,140,.9)' : 'rgba(255,255,255,.12)'}"/>` + (h.earth ? `<rect x="${i}" y="8" width="1.05" height="2" fill="#6fb1ff"/>` : '')).join('')}</svg>`;
    exPos = 0; $('#exTime').value = 0; exUpdate(); exLoop();
  }
  function exUpdate() {
    if (!exSer) return;
    const i = Math.min(exSer.length - 1, Math.floor(exPos)), h = exSer[i];
    V3.setSky(h.sunAz, h.sunEl, h.earthAz, h.earthEl);
    const dd = new Date(h.t), MO = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    $('#exDate').innerHTML = `<b>${MO[dd.getUTCMonth()]} ${dd.getUTCDate()} ${dd.getUTCFullYear()} · ${String(dd.getUTCHours()).padStart(2, '0')}:00 UTC</b><span>MET T+${Math.floor(i / 24)}d ${String(i % 24).padStart(2, '0')}:00</span>`;
    const pc = (i / Math.max(1, exSer.length - 1) * 100) + '%'; $('#exFill').style.width = pc; $('#exKnob').style.left = pc;
    const nxt = (pred) => { for (let j = i + 1; j < exSer.length; j++) if (pred(exSer[j])) return j - i; return null; };
    const sunUp = h.fSun >= .5, tS = nxt(x => (x.fSun >= .5) !== sunUp), tE = nxt(x => x.earth !== h.earth);
    const lit = exSer.slice(0, i + 1), sunPct = lit.reduce((a, x) => a + x.fSun, 0) / lit.length * 100, ePct = lit.filter(x => x.earth).length / lit.length * 100;
    $('#exPanel').innerHTML = `
      <div class="exStat"><div class="exK">${T('exSun')}</div><div class="exV">${h.sunEl.toFixed(2)}°</div><div class="exS">${T('sunLine', h.sunEl.toFixed(2), h.hSun.toFixed(2), (h.fSun * 100).toFixed(0)).split('·').slice(1).join('·')}</div></div>
      <div class="exStat"><div class="exK">${T('exLink')}</div><div class="exV" style="color:${h.earth ? '#2ecc71' : '#ff6b57'}">${h.earth ? T('connected') : T('noSignal')}</div><div class="exS">${T('earthLine', h.earthEl.toFixed(2), h.hEarth.toFixed(2))}</div></div>
      <div class="exStat"><div class="exK">${T('exNext')}</div><div class="exV">${tS == null ? T('none2') : fmtDur(tS)}</div><div class="exS">${tS == null ? '' : (sunUp ? T('exSunset') : T('exSunrise'))}${tE == null ? '' : ' · ' + (h.earth ? T('exLos') : T('exAos')) + ' ' + fmtDur(tE)}</div></div>
      <div class="exStat"><div class="exK">${T('exMission')}</div><div class="exV">☀ ${sunPct.toFixed(0)}% · 🌍 ${ePct.toFixed(0)}%</div></div>`;
    placeLabels();
  }
  function placeLabels() {
    for (const [id, w] of [['#lbSun', 'sun'], ['#lbEarth', 'earth'], ['#lbLander', 'lander']]) {
      const p = V3 && V3.screenPos(w), el = $(id);
      if (!p) { el.style.display = 'none'; continue; }
      el.style.display = 'block'; el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
  }
  function exLoop() {
    cancelAnimationFrame(exRaf);
    const tick = ts => {
      const dt = exLast ? Math.min(.1, (ts - exLast) / 1000) : 0; exLast = ts;
      if (exPlaying && exSer) { exPos += dt * exSpeed; if (exPos >= exSer.length - 1) { exPos = exSer.length - 1; exPlaying = false; $('#exPlay').innerHTML = Icons.icon('play'); } $('#exTime').value = Math.floor(exPos); exUpdate(); }
      else placeLabels();
      exRaf = requestAnimationFrame(tick);
    };
    exRaf = requestAnimationFrame(tick);
  }
  function exStop() { cancelAnimationFrame(exRaf); exRaf = null; exPlaying = false; }
  $('#exTime').oninput = e => { exPos = +e.target.value; exUpdate(); };
  $('#exPlay').onclick = () => { exPlaying = !exPlaying; if (exPlaying && exSer && exPos >= exSer.length - 1) exPos = 0; $('#exPlay').innerHTML = Icons.icon(exPlaying ? 'pause' : 'play'); };
  const EXS = [[1, '1 h/s'], [6, '6 h/s'], [24, '1 day/s']];
  $('#exSpeed').onclick = () => { const k = (EXS.findIndex(x => x[0] === exSpeed) + 1) % EXS.length; exSpeed = EXS[k][0]; $('#exSpeed').innerHTML = Icons.icon('gear') + ' ' + EXS[k][1]; };
  $('#exPlan').onclick = () => show('planner');
  $('#exBest').onclick = () => { if (state.three) { selectDay(state.three.best.day); openExplore(); exPlaying = true; $('#exPlay').innerHTML = Icons.icon('pause'); } };
  $('#exWorst').onclick = () => { if (state.three) { selectDay(state.three.worst.day); openExplore(); exPlaying = true; $('#exPlay').innerHTML = Icons.icon('pause'); } };
  $('#exLive').onclick = () => { if (exSer) { startMission(state.site, exSer[Math.floor(exPos)].t); show('cockpit'); } };

  /* ---------------- cockpit ---------------- */
  const cv = $('#win'), ctx = cv.getContext('2d');
  let raf = null, speed = 3600, lastFrame = 0, viewAz = 0, dragging = null;
  const rnd = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  const stars = Array.from({ length: 420 }, (_, i) => ({ az: rnd(i) * 360, el: 0.5 + rnd(i + 500) * 60, b: 0.3 + rnd(i + 900) * 0.7 }));

  function startMission(site, t0, challenge = false) {
    const H = Model.settings.missionDays * 24;
    const start = Math.floor(t0 / HOUR) * HOUR;
    const ser = Model.series(site, start, H + 48);
    state.mission = {
      site, start, H, ser, t: start, E: Model.settings.lander.batteryWh, alive: true, diedAt: null,
      prevSun: null, prevEarth: null, warned20: false, warned5: false, minBat: 1, trace: [], log: [], ended: false, challenge, hibernate: false,
    };
    const first = Model.sample(site, start);
    viewAz = first.fSun > 0 || first.sunEl > -2 ? first.sunAz : first.earthAz;
    $('#hudSite').innerHTML = `<b>${nameOf(site)}</b><span class="hc"> · <bdi>${site.lat.toFixed(2)}°, ${site.lon.toFixed(2)}°E</bdi></span>`;
    $('#log').innerHTML = ''; $('#whyBox').hidden = true; $('#alarm').hidden = true;
    logEvt(T('touchdown', nameOf(site), Model.settings.missionDays));
    showTips();
    speed = 3600; $$('.speed .chip').forEach(c => c.classList.toggle('active', +c.dataset.speed === speed));
    resizeCanvas(); play();
    Sfx.thud(); setTimeout(() => shake(true), 30); Sfx.humStart();
  }

  function logEvt(msg) { const m = state.mission; const line = `<div>[${m ? fmtDT(m.t).slice(5) : ''}] ${msg}</div>`; $('#log').insertAdjacentHTML('afterbegin', line); m && m.log.push(msg); }

  // --- sound, shake, haptics ---
  $('#devSound').checked = !Sfx.muted;
  $('#devSound').onchange = e => { Sfx.setMuted(!e.target.checked); if (e.target.checked && raf) Sfx.humStart(); };
  function shake(strong) {
    const w = $('.windowWrap'); w.classList.remove('shake', 'shakeSoft'); void w.offsetWidth;
    w.classList.add(strong ? 'shake' : 'shakeSoft');
  }
  document.addEventListener('click', e => { if (e.target.closest('button, .site, .day, select, label.sw')) Sfx.click(); }, true);
  let alarmTimer = null;
  // kind: good | warn | alarm | sunset | los | signal | lost
  function alarm(text, kind = 'alarm') {
    const a = $('#alarm'); a.textContent = text; a.className = 'alarm' + (['good', 'signal'].includes(kind) ? ' good' : ''); a.hidden = false;
    clearTimeout(alarmTimer); alarmTimer = setTimeout(() => a.hidden = true, 3500);
    ({ good: Sfx.good, signal: Sfx.signal, warn: Sfx.warn, alarm: Sfx.alarm, sunset: Sfx.sunset, los: Sfx.lossOfSignal, lost: Sfx.lost }[kind] || Sfx.alarm)();
    if (['alarm', 'lost'].includes(kind)) shake(true); else if (['sunset', 'los', 'warn'].includes(kind)) shake(false);
    logEvt(text);
  }

  // interpolated sky at time t from the hourly series (fast) — exact sample for display
  function skyNow(m) { return Model.sample(m.site, m.t); }

  function nextChange(m, key, want) {
    // hours until series[key] becomes `want` (fSun>=0.5 for sun), linear within the hour
    const i0 = Math.floor((m.t - m.start) / HOUR);
    const val = h => key === 'sun' ? h.fSun >= 0.5 : h.earth;
    for (let i = Math.max(0, i0 + 1); i < m.ser.length; i++) if (val(m.ser[i]) === want) return (m.ser[i].t - m.t) / HOUR;
    return null;
  }

  function step(dtSec, forceHours) {
    const m = state.mission; if (!m || m.ended) return;
    const L = Model.settings.lander;
    let remain = forceHours != null ? forceHours : dtSec * speed / 3600; // hours of sim time
    while (remain > 0 && !m.ended) {
      const dh = Math.min(remain, 0.25); remain -= dh;
      m.t += dh * HOUR;
      const s = skyNow(m);
      const load = L.baseW + (s.earth ? L.radioW : 0) + ($('#devHeater').checked ? L.heaterW : 0) + ($('#devCamera').checked ? L.cameraW : 0);
      const pw = L.panelW * s.fSun * Model.panelFactor(s);
      m.pw = pw; m.load = load; m.sky = s;
      if (m.alive) {
        m.E = Math.min(L.batteryWh, m.E + (pw - load) * dh);
        if (m.E <= Model.RESERVE * L.batteryWh) { m.E = Model.RESERVE * L.batteryWh; m.alive = false; m.diedAt = m.t; alarm(T('aEmpty'), 'lost'); end('lost'); }
      }
      const frac = m.E / L.batteryWh; m.minBat = Math.min(m.minBat, frac);
      if (m.trace.length === 0 || m.t - m.trace[m.trace.length - 1].t >= HOUR) m.trace.push({ t: m.t, b: frac, sun: s.fSun, earth: s.earth });
      // events
      const sunUp = s.fSun >= 0.5;
      if (m.prevSun !== null && sunUp !== m.prevSun) sunUp ? alarm(T('aSunrise'), 'good') : alarm(T('aSunset'), 'sunset');
      if (m.prevEarth !== null && s.earth !== m.prevEarth) s.earth ? alarm(T('aSignal'), 'signal') : alarm(T('aLos'), 'los');
      m.prevSun = sunUp; m.prevEarth = s.earth;
      if (frac < 0.4 && !m.warned20) { m.warned20 = true; alarm(T('aLow'), 'warn'); }
      if (frac < 0.25 && !m.warned5) { m.warned5 = true; alarm(T('aCrit')); }
      if (frac > 0.5) { m.warned20 = false; m.warned5 = false; }
      if (m.t - m.start >= m.H * HOUR) { logEvt(T('timeDone')); end('complete'); }
    }
  }

  function end(reason) {
    const m = state.mission; if (!m || m.ended) return;
    m.ended = true; pause();
    m.reason = reason || (m.alive ? 'complete' : 'lost');
    state.lastMission = m;
    if (m.reason === 'complete') Sfx.win();
    setTimeout(() => { renderReport(); show('report'); }, 1200);
  }

  function updateHUD() {
    const m = state.mission; if (!m) return;
    const s = m.sky || skyNow(m); m.sky = s;
    const L = Model.settings.lander, frac = m.E / L.batteryWh;
    const met = (m.t - m.start) / 1000, dd = Math.floor(met / 86400), hh = Math.floor(met % 86400 / 3600), mm = Math.floor(met % 3600 / 60);
    $('#hudClock').textContent = `MET T+${dd}d ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${fmtDT(m.t)}`;
    $('#batBar').style.width = (frac * 100).toFixed(1) + '%';
    $('#batBar').parentElement.style.setProperty('--reserve', (Model.RESERVE * 100) + '%');
    $('#batBar').style.background = frac < 0.25 ? 'var(--bad)' : frac < 0.4 ? 'var(--warn)' : 'var(--ok)';
    $('#vignette').className = 'vignette' + (frac < 0.25 ? ' crit' : frac < 0.4 ? ' low' : '');
    $('#batVal').textContent = `${(frac * 100).toFixed(0)}% · ${Math.round(m.E)} Wh`;
    $('#pwrVal').dir = 'ltr'; $('#pwrVal').textContent = `+${Math.round(L.panelW * s.fSun * Model.panelFactor(s))} W`;
    $('#sunVal').textContent = `${T('wOut')}: ${iso(Math.round(m.load || L.baseW) + ' W')} · ` + T('sunLine', iso(s.sunEl.toFixed(2)), iso(s.hSun.toFixed(2)), (s.fSun * 100).toFixed(0));
    $('#comVal').textContent = s.earth ? T('connected') : T('noSignal');
    $('#comVal').style.color = s.earth ? 'var(--ok)' : 'var(--bad)';
    $('#earthVal').textContent = T('earthLine', iso(s.earthEl.toFixed(2)), iso(s.hEarth.toFixed(2)));
    const elapsed = (m.t - m.start) / HOUR;
    $('#dayVal').textContent = T('dayOf', (elapsed / 24 + 1).toFixed(1), Model.settings.missionDays);
    $('#aliveVal').textContent = m.alive ? T('alive') : T('lostAfter', days((m.diedAt - m.start) / HOUR));
    // countdowns
    const sunUp = s.fSun >= 0.5;
    const tSun = nextChange(m, 'sun', !sunUp), tEarth = nextChange(m, 'earth', !s.earth);
    const net = (m.pw || 0) - (m.load || L.baseW);
    const tBat = net < 0 ? Math.max(0, m.E - Model.RESERVE * L.batteryWh) / -net : null;
    $('#countdowns').innerHTML =
      `<div class="cd">${sunUp ? T('sunsetIn') : T('sunriseIn')}<b class="${tSun == null ? 'tx' : ''}">${tSun == null ? T('notThis') : fmtDur(tSun)}</b></div>` +
      `<div class="cd">${s.earth ? T('earthLostIn') : T('earthBackIn')}<b class="${tEarth == null ? 'tx' : ''}">${tEarth == null ? T('notThis') : fmtDur(tEarth)}</b></div>` +
      `<div class="cd">${tBat ? T('batEmptyIn') : T('battery')}<b class="${tBat ? '' : 'tx'}">${tBat ? fmtDur(tBat) : net > 0 ? T('charging') : '—'}</b></div>`;
  }

  /* --- window drawing --- */
  function resizeCanvas() {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(300, r.width * dpr); cv.height = Math.max(200, r.height * dpr);
    draw();
  }
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', () => setTimeout(() => { resizeCanvas(); drawMap(); if (state.selDay != null && state.scores) drawTimeline(state.scores[state.selDay].t); }, 300));

  const VEX = 3; // vertical exaggeration
  // pre-rendered regolith speckle for the foreground
  const regolith = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    for (let i = 0; i < 2600; i++) { const v = 90 + rnd(i + 3000) * 120; g.fillStyle = `rgba(${v},${v - 4},${v - 10},${0.05 + rnd(i + 7000) * 0.12})`; g.fillRect(rnd(i + 1000) * 256, rnd(i + 2000) * 256, 1 + rnd(i) * 2, 1 + rnd(i + 5) * 1.5); }
    for (let i = 0; i < 40; i++) { const x = rnd(i + 8000) * 256, y = rnd(i + 9000) * 256, r = 2 + rnd(i + 9500) * 9; g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, r, r * 0.35, 0, 0, 7); g.stroke(); }
    return c;
  })();
  const iso = x => '\u2066' + x + '\u2069';
  // value-noise fBm for the procedural Earth disc
  const vn = (x, y, s) => { const h = (i, j) => { let q = i * 374761393 + j * 668265263 + s * 982451653; q = (q ^ (q >>> 13)) * 1274126177; return ((q ^ (q >>> 16)) >>> 0) / 4294967295; };
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const A = h(xi, yi), B = h(xi + 1, yi), C = h(xi, yi + 1), D = h(xi + 1, yi + 1); return A + (B - A) * u + (C - A) * v + (A - B - C + D) * u * v; };
  const fbm2 = (x, y, s) => { let t = 0, a2 = .5, f = 1; for (let o = 0; o < 6; o++) { t += a2 * vn(x * f, y * f, s + o); a2 *= .5; f *= 2; } return t / .984; };
  // pre-rendered Earth: oceans, continents, ice, clouds, limb darkening (orthographic sphere)
  const earthDisc = (() => {
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const nx = (x + .5) / N * 2 - 1, ny = (y + .5) / N * 2 - 1, r2 = nx * nx + ny * ny, i = (y * N + x) * 4;
      if (r2 > 1) { im.data[i + 3] = 0; continue; }
      const nz = Math.sqrt(1 - r2), lat = Math.asin(-ny), lon = Math.atan2(nx, nz) + 1.1;
      const u = lon * 1.6, v = lat * 1.6, land = fbm2(u + 7, v + 3, 21), al = Math.abs(lat);
      let R, G, B;
      if (al > 1.2) { R = G = B = 230; }
      else if (land > .55) { const dry = Math.max(0, Math.min(1, (fbm2(u * 2, v * 2, 25) - .42) * 2.4 + (1 - al) * .3 - .2)); R = 55 + dry * 125; G = 72 + dry * 72; B = 42 + dry * 40; }
      else { const d = Math.min(1, (.55 - land) * 6); R = 10 + 14 * (1 - d); G = 32 + 40 * (1 - d); B = 80 + 55 * (1 - d); }
      const cl = Math.max(0, Math.min(1, (fbm2(u * 1.4 + 30, v * 2.6, 31) - .5) * 3.2));
      R += (245 - R) * cl; G += (248 - G) * cl; B += (252 - B) * cl;
      const limb = .55 + .45 * Math.pow(nz, .5);
      im.data[i] = R * limb; im.data[i + 1] = G * limb; im.data[i + 2] = B * limb; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0); return c;
  })();
  function angDiff(a, b) { return ((a - b + 540) % 360) - 180; }
  function draw() {
    const m = state.mission; if (!m) return;
    const W = cv.width, H = cv.height, s = m.sky || skyNow(m), dpr = window.devicePixelRatio || 1;
    const fov = Math.min(140, Math.max(70, W / H * 45));
    const ppd = W / fov, ppv = ppd * VEX;
    const horizonY = H * 0.66;
    const X = az => W / 2 + angDiff(az, viewAz) * ppd;
    const Y = el => horizonY - el * ppv;
    const sunUp = s.fSun > 0, prof = Model.horizonFor(m.site), tnow = performance.now() / 1000;
    // sky: pure black (no air on the Moon) with a hint of sun glare when it is up
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < stars.length; i++) {
      const st = stars[i], x = X(st.az), y = Y(st.el / VEX * 1.2);
      if (x < 0 || x > W || y < 0 || y > horizonY) continue;
      const tw = 0.85 + 0.15 * Math.sin(tnow * 2 + i);
      ctx.fillStyle = `rgba(255,255,255,${st.b * tw * (sunUp ? 0.25 : 0.95)})`; ctx.fillRect(x, y, 1.3 * dpr, 1.3 * dpr);
    }
    // Sun with corona and lens flare
    const sx = X(s.sunAz), sy = Y(s.sunEl), sr = Math.max(7 * dpr, 0.267 * ppv);
    if (s.sunEl > -3) {
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 14);
      glow.addColorStop(0, 'rgba(255,236,200,.75)'); glow.addColorStop(0.15, 'rgba(255,214,150,.25)'); glow.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, sr * 14, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(sx, sy); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 6; k++) { ctx.rotate(Math.PI / 6); const g2 = ctx.createLinearGradient(-sr * 10, 0, sr * 10, 0); g2.addColorStop(0, 'rgba(255,230,180,0)'); g2.addColorStop(0.5, 'rgba(255,230,180,.22)'); g2.addColorStop(1, 'rgba(255,230,180,0)'); ctx.fillStyle = g2; ctx.fillRect(-sr * 10, -0.6 * dpr, sr * 20, 1.2 * dpr); }
      ctx.restore();
      ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
    }
    // Earth with the correct phase: lit side faces the Sun, lit fraction from the Sun–Moon–Earth geometry
    const ex = X(s.earthAz), ey = Y(s.earthEl), er = Math.max(11 * dpr, 0.95 * ppv);
    if (s.earthEl > -4) {
      const d2r = Math.PI / 180;
      const cosEl = Math.sin(s.sunEl * d2r) * Math.sin(s.earthEl * d2r) + Math.cos(s.sunEl * d2r) * Math.cos(s.earthEl * d2r) * Math.cos((s.sunAz - s.earthAz) * d2r);
      const lit = (1 - cosEl) / 2;                       // Earth's lit fraction as seen from the Moon
      const ang = Math.atan2(sy - ey, sx - ex);
      ctx.save(); ctx.translate(ex, ey);
      // thin atmosphere limb, brightest on the Sun side
      ctx.save(); ctx.rotate(ang);
      const atm = ctx.createRadialGradient(er * .12, 0, er * .95, 0, 0, er * 1.18); atm.addColorStop(0, 'rgba(120,175,255,.5)'); atm.addColorStop(1, 'rgba(120,175,255,0)');
      ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(0, 0, er * 1.18, 0, 7); ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.arc(0, 0, er, 0, 7); ctx.clip();
      ctx.drawImage(earthDisc, -er, -er, 2 * er, 2 * er);
      // night side (faint, not pitch black: lit by the full Moon = "moonshine"), soft terminator
      ctx.rotate(ang);
      ctx.filter = `blur(${Math.max(1, er * .06)}px)`;
      ctx.fillStyle = 'rgba(3,7,18,.9)';
      ctx.beginPath(); ctx.arc(0, 0, er + 2, Math.PI / 2, Math.PI * 1.5);
      const tx = er * (1 - 2 * lit);                     // terminator ellipse half-width
      ctx.ellipse(0, 0, Math.abs(tx), er + 2, 0, -Math.PI / 2, Math.PI / 2, tx < 0);
      ctx.fill(); ctx.filter = 'none';
      ctx.restore();
    }
    // terrain: lit by the Sun from its direction, dim earthshine at night; no haze (no air)
    const step = 2 * dpr;
    const earthshine = !sunUp && s.earthEl > 0 ? 0.12 : 0.04;
    const sunK = s.sunEl > -1 ? Math.max(0, Math.min(1, s.sunEl + 1)) : 0;
    const tops = [];
    for (let px = 0; px <= W + step; px += step) tops.push(Y(Lunar.horizonAt(prof, viewAz + (px - W / 2) / ppd)));
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, H); for (let k = 0, px = 0; px <= W + step; px += step, k++) ctx.lineTo(px, tops[k]); ctx.lineTo(W + step, H); ctx.closePath(); ctx.clip();
    for (let k = 0, px = 0; px <= W; px += step, k++) {
      const az = viewAz + (px - W / 2) / ppd, top = Math.min(tops[k], tops[k + 1] ?? tops[k]);
      const facing = Math.cos(angDiff(az, s.sunAz) * Math.PI / 180);   // +1 = looking toward the Sun (backlit)
      const side = Math.sign(angDiff(s.sunAz, az)) || 1;                // Sun to the right (+) or left (-)
      const slope = (tops[Math.max(0, k - 1)] - tops[Math.min(tops.length - 1, k + 1)]) / (2 * step); // >0 rising to the right
      const slopeLit = Math.max(-1, Math.min(1, -slope * side * 2.5));    // faces toward the Sun = brighter
      const lum = sunUp ? Math.max(0.05, 0.16 + 0.55 * sunK * (0.5 - 0.5 * facing) + 0.28 * sunK * slopeLit) : earthshine;
      const r = 30 + 190 * lum, g2 = 29 + 182 * lum, b = 28 + 168 * lum + (sunUp ? 0 : 18 * earthshine);
      const grd = ctx.createLinearGradient(0, top, 0, H);
      grd.addColorStop(0, `rgb(${r | 0},${g2 | 0},${b | 0})`); grd.addColorStop(.35, `rgb(${(r * .55) | 0},${(g2 * .55) | 0},${(b * .56) | 0})`); grd.addColorStop(1, `rgb(${(r * 0.18) | 0},${(g2 * 0.18) | 0},${(b * 0.2) | 0})`);
      ctx.fillStyle = grd; ctx.fillRect(px, top - 1, step + 1, H - top + 1);
    }
    ctx.restore();
    // regolith texture over all the ground (clipped to the skyline)
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, H); for (let k = 0, px = 0; px <= W + step; px += step, k++) ctx.lineTo(px, tops[k]); ctx.lineTo(W, H); ctx.closePath(); ctx.clip();
    ctx.globalAlpha = 0.6; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(regolith, 'repeat');
    ctx.translate(-(viewAz * ppd) % 256, 0); ctx.fillRect((viewAz * ppd) % 256 - 256, 0, W + 512, H); ctx.restore();
    // sunlit crest: a thin bright line along the skyline where the Sun grazes it
    if (sunUp) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.5 * dpr;
      for (let k = 1, px = step; px <= W; px += step, k++) {
        const az = viewAz + (px - W / 2) / ppd, facing = Math.cos(angDiff(az, s.sunAz) * Math.PI / 180);
        const a2 = (0.12 + 0.6 * Math.max(0, facing)) * sunK; if (a2 < .03) continue;
        ctx.strokeStyle = `rgba(255,228,180,${a2})`; ctx.beginPath(); ctx.moveTo(px - step, tops[k - 1]); ctx.lineTo(px, tops[k]); ctx.stroke();
      }
      ctx.restore();
    }
    // HUD: heading tape, reticle, elevation ladder
    ctx.font = `${11 * dpr}px DM Mono, monospace`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(160,220,255,.75)'; ctx.strokeStyle = 'rgba(160,220,255,.5)'; ctx.lineWidth = dpr;
    for (let a = 0; a < 360; a += 5) {
      const x = X(a); if (x < 0 || x > W) continue;
      const major = a % 15 === 0; ctx.beginPath(); ctx.moveTo(x, 34 * dpr); ctx.lineTo(x, (major ? 44 : 39) * dpr); ctx.stroke();
      if (major) ctx.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[a] || String(a), x, 56 * dpr);
    }
    ctx.beginPath(); ctx.moveTo(W / 2, 30 * dpr); ctx.lineTo(W / 2 - 5 * dpr, 24 * dpr); ctx.lineTo(W / 2 + 5 * dpr, 24 * dpr); ctx.closePath(); ctx.fillStyle = '#FC3D21'; ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(160,220,255,.6)';
    for (let e = -2; e <= 8; e += 2) { const y = Y(e); if (y < 70 * dpr || y > H - 20 * dpr) continue; ctx.beginPath(); ctx.moveTo(W - 34 * dpr, y); ctx.lineTo(W - (e === 0 ? 14 : 22) * dpr, y); ctx.stroke(); ctx.fillText((e > 0 ? '+' : '') + e + '°', W - 66 * dpr, y + 4 * dpr); }
    ctx.strokeStyle = 'rgba(160,220,255,.35)'; ctx.setLineDash([4 * dpr, 6 * dpr]); ctx.beginPath(); ctx.moveTo(0, horizonY); ctx.lineTo(W, horizonY); ctx.stroke(); ctx.setLineDash([]);
    // target brackets + labels
    ctx.textAlign = 'center'; ctx.font = document.documentElement.lang === 'ar' ? `700 ${12 * dpr}px Cairo, 'IBM Plex Sans Arabic', sans-serif` : `600 ${11 * dpr}px DM Mono, monospace`;
    const bracket = (x, y, r, c, t) => {
      if (x < -r || x > W + r) return; const k = r + 6 * dpr, l = 6 * dpr; ctx.strokeStyle = c; ctx.lineWidth = 1.5 * dpr;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(x + a * k, y + b * (k - l)); ctx.lineTo(x + a * k, y + b * k); ctx.lineTo(x + a * (k - l), y + b * k); ctx.stroke(); });
      ctx.fillStyle = c; ctx.fillText(t, x, y - k - 6 * dpr);
    };
    if (s.sunEl > -3) bracket(sx, sy, sr, '#ffcf7a', s.fSun > 0 ? T('SUN') : T('SUNB'));
    if (s.earthEl > -4) bracket(ex, ey, er, s.earth ? '#8cc4ff' : '#ff8a7a', s.earth ? T('EARTH') : T('EARTHH'));
    // off-screen pointers
    const edge = (az, c, t) => { const d = angDiff(az, viewAz); if (Math.abs(d) < fov / 2) return; const x = d < 0 ? 16 * dpr : W - 16 * dpr; ctx.fillStyle = c; ctx.textAlign = d < 0 ? 'left' : 'right'; ctx.fillText((d < 0 ? '◀ ' : '') + t + (d > 0 ? ' ▶' : ''), x, horizonY - 40 * dpr); };
    edge(s.sunAz, '#ffcf7a', T('SUN')); edge(s.earthAz, '#8cc4ff', T('EARTH'));
  }

  // drag to pan
  cv.addEventListener('pointerdown', e => { dragging = { x: e.clientX, az: viewAz }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!dragging) return; const r = cv.getBoundingClientRect();
    const fov = Math.min(140, Math.max(70, cv.width / cv.height * 45));
    viewAz = (dragging.az - (e.clientX - dragging.x) / r.width * fov + 360) % 360; draw();
  });
  cv.addEventListener('pointerup', () => dragging = null);
  $('#lookSun').onclick = () => { const m = state.mission; if (m) { viewAz = (m.sky || skyNow(m)).sunAz; draw(); } };
  $('#lookEarth').onclick = () => { const m = state.mission; if (m) { viewAz = (m.sky || skyNow(m)).earthAz; draw(); } };

  function loop(ts) {
    const dt = lastFrame ? Math.min(0.1, (ts - lastFrame) / 1000) : 0; lastFrame = ts;
    step(dt); updateHUD(); draw();
    const m = state.mission;
    if (m && !m.ended && $('#devTicks').checked) { Sfx.ticks((m.pw || 0) / Model.settings.lander.panelW); Sfx.ticksPump(); } else Sfx.ticksStop();
    if (state.mission && !state.mission.ended && speed > 0) raf = requestAnimationFrame(loop); else raf = null;
  }
  function play() { if (!raf && state.mission && !state.mission.ended) { lastFrame = 0; raf = requestAnimationFrame(loop); Sfx.humStart(); } updateHUD(); draw(); }
  function pause() { if (raf) cancelAnimationFrame(raf); raf = null; Sfx.humStop(); }
  $$('.speed .chip').forEach(c => c.onclick = () => {
    speed = +c.dataset.speed; $$('.speed .chip').forEach(x => x.classList.toggle('active', x === c)); Sfx.setQuiet(speed >= 21600);
    if (speed > 0) play(); else pause();
  });
  // skip to the next event (sunset/sunrise or Earth lost/back), simulating the battery on the way
  $('#nextEvt').onclick = () => {
    const m = state.mission; if (!m || m.ended) return;
    const s = m.sky || skyNow(m);
    const a = nextChange(m, 'sun', !(s.fSun >= 0.5)), b = nextChange(m, 'earth', !s.earth);
    const left = m.H - (m.t - m.start) / HOUR;
    const h = Math.min(a == null ? Infinity : a, b == null ? Infinity : b, left);
    Sfx.setQuiet(true); step(0, Math.max(0.25, h - 0.25)); Sfx.setQuiet(speed >= 21600);
    step(0, 0.5); updateHUD(); draw();
    if (!raf && !m.ended) play();
  };
  // first-time tips
  function showTips() {
    let seen = false; try { seen = localStorage.getItem('wasl8-tips') === '1'; } catch (e) { }
    if (seen) return;
    const steps = T('tips'); let i = 0;
    const box = $('#tips');
    clearTimeout(state.tipTimer);
    const render = () => { clearTimeout(state.tipTimer); state.tipTimer = setTimeout(() => { const b2 = $('#tipNext'); b2 && b2.click(); }, 7000); box.hidden = false; box.innerHTML = `<b>${i + 1}/${steps.length}</b> ${steps[i]} <button class="btn" id="tipNext">${i < steps.length - 1 ? T('next') : T('gotIt')}</button>`; $('#tipNext').onclick = () => { i++; if (i >= steps.length) { box.hidden = true; try { localStorage.setItem('wasl8-tips', '1'); } catch (e) { } } else render(); }; };
    render();
  }
  $('#endMission').onclick = () => { if (state.mission && !state.mission.ended) { logEvt(T('byOperator')); end('aborted'); } };

  $('#why').onclick = () => {
    const m = state.mission; if (!m) return;
    const s = m.sky || skyNow(m), box = $('#whyBox');
    const lat = m.site.lat, polar = lat < -75;
    let t = '';
    if (s.fSun >= 1) t += T('whySunFull', s.sunEl.toFixed(2), s.hSun.toFixed(2));
    else if (s.sunEl > s.hSun - 0.27 && s.sunEl > -0.27 && s.fSun > 0) t += T('whySunHalf', s.sunAz.toFixed(0), s.hSun.toFixed(2), (s.fSun * 100).toFixed(0));
    else if (s.sunEl > 0) t += T('whySunBlocked', s.sunEl.toFixed(2), s.sunAz.toFixed(0), s.hSun.toFixed(2));
    else t += T('whyNight', (-s.sunEl).toFixed(2));
    if (polar) t += T('whyPolar', Math.max(1, s.hSun).toFixed(1));
    t += '<br><br>';
    t += s.earth ? T('whyEarthIn', s.earthEl.toFixed(2), s.hEarth.toFixed(2)) : T('whyEarthOut', s.earthEl.toFixed(2), s.hEarth.toFixed(2));
    t += polar ? T('whyEarthPolar') : T('whyEarthEq');
    t += `<br><small class="muted">${T('whyAir')}</small>`;
    box.innerHTML = t; box.hidden = !box.hidden;
  };

  /* ---------------- report ---------------- */
  function sparkSVG(trace, start, H) {
    if (!trace.length) return '';
    const w = 600, h = 80, X = t => ((t - start) / HOUR / H * w).toFixed(1), Yb = b => (h - b * (h - 6) - 3).toFixed(1);
    const pts = trace.map(p => `${X(p.t)},${Yb(p.b)}`).join(' ');
    const sun = trace.map(p => p.sun >= 0.5 ? `<rect x="${X(p.t)}" y="0" width="${(w / H + 0.6).toFixed(2)}" height="${h}" fill="rgba(255,192,77,.16)"/>` : '').join('');
    const endX = X(trace[trace.length - 1].t), res = Yb(Model.RESERVE);
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${sun}
      <rect x="${endX}" y="0" width="${(w - endX).toFixed(1)}" height="${h}" fill="rgba(255,255,255,.04)"/>
      <line x1="0" x2="${w}" y1="${res}" y2="${res}" stroke="#FC3D21" stroke-dasharray="4 4" stroke-width="1"/>
      <polyline fill="none" stroke="#2ecc71" stroke-width="2.5" points="${pts}"/></svg>`;
  }

  function renderReport() {
    const m = state.lastMission; if (!m) return;
    const hours = ((m.diedAt || m.t) - m.start) / HOUR;
    const s = Model.statsAt(m.site, m.start);
    const year = new Date(m.start).getUTCFullYear();
    const sc = Model.yearScores(m.site, year), best = Model.pickThree(sc, $('#colorBy').value).best;
    const survived = m.reason === 'complete', aborted = m.reason === 'aborted';
    $('#reportBody').innerHTML = `
      <div class="muted">${T('rLanded', nameOf(m.site), fmtDate(m.start))}</div>
      ${aborted ? `<div class="badge">${T('abortedBadge')}</div>` : ''}
      <h1>${aborted ? T('rAborted', days(hours)) : survived ? T('rFull', days(hours)) : T('rSurvived', days(hours))}</h1>
      <p class="muted">${aborted ? T('rAbortedSub') : survived ? T('rNever') : T('rDry')} ${T('rLowest', (m.minBat * 100).toFixed(0))}</p>
      ${sparkSVG(m.trace, m.start, m.H)}
      <p class="small muted">${T('rLegend')}</p>
      <div class="vs">
        <div><b>${T('rYour')}</b><br>${fmtDate(m.start)}<br>☀ ${s.sunPct.toFixed(0)}% · 🌍 ${s.earthPct.toFixed(0)}% · ${T('rLongDark', fmtDur(s.longestDarkH))}</div>
        <div><b>${T('rBest', year)}</b><br>${fmtDate(best.t)}<br>${best.survivedAll ? T('rSurvAll') : T('rSurvN', days(best.survivedH))} · ☀ ${best.sunPct.toFixed(0)}% · 🌍 ${best.earthPct.toFixed(0)}%</div>
      </div>
      <div class="row">
        <button class="btn primary" id="tryBest">${T('tryBest')}</button>
        <button class="btn" id="tryOther">${T('tryOther')}</button>
        <button class="btn" id="shareCard">${T('share')}</button>
      </div>
      <h3>${T('missionLog')}</h3><div class="log mono">${m.log.slice().reverse().map(x => `<div>${x}</div>`).join('')}</div>`;
    $('#tryBest').onclick = () => { startMission(m.site, best.t); show('cockpit'); };
    $('#tryOther').onclick = () => show('planner');
    $('#shareCard').onclick = () => shareCard(m, hours, survived, s);
  }

  function shareCard(m, hours, survived, s) {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1080; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 1080, 1080);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + rnd(i) * 0.7})`; g.fillRect(rnd(i + 11) * 1080, rnd(i + 22) * 700, 2, 2); }
    g.beginPath(); g.moveTo(0, 1080); for (let x = 0; x <= 1080; x += 6) g.lineTo(x, 760 + 30 * Math.sin(x / 70) + 20 * Math.sin(x / 23)); g.lineTo(1080, 1080); g.fillStyle = '#5c5a55'; g.fill();
    g.fillStyle = '#0B3D91'; g.fillRect(0, 0, 1080, 120); g.fillStyle = '#FC3D21'; g.fillRect(0, 0, 1080, 10);
    g.fillStyle = '#fff'; g.font = '700 38px Inter, Arial'; g.fillText('LUNAR LANDING SITE NAVIGATOR', 60, 80);
    g.font = '800 92px Inter, Arial'; g.fillStyle = survived ? '#2ecc71' : '#FC3D21';
    g.fillText(survived ? `${days(hours)} / ${days(m.H)} days` : `${days(hours)} days`, 60, 320);
    g.fillStyle = '#fff'; g.font = '600 44px Inter, Arial'; g.fillText(survived ? 'My lander survived the mission' : 'My lander survived', 60, 400);
    g.font = '40px Inter, Arial'; g.fillStyle = '#c9d6f2';
    g.fillText(`${nameOf(m.site)} · ${fmtDate(m.start)}`, 60, 480);
    g.fillText(`Sun ${s.sunPct.toFixed(0)}%  ·  Earth ${s.earthPct.toFixed(0)}%`, 60, 540);
    g.font = '30px Inter, Arial'; g.fillStyle = '#fff'; g.fillText('NASA LRO LOLA terrain · checked vs JPL Horizons · Team Wasl8', 60, 1030);
    const url = c.toDataURL('image/png');
    exportBox(`<img src="${url}" alt="result" class="exportImg"><p class="hint">${T('longPress')}</p><a class="btn primary" href="${url}" download="wasl8-mission.png">${T('download')}</a>`);
  }

  // export dialog: works even where scripted downloads are blocked (e.g. inside an embedded viewer)
  function exportBox(html) {
    let d = $('#exportDlg');
    if (!d) { d = document.createElement('dialog'); d.id = 'exportDlg'; document.body.appendChild(d); }
    d.innerHTML = `<div class="exportBody">${html}</div><form method="dialog"><button class="btn">${T('close')}</button></form>`;
    d.showModal();
  }

  /* ---------------- about ---------------- */

  /* every outside source the app uses, with its licence: shown in Data & method → Sources & credits */
  function creditsHTML(ar) {
    const H = ar ? { title: 'المصادر والحقوق', data: 'البيانات', sites: 'إحداثيات أماكن الهبوط', soft: 'برامج مفتوحة المصدر', fonts: 'الخطوط', refs: 'مراجع علمية', ours: 'ملاحظات', ai: 'استخدام الذكاء الاصطناعي', tm: 'العلامات التجارية' }
                 : { title: 'Sources & credits', data: 'Data', sites: 'Landing-site coordinates', soft: 'Open-source software', fonts: 'Fonts', refs: 'Scientific references', ours: 'Notes', ai: 'Use of AI', tm: 'Trademarks' };
    const a = (u, t) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
    const li = x => `<li dir="auto">${x}</li>`;
    const sites = SITES.map(s => li(`<b>${s.name}</b> (${s.lat}°, ${s.lon}°E): ${a(s.src.u, s.src.t)}`)).join('');
    return `<section id="credits" class="credits"${ar ? ' dir="rtl"' : ''}>
      <h2>${H.title}</h2>
      <h3>${H.data}</h3><ul>
        ${li(`<b>LRO LOLA south-pole elevation model LDEM_75S_240M</b>: NASA Planetary Data System, Geosciences Node, ${a('https://pds-geosciences.wustl.edu/missions/lro/lola.htm', 'pds-geosciences.wustl.edu/missions/lro/lola.htm')}. Used for all terrain, horizons, the map and the 3D view.`)}
        ${li(`<b>LOLA polar illumination map AVGVISIB_85S_060M</b>: NASA GSFC Planetary Geodesy Data Archive, E. Mazarico, ${a('https://pgda.gsfc.nasa.gov/products/69', 'pgda.gsfc.nasa.gov/products/69')}. Used only to validate our horizons.`)}
        ${li(`<b>JPL Horizons</b> ephemeris service, NASA JPL Solar System Dynamics, ${a('https://ssd.jpl.nasa.gov/horizons/', 'ssd.jpl.nasa.gov/horizons')}. Used to check Sun and Earth positions; the “Check in JPL Horizons” buttons open it.`)}
        ${li(`<b>Artemis III candidate landing regions</b>: NASA news release “NASA Provides Update on Artemis III Moon Landing Regions”, 28 Oct 2024; George et al., ${a('https://ntrs.nasa.gov/citations/20250011660', 'NTRS 20250011660')}.`)}
        ${li(`NASA data and images are generally not subject to copyright in the United States; we follow the ${a('https://www.nasa.gov/nasa-brand-center/images-and-media/', 'NASA images and media usage guidelines')}.`)}
      </ul>
      <h3>${H.sites}</h3><ul>${sites}</ul>
      <p class="muted small">${ar ? 'لمناطق Artemis بنستخدم أحسن نقطة إضاءة في حدود 2 كم من المنطقة، ودي من حسابنا احنا على بيانات LOLA.' : 'For Artemis regions we use the best-lit point within 2 km of the region, picked by our own analysis of LOLA data.'}</p>
      <h3>${H.soft}</h3><ul>
        ${li(`<b>Astronomy Engine</b>, © 2019–2023 Don Cross, MIT License, ${a('https://github.com/cosinekitty/astronomy', 'github.com/cosinekitty/astronomy')}. Sun, Earth and Moon positions in the browser.`)}
        ${li(`<b>three.js</b>, © 2010–2024 three.js authors, MIT License, ${a('https://threejs.org', 'threejs.org')}. 3D intro and 3D terrain view.`)}
      </ul>
      <h3>${H.fonts}</h3><ul>
        ${li(`<b>Inter</b> (Rasmus Andersson), <b>DM Mono</b> (Colophon Foundry), <b>IBM Plex Sans Arabic</b> (IBM): all under the SIL Open Font License 1.1, served by ${a('https://fonts.google.com', 'Google Fonts')}.`)}
      </ul>
      <h3>${H.refs}</h3><ul>
        ${li(`Mazarico, E., et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography. <i>Icarus</i> 211, 1066–1081. ${a('https://doi.org/10.1016/j.icarus.2010.10.030', 'doi:10.1016/j.icarus.2010.10.030')}`)}
        ${li(`Gläser, P., et al. (2018). Illumination conditions at the lunar poles: Implications for future exploration. <i>Planetary and Space Science</i> 162.`)}
        ${li(`Archinal, B. A., et al. (2018). Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015. <i>Celest. Mech. Dyn. Astron.</i> 130, 22. ${a('https://doi.org/10.1007/s10569-017-9805-5', 'doi:10.1007/s10569-017-9805-5')} (Moon orientation, radius 1737.4 km).`)}
        ${li(`Davies, M. E. &amp; Colvin, T. R. (2000). Lunar coordinates in the regions of the Apollo landers. <i>JGR</i> 105(E8), 20277–20280.`)}
      </ul>
      <h3>${H.ours}</h3><ul>
        ${li(ar ? 'خريطة القطب الجنوبي: احنا اللي رسمناها من ارتفاعات LOLA.' : 'South-pole map image: rendered by us from LOLA elevations.')}
        ${li(ar ? 'مركبة الهبوط في الـ 3D: تصميم أصلي عام، مش منسوخ من أي مركبة أو شركة حقيقية.' : '3D lander: an original, generic design; not a copy of any real spacecraft or company design.')}
        ${li(ar ? 'شكل الأرض والشمس وتراب القمر في الصور: مرسومين بالكود (procedural) من غير أي صور خارجية.' : 'Earth, Sun and regolith textures: generated in code (procedural); no outside images.')}
        ${li(ar ? 'الأصوات: متولّدة في المتصفح، مش ملفات صوت من برة. الأيقونات: رسمناها احنا.' : 'Sounds: synthesized in the browser, no audio files. Icons: drawn by us.')}
        ${li(ar ? 'أرقام المركبات (ألواح، بطارية، استهلاك): افتراضات للتوضيح، مش مواصفات مركبة حقيقية.' : 'Lander numbers (panels, battery, load): illustrative assumptions, not the specs of any real spacecraft.')}
      </ul>
      <h3>${H.ai}</h3>
      <p>${ar ? 'كتبنا الكود والنصوص بمساعدة Claude، مساعد ذكاء اصطناعي من Anthropic. كل البيانات والنتايج اتأكدنا منها بالمصادر اللي فوق.' : 'Code and text were written with help from Claude, an AI assistant by Anthropic. All data and results were checked by the team against the sources above.'}</p>
      <h3>${H.tm}</h3>
      <p class="muted small">${ar ? 'اسم NASA مستخدم بس لاسم المسابقة ومصادر البيانات. مفيش أي شعار لناسا في الموقع، والمشروع مش تابع لناسا ولا معتمد منها. أسماء المهمات والشركات (Intuitive Machines، Firefly، ISRO) مذكورة بس عشان نعرّف أماكن الهبوط.' : 'The NASA name is used only to name the event and the data sources. No NASA logos are used, and this project is not affiliated with or endorsed by NASA. Mission and company names (Intuitive Machines, Firefly, ISRO) are used only to identify landing sites.'}</p>
    </section>`;
  }
  function aboutAr(L) {
    return `<div dir="rtl">
      <h2>البيانات والطريقة</h2>
      <p><b>مكان الشمس والأرض</b> بيتحسب في المتصفح بمكتبة <a href="https://github.com/cosinekitty/astronomy">Astronomy Engine</a> (دقتها حوالي دقيقة قوسية حسب مطوّرها) ونموذج دوران القمر من IAU، ومعاه الترنح (libration) والبارالاكس. وقارنّاه بـ <a href="https://ssd.jpl.nasa.gov/horizons/">JPL Horizons</a>: <b>الفرق 0.002° بس</b> للشمس والأرض.</p>
      <p><b>الجبال والأفق</b> من خريطة ارتفاعات <a href="https://pds-geosciences.wustl.edu/missions/lro/lola.htm">LRO LOLA</a> للقطب الجنوبي (LDEM_75S_240M من أرشيف ناسا PDS، دقة 240 متر): كل ربع درجة من الاتجاهات بندوّر على أعلى زاوية جبل لحد 200 كم، مع حساب انحناء القمر (نص قطره 1737.4 كم) وارتفاع ألواح 2 متر. النقط اللي بتختارها من الخريطة بتتحسب بنفس الطريقة على نسخة 480 متر جوه المتصفح.</p>
      <p><b>أماكن الهبوط:</b> مناطق Artemis عرضها حوالي 15 كم، فلكل منطقة بنستخدم أحسن نقطة إضاءة (أكتر ساعات فيها شمس وأرض مع بعض في 2027–2028) في حدود 2 كم من الإحداثيات المنشورة، وبنعرض الاتنين. أماكن الهبوط الحقيقية (IM-1) فضلت بإحداثياتها المنشورة.</p>
      <p><b>الشمس</b> = نسبة قرص الشمس (نص قطره 0.267°) اللي فوق الجبال. <b>الأرض باينة</b> = مركز الأرض فوق الجبال بأكتر من ${Model.settings.earthMarginDeg}° (تقدر تغيرها). ده خط رؤية بس، والاتصال الحقيقي محتاج كمان محطة على الأرض شايفة القمر.</p>
      <p><b>عايز تستكشف أكتر؟</b> نفس بيانات LRO موجودة في <a href="https://quickmap.lroc.asu.edu/" target="_blank" rel="noopener">LROC Quickmap</a> و <a href="https://trek.nasa.gov/moon/" target="_blank" rel="noopener">NASA Moon Trek</a>، ومكان الشمس والأرض تقدر تتأكد منه في <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener">JPL Horizons</a>. الموقع ده بيجمع ده كله في إجابة واحدة سريعة: تنزل إمتى، وإيه اللي هيحصل بعد كده.</p>
      <p><b>المركبة (افتراض، ${T(Model.settings.landerClass)}):</b> ألواح ${L.panelW} وات، بطارية ${L.batteryWh} وات.ساعة، استهلاك ${L.baseW} وات، و+${L.radioW} وات وقت الاتصال. بقاء المركبة بيعتمد على الأرقام دي، لكن الشمس والأرض لأ.</p>
      <p><b>اتأكدنا من إيه:</b> مكان الشمس والأرض مطابق لـ JPL Horizons بفرق 0.002° ✓ · اتجاه خريطة LOLA مطابق لارتفاعات معروفة (قمة Malapert وجبل Mouton ~+5 كم، وقاع Shoemaker و Cabeus ~−4 كم) ✓ · الأفق اتقارن بخريطة الإضاءة الرسمية بتاعة ناسا (PGDA، متوسط 18.6 سنة) في 40 نقطة: <b>الارتباط 0.98</b>، وكل النقط اللي ناسا بتقول إنها مضلمة على طول، طلعت عندنا مضلمة برضه ✓. النسب المطلقة لسه متقارنتش.</p>
      <p><b>إيه الحقيقي في الصور:</b> ✅ خريطة القطب (الحفر والجبال) من ارتفاعات LOLA الحقيقية، والظل والألوان احنا اللي اخترناهم عشان الوضوح · ✅ خط الجبال في شباك الكوكبيت حقيقي: أعلى جبل في كل اتجاه لحد 200 كم · ✅ مكان الشمس والأرض ووش الأرض المنوّر حقيقي · ⚠️ ارتفاع الجبال في الشباك مكبّر 3 مرات عشان يبان (الميول الحقيقية 1–3° بس) · ❌ الصخور والحفر الصغيرة في مقدمة الشباك، ومشهد الهبوط في البداية، وقارات وسحاب الأرض للتوضيح بس، ومش داخلين في أي حساب.</p>
      <p><b>الحدود:</b> دقة 240 متر بتنعّم التلال والحواف الصغيرة (المهمات الحقيقية بتستخدم 5–20 متر)، ومفيش نموذج حرارة (المركبات الحقيقية غالبًا بتموت من البرد بالليل)، ومفيش جدولة لمحطات شبكة الفضاء العميق، والمركبة بتقفل لما البطارية توصل لاحتياطي 20%، وأحجام المركبات للتوضيح ومش مركبات حقيقية.</p>
      <p class="muted small">مفيش هوا على القمر ← مفيش انكسار ضوء ولا شفق. كل حاجة بتتحسب لايف، مفيش أرقام محفوظة.</p>
      <p class="muted small"><b>تنبيه:</b> ده مشروع لهاكاثون NASA Space Apps 2026 من فريق Wasl8. بيستخدم بيانات ناسا العامة، لكنه مش تابع لناسا ولا ممول ولا معتمد منها.</p></div>` + creditsHTML(true);
  }
  $('#heroGo').onclick = () => { if (state.three) { selectDay(state.three.best.day); focusDay(); } };
  $('#heroLive').onclick = () => $('.tab[data-view="cockpit"]').click();
  $('#footAbout').onclick = e => { e.preventDefault(); $('#btnAbout').click(); };
  if ($('#footCredits')) $('#footCredits').onclick = e => { e.preventDefault(); $('#btnAbout').click(); setTimeout(() => { const c = document.getElementById('credits'); if (c) c.scrollIntoView({ block: 'start' }); }, 60); };
  $('#btnAbout2').onclick = () => $('#btnAbout').click();
  $('#btnAbout').onclick = () => {
    const L = Model.settings.lander;
    if (I18N.lang === 'ar') { $('#aboutBody').innerHTML = aboutAr(L); $('#about').showModal(); return; }
    $('#aboutBody').innerHTML = `
      <h2>Data &amp; method</h2>
      <p><b>Sun &amp; Earth positions</b> are computed in your browser with <a href="https://github.com/cosinekitty/astronomy">Astronomy Engine</a> (about ±1 arcminute according to its author) and the IAU Moon rotation model, including parallax and libration. Spot checks against <a href="https://ssd.jpl.nasa.gov/horizons/">JPL Horizons</a>.</p>
      <p><b>Terrain horizons</b> come from the <a href="https://pds-geosciences.wustl.edu/missions/lro/lola.htm">LRO LOLA</a> south-pole elevation model LDEM_75S_240M (NASA PDS, 240 m grid): every 0.25° of azimuth we find the highest terrain angle within 200 km, using exact spherical geometry (Moon radius 1737.4 km) and a 2 m panel height. Points you pick on the map use the same method on a 480 m version, computed in your browser.</p>
      <p><b>Site points:</b> Artemis regions are ~15 km wide, so for each one we use the best-lit point (most hours with Sun and Earth together, 2027–2028) within 2 km of the published coordinates, and we show both. Real landings (IM-1) keep their published coordinates.</p>
      <p><b>Sunlight</b> = fraction of the solar disk (radius 0.267°) above the terrain. <b>Earth in view</b> = Earth's center more than ${Model.settings.earthMarginDeg}° above the terrain (you can change this). Line of sight only: a real link also needs a ground station that can see the Moon.</p>
      <p><b>Validation — what we checked:</b></p>
      <table class="vt"><tr><th>Check</th><th>Result</th></tr>
        <tr><td>Sun az/el vs JPL Horizons (DE441), de Gerlache Rim, 5 times, Mar 2027</td><td>max difference 0.002° ✓</td></tr>
        <tr><td>Earth az/el vs JPL Horizons, same site and times</td><td>max difference 0.002° ✓</td></tr>
        <tr><td>Any day you open: "Check in JPL Horizons" buttons open the official NASA/JPL table for the same site and times</td><td>verify it yourself ✓</td></tr>
        <tr><td>LOLA map orientation: Malapert peak, Mons Mouton (~+5 km), Shoemaker &amp; Cabeus floors (~−4 km)</td><td>match known heights ✓</td></tr>
        <tr><td>In-browser 480 m horizons vs 240 m horizons</td><td>mean difference 0.2–0.7°</td></tr>
        <tr><td>Terrain horizons vs NASA PGDA 18.6-year average illumination map (LOLA AVGVISIB_85S_060M), 40 points south of 85°S</td><td>correlation 0.98 ✓ · every never-lit PGDA point is never lit in ours ✓ · absolute % not yet compared</td></tr></table>
      <p><b>Lander (assumption, ${Model.LANDERS[Model.settings.landerClass].label}):</b> ${L.panelW} W Sun-tracking vertical panel, ${L.batteryWh} Wh battery, ${L.baseW} W base load, +${L.radioW} W while talking to Earth; it shuts down when the battery reaches a 20% safety reserve. The three lander classes are illustrative, not real spacecraft. Survival depends on these numbers; sunlight and Earth visibility do not.</p>
      <p><b>What is real in the pictures:</b></p>
      <table class="vt"><tr><th>Element</th><th>Source</th></tr>
        <tr><td>Map of the south pole (craters, ridges)</td><td>✅ real LOLA elevations; shading from a virtual light and grey colours chosen by us for readability</td></tr>
        <tr><td>Mountain skyline in the cockpit window</td><td>✅ real: the highest terrain in each direction within 200 km, from LOLA</td></tr>
        <tr><td>Sun and Earth positions, Earth's phase</td><td>✅ real: Astronomy Engine ephemerides (checked against JPL Horizons)</td></tr>
        <tr><td>Height of the skyline on screen</td><td>⚠️ real shape, drawn 3× taller so it is visible (true slopes are only 1–3°)</td></tr>
        <tr><td>Rocks/small craters in the window foreground, intro landing scene, Earth's continents/clouds</td><td>❌ illustrative only — not used in any calculation</td></tr></table>
      <p><b>Limits:</b> 240 m terrain smooths small hills and rims (real missions use 5–20 m maps); no thermal model (real landers often die from cold at night); no Deep Space Network station scheduling; Earth visibility uses Earth's center; 1-hour time steps for statistics.</p>
      <p><b>Sites:</b> Artemis III candidate regions (NASA, Oct 2024), real landings (IM-1, IM-2, Chandrayaan-3, Blue Ghost M1) and Apollo sites for contrast. Each site's source is listed under Sources &amp; credits below.</p>
      <p><b>Explore further:</b> the same LRO data can be viewed in <a href="https://quickmap.lroc.asu.edu/" target="_blank" rel="noopener">LROC Quickmap</a> and <a href="https://trek.nasa.gov/moon/" target="_blank" rel="noopener">NASA Moon Trek</a>; Sun and Earth positions can be checked in <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener">JPL Horizons</a> (observer location <code>coord@301</code>). This app turns these into one quick answer: when to land and what happens next.</p>
      <p><b>Solar panel:</b> ${Model.settings.panel.mode === 'tracking' ? 'vertical, turning to follow the Sun (best case)' : 'vertical and fixed, facing azimuth ' + Model.settings.panel.az + '° (output × cos of the Sun–panel azimuth difference)'}. Change it in Mission settings.</p>
      <p class="muted small">No atmosphere → no refraction and no twilight. Everything is computed live; nothing is hard-coded.</p>
      <p class="muted small"><b>Disclaimer:</b> This is a NASA Space Apps Challenge 2026 project by Team Wasl8. It uses public NASA data but is not affiliated with, sponsored by or endorsed by NASA.</p>` + creditsHTML(false);
    $('#about').showModal();
  };

  $('#btnLang').onclick = () => {
    I18N.set(I18N.lang === 'ar' ? 'en' : 'ar');
    renderLanderEdit(); renderLegend(); refresh();
    if (state.mission) { $('#hudSite').innerHTML = `<b>${nameOf(state.mission.site)}</b><span class="hc"> · <bdi>${state.mission.site.lat.toFixed(2)}°, ${state.mission.site.lon.toFixed(2)}°E</bdi></span>`; updateHUD(); draw(); }
    if (state.lastMission) renderReport();
  };
  refresh();
})();
