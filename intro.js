// Wasl8 — intro: a lander descends and touches down on the lunar south pole, then the app opens.
(function () {
  const el = document.getElementById('intro'), cv = document.getElementById('introCv');
  let seen = false;
  try { seen = sessionStorage.getItem('wasl8-intro') === '1'; } catch (e) { }
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (seen || reduce || !el) { el && el.remove(); return; }
  try { sessionStorage.setItem('wasl8-intro', '1'); } catch (e) { }
  document.body.classList.add('introOn');

  const g = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  let W, H;
  function size() { W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; }
  size(); addEventListener('resize', size);
  const rnd = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  const stars = Array.from({ length: 260 }, (_, i) => ({ x: rnd(i), y: rnd(i + 999) * 0.75, r: 0.4 + rnd(i + 3) * 1.1, b: 0.25 + rnd(i + 7) * 0.7 }));
  const dust = [];
  const T_LAND = 2400, T_END = 4600;
  let t0 = null, done = false, started = false, thudDone = false;

  // surface profile (polar terrain: low Sun, long shadows)
  const ridge = x => 0.78 - 0.03 * Math.sin(x * 7.3) - 0.02 * Math.sin(x * 17.1 + 1) - 0.06 * Math.exp(-((x - 0.82) ** 2) / 0.01);

  function lander(x, y, s, flame) {
    g.save(); g.translate(x, y); g.scale(s, s);
    // legs
    g.strokeStyle = '#c9ced6'; g.lineWidth = 3;
    [[-1, 1], [1, 1]].forEach(([sx]) => { g.beginPath(); g.moveTo(sx * 18, 6); g.lineTo(sx * 34, 34); g.moveTo(sx * 40, 34); g.lineTo(sx * 28, 34); g.stroke(); });
    g.beginPath(); g.moveTo(-8, 10); g.lineTo(-14, 34); g.moveTo(8, 10); g.lineTo(14, 34); g.stroke();
    // engine bell + flame
    if (flame > 0) {
      const fl = g.createLinearGradient(0, 14, 0, 14 + 60 * flame);
      fl.addColorStop(0, 'rgba(255,255,255,.95)'); fl.addColorStop(0.3, 'rgba(255,190,90,.8)'); fl.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = fl; g.beginPath(); g.moveTo(-7, 14); g.quadraticCurveTo(0, 14 + 70 * flame, 7, 14); g.fill();
    }
    g.fillStyle = '#6b7380'; g.beginPath(); g.moveTo(-6, 6); g.lineTo(6, 6); g.lineTo(9, 16); g.lineTo(-9, 16); g.fill();
    // body (gold foil) + panel + antenna
    const foil = g.createLinearGradient(-22, -20, 22, 8);
    foil.addColorStop(0, '#f6d27a'); foil.addColorStop(0.5, '#c8902e'); foil.addColorStop(1, '#8a5a17');
    g.fillStyle = foil; g.fillRect(-22, -18, 44, 26);
    g.fillStyle = '#1b2f5e'; g.fillRect(-20, -40, 40, 18);
    g.strokeStyle = '#4a6fb5'; g.lineWidth = 1; for (let i = -16; i <= 16; i += 8) { g.beginPath(); g.moveTo(i, -40); g.lineTo(i, -22); g.stroke(); }
    g.strokeStyle = '#d7dbe2'; g.lineWidth = 2; g.beginPath(); g.moveTo(14, -18); g.lineTo(26, -32); g.stroke();
    g.fillStyle = '#e6e9ee'; g.beginPath(); g.ellipse(28, -34, 7, 3, -0.6, 0, 7); g.fill();
    g.restore();
  }

  let use3d = null; // set when the 3D intro loads
  const hud = { alt: null, last: null, vs: 0, done: false }, $h = id => document.getElementById(id);
  function frame(ts) {
    if (done) return;
    if (use3d) {                     // 3D scene draws itself; keep only the timing + telemetry here
      if (started && t0 == null) t0 = ts;
      const alt = use3d.alt() * 10, now = ts / 1000;   // scene units -> metres (15 units = 150 m)
      if (hud.last != null && now > hud.last) hud.vs = hud.vs * .8 + ((alt - hud.alt) / (now - hud.last)) * .2;
      hud.alt = alt; hud.last = now;
      if (started && !hud.done) {
        $h('hAlt').textContent = alt.toFixed(1) + ' m'; $h('hVs').textContent = hud.vs.toFixed(1) + ' m/s';
        $h('hTh').textContent = (alt > .3 ? 70 + Math.round(Math.random() * 25) : 0) + '%';
        if (alt < .2) { hud.done = true; $h('hAlt').textContent = '0.0 m'; $h('hVs').textContent = '0.0 m/s'; $h('hTh').textContent = 'CUTOFF'; const td = document.getElementById('introTd'); td.hidden = false; }
      }
      if (started && ts - t0 > T_END) return finish();
      return requestAnimationFrame(frame);
    }
    if (!started) t0 = ts;
    if (t0 == null) t0 = ts;
    const t = ts - t0;
    // sky
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (const s of stars) { g.fillStyle = `rgba(255,255,255,${s.b})`; g.beginPath(); g.arc(s.x * W, s.y * H, s.r * dpr, 0, 7); g.fill(); }
    // Earth low on the horizon, Sun grazing
    const ex = W * 0.2, ey = H * 0.6, er = Math.min(W, H) * 0.045;
    g.fillStyle = '#0d2a4f'; g.beginPath(); g.arc(ex, ey, er, 0, 7); g.fill();
    const eg = g.createLinearGradient(ex - er, ey, ex + er, ey); eg.addColorStop(0.45, 'rgba(90,169,255,0)'); eg.addColorStop(1, 'rgba(160,210,255,1)');
    g.fillStyle = eg; g.beginPath(); g.arc(ex, ey, er, 0, 7); g.fill();
    const sx = W * 0.95, sy = H * 0.7, sg = g.createRadialGradient(sx, sy, 0, sx, sy, H * 0.35);
    sg.addColorStop(0, 'rgba(255,240,200,.95)'); sg.addColorStop(0.05, 'rgba(255,220,150,.5)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = sg; g.fillRect(0, 0, W, H);
    // terrain
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= 1.0001; x += 0.005) g.lineTo(x * W, ridge(x) * H);
    g.lineTo(W, H); g.closePath();
    const tg = g.createLinearGradient(W, 0, 0, 0); tg.addColorStop(0, '#9a958c'); tg.addColorStop(1, '#2b2a28');
    g.fillStyle = tg; g.fill();
    // lander
    const k = Math.min(1, t / T_LAND), ease = 1 - Math.pow(1 - k, 3);
    const s = Math.min(W, H) / 380 * dpr / dpr * 1.1;
    const gx = W * 0.55, gy = ridge(0.55) * H - 34 * s;
    const hover = started ? 0 : Math.sin(ts / 400) * 6 * s;
    const y0 = H * 0.18, y = (started ? y0 + (gy - y0) * ease : y0) + hover, x = gx + (1 - ease) * W * 0.12;
    const flame = !started ? 0.35 + 0.2 * Math.random() : t < T_LAND ? 0.5 + 0.5 * Math.random() * (1 - k * 0.3) : Math.max(0, 1 - (t - T_LAND) / 250);
    if (t >= T_LAND && !thudDone) { thudDone = true; window.Sfx && Sfx.thud && (Sfx.muted || Sfx.thud()); el.classList.add('shake'); }
    if (t >= T_LAND && dust.length === 0) for (let i = 0; i < 70; i++) dust.push({ x: gx, y: gy + 34 * s, vx: (Math.random() - 0.5) * 9 * s, vy: -Math.random() * 2.5 * s, a: 1 });
    for (const d of dust) { d.x += d.vx; d.y += d.vy; d.vy += 0.06 * s; d.a *= 0.97; g.fillStyle = `rgba(200,196,188,${d.a * 0.6})`; g.fillRect(d.x, d.y, 3 * s, 3 * s); }
    lander(x, y, s, flame);
    if (t > T_LAND + 150) el.classList.add('landed');
    if (t > T_END) return finish();
    requestAnimationFrame(frame);
  }
  function finish() {
    if (done) return; done = true;
    go.remove();
    if (use3d) setTimeout(() => use3d.stop(), 700);
    el.classList.add('out'); document.body.classList.remove('introOn');
    setTimeout(() => el.remove(), 700);
  }
  document.getElementById('skipIntro').onclick = e => { e.stopPropagation(); finish(); };
  const go = document.getElementById('startIntro');
  function begin(withSound) {
    if (started) return;
    started = true; t0 = null; el.classList.add('started'); go.style.display = 'none';
    if (use3d) { use3d.start(); document.getElementById('introHud').hidden = false; }
    if (withSound && window.Sfx) { Sfx.init(); Sfx.thruster(T_LAND / 1000 + 0.2); }
  }
  go.onclick = e => { e.stopPropagation(); begin(true); };
  // try the 3D version (WebGL); keep the 2D drawing as a fallback
  // hide the 2D drawing until we know whether 3D works, so the old lander never flashes
  cv.style.visibility = 'hidden';
  const fallback = () => { if (!use3d) cv.style.visibility = 'visible'; };
  const fbTimer = setTimeout(fallback, 4000);
  try {
    import('./intro3d.js').then(m => {
      if (done) return;
      const t = document.createElement('canvas');
      if (!(t.getContext('webgl2') || t.getContext('webgl'))) { clearTimeout(fbTimer); return fallback(); }
      clearTimeout(fbTimer);
      use3d = m.create(el, {
        tLand: T_LAND,
        onLand: () => { window.Sfx && (Sfx.muted || Sfx.thud()); el.classList.add('shake', 'landed'); },
      });
      cv.style.display = 'none';
      document.body.appendChild(go); go.classList.add('floatStart');
    }).catch(() => { clearTimeout(fbTimer); fallback(); });
  } catch (e) { clearTimeout(fbTimer); fallback(); }
  requestAnimationFrame(frame);
})();
