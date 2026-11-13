// Wasl8 — in-browser terrain horizons for any point south of ~80°S.
// data/dem480.js (base64 of gzip): LRO LOLA LDEM_75S_240M (NASA PDS) averaged to 480 m, 1906x1906 int16 LE,
// heights in 2 m units, stored as row-wise differences (gzip). Polar stereographic, pole at (952.5, 952.5).
(function () {
  const N = 1906, OFF = 952.5, SCALE = 480, R = 1737400;
  let dem = null, loading = null;

  async function load(onProgress) {
    if (dem) return dem;
    if (loading) return loading;
    loading = (async () => {
      let b64 = window.DEM480_B64;
      if (!b64) {
        const res = await fetch('dem480.js'); const total = +res.headers.get('content-length') || 5124154;
        const reader = res.body.getReader(), parts = []; let got = 0;
        for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; onProgress && onProgress(Math.min(0.99, got / total)); }
        const txt = new TextDecoder().decode(await new Blob(parts).arrayBuffer());
        b64 = txt.slice(txt.indexOf('"') + 1, txt.lastIndexOf('"'));
      }
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); window.DEM480_B64 = null;
      const ds = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
      const buf = await new Response(ds).arrayBuffer();
      const d = new Int16Array(buf), h = new Float32Array(N * N);
      for (let r = 0; r < N; r++) { let acc = 0; for (let c = 0; c < N; c++) { acc += d[r * N + c]; h[r * N + c] = acc * 2; } }
      onProgress && onProgress(1);
      dem = h; return dem;
    })();
    return loading;
  }

  const D2R = Math.PI / 180;
  function toPix(lat, lon) {
    const r = 2 * R * Math.tan((90 + lat) * D2R / 2);
    return [OFF - r * Math.cos(lon * D2R) / SCALE, OFF + r * Math.sin(lon * D2R) / SCALE];
  }
  function height(lat, lon) {
    const [l, s] = toPix(lat, lon);
    const l0 = Math.floor(l), s0 = Math.floor(s);
    if (l0 < 0 || s0 < 0 || l0 >= N - 1 || s0 >= N - 1) return NaN;
    const fl = l - l0, fs = s - s0, i = l0 * N + s0;
    return dem[i] * (1 - fl) * (1 - fs) + dem[i + N] * fl * (1 - fs) + dem[i + 1] * (1 - fl) * fs + dem[i + N + 1] * fl * fs;
  }
  const DIST = [];
  for (let d = 480; d < 20000; d += 240) DIST.push(d);
  for (let d = 20000; d <= 200000; d += 480) DIST.push(d);

  // Horizon profile (deg) every `step` degrees of azimuth, panel height `mast` m
  function horizon(lat, lon, step = 0.5, mast = 2) {
    const h0 = height(lat, lon) + mast, r0 = R + h0;
    const p1 = lat * D2R, l1 = lon * D2R, out = [];
    for (let az = 0; az < 360; az += step) {
      const th = az * D2R; let best = -90;
      for (const d of DIST) {
        const c = d / R;
        const p2 = Math.asin(Math.sin(p1) * Math.cos(c) + Math.cos(p1) * Math.sin(c) * Math.cos(th));
        if (p2 / D2R > -75.3) break;
        const l2 = l1 + Math.atan2(Math.sin(th) * Math.sin(c) * Math.cos(p1), Math.cos(c) - Math.sin(p1) * Math.sin(p2));
        const h = height(p2 / D2R, l2 / D2R); if (isNaN(h)) break;
        const r1 = R + h, el = Math.atan2(r1 * Math.cos(c) - r0, r1 * Math.sin(c)) / D2R;
        if (el > best) best = el;
      }
      out.push(Math.round(best * 100) / 100);
    }
    return { elev: Math.round(h0 - mast), deg: out, step };
  }

  window.Terrain = { load, height, horizon, covers: lat => lat <= -80, ready: () => !!dem };
})();
