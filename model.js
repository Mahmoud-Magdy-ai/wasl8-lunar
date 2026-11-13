// Wasl8 — mission model: hourly Sun/Earth series, landing-date scores, battery simulation.
(function () {
  const HOUR = 3600e3;

  const DEFAULT_LANDER = {
    panelW: 300,       // solar panel output at full Sun (vertical, Sun-tracking panel) — assumption
    batteryWh: 2000,   // battery capacity — assumption
    baseW: 60,         // avionics + survival heaters — assumption
    radioW: 40,        // extra load while talking to Earth — assumption
    heaterW: 120,      // optional heater
    cameraW: 25,       // optional camera
  };

  // Illustrative lander classes (assumptions, editable in the app)
  const LANDERS = {
    small:  { label: 'Small robotic lander', panelW: 300,  batteryWh: 2000,  baseW: 60,  radioW: 40,  heaterW: 120, cameraW: 25 },
    medium: { label: 'Medium cargo lander',  panelW: 1000, batteryWh: 8000,  baseW: 200, radioW: 80,  heaterW: 400, cameraW: 40 },
    large:  { label: 'Large crew-class lander', panelW: 4000, batteryWh: 40000, baseW: 900, radioW: 150, heaterW: 1500, cameraW: 60 },
  };
  const RESERVE = 0.2; // lander shuts down when the battery hits its 20% safety reserve (typical depth-of-discharge limit)
  const settings = { earthMarginDeg: 0, missionDays: 14, landerClass: 'small', lander: { ...DEFAULT_LANDER }, panel: { mode: 'tracking', az: 0 } };
  // share of panel output: 1 for a Sun-tracking vertical panel, cos(azimuth difference) for a fixed vertical panel
  function panelFactor(h) { return settings.panel.mode === 'tracking' ? 1 : Math.max(0, Math.cos((h.sunAz - settings.panel.az) * Math.PI / 180)); }

  function horizonFor(site) { const h = window.HORIZONS && window.HORIZONS[site.id]; return h ? (h.deg || h) : null; }

  // One hour of the sky at a site
  function sample(site, ms) {
    const s = Lunar.sky(new Date(ms), site.lat, site.lon);
    const hp = horizonFor(site);
    const hSun = Lunar.horizonAt(hp, s.sunAz), hEarth = Lunar.horizonAt(hp, s.earthAz);
    const fSun = Lunar.sunFraction(s.sunEl, hSun);
    const earth = s.earthEl > hEarth + settings.earthMarginDeg;
    return { t: ms, ...s, hSun, hEarth, fSun, earth };
  }

  // Hourly series [startMs, startMs + hours)
  const cache = new Map();
  function series(site, startMs, hours) {
    const key = site.id + '|' + site.lat + '|' + site.lon + '|' + startMs + '|' + hours + '|' + settings.earthMarginDeg;
    if (cache.has(key)) return cache.get(key);
    const out = new Array(hours);
    for (let i = 0; i < hours; i++) out[i] = sample(site, startMs + i * HOUR);
    cache.set(key, out);
    return out;
  }

  // Fill the cache for a whole year in small chunks so the page never freezes; onProgress(0..1)
  function prepareYear(site, year, onProgress) {
    const start = Date.UTC(year, 0, 1);
    const days = (Date.UTC(year + 1, 0, 1) - start) / 864e5;
    const hours = days * 24 + settings.missionDays * 24;
    const key = site.id + '|' + site.lat + '|' + site.lon + '|' + start + '|' + hours + '|' + settings.earthMarginDeg;
    if (cache.has(key)) { onProgress && onProgress(1); return Promise.resolve(); }
    const out = new Array(hours); let i = 0;
    return new Promise(res => {
      (function chunk() {
        const t0 = performance.now();
        while (i < hours && performance.now() - t0 < 25) { out[i] = sample(site, start + i * HOUR); i++; }
        onProgress && onProgress(i / hours);
        if (i < hours) setTimeout(chunk, 0); else { cache.set(key, out); res(); }
      })();
    });
  }

  // Battery simulation over an hourly series, 1-hour steps. Returns hours survived and per-hour state.
  function simulate(ser, from, hours, lander = settings.lander, devices = {}) {
    let E = lander.batteryWh, alive = hours, trace = [];
    for (let i = 0; i < hours; i++) {
      const h = ser[from + i];
      const load = lander.baseW + (h.earth ? lander.radioW : 0) +
        (devices.heater ? lander.heaterW : 0) + (devices.camera ? lander.cameraW : 0);
      E = Math.min(lander.batteryWh, E + (lander.panelW * h.fSun * panelFactor(h) - load));
      if (E <= RESERVE * lander.batteryWh) { E = RESERVE * lander.batteryWh; alive = i; trace.push(RESERVE); break; }
      trace.push(E / lander.batteryWh);
    }
    return { hoursAlive: alive, trace };
  }

  // Stats for one mission window
  function windowStats(ser, from, hours) {
    let sun = 0, earth = 0, both = 0, dark = 0, longestDark = 0, noEarth = 0, longestNoEarth = 0;
    let maxEl = -90, elSum = 0, elN = 0, firstSunset = null, firstEarthLoss = null;
    const sun0 = ser[from].fSun >= 0.5, earth0 = ser[from].earth;
    for (let i = from; i < from + hours; i++) {
      const h = ser[i];
      maxEl = Math.max(maxEl, h.sunEl); if (h.fSun > 0) { elSum += h.sunEl; elN++; }
      if (firstSunset == null && sun0 && h.fSun < 0.5) firstSunset = i - from;
      if (firstEarthLoss == null && earth0 && !h.earth) firstEarthLoss = i - from;
      sun += h.fSun; if (h.earth) earth++;
      if (h.fSun >= 0.5 && h.earth) both++;
      if (h.fSun < 0.5) { dark++; longestDark = Math.max(longestDark, dark); } else dark = 0;
      if (!h.earth) { noEarth++; longestNoEarth = Math.max(longestNoEarth, noEarth); } else noEarth = 0;
    }
    const sim = simulate(ser, from, hours);
    return {
      sunPct: 100 * sun / hours, earthPct: 100 * earth / hours, bothPct: 100 * both / hours,
      longestDarkH: longestDark, longestNoEarthH: longestNoEarth,
      survivedH: sim.hoursAlive, survivedAll: sim.hoursAlive >= hours,
      maxSunEl: maxEl, meanLitSunEl: elN ? elSum / elN : null, sunAtStart: sun0, earthAtStart: earth0,
      firstSunsetH: firstSunset, firstEarthLossH: firstEarthLoss,
    };
  }

  // Score every landing day of a year (landing at 00:00 UTC)
  function yearScores(site, year) {
    const start = Date.UTC(year, 0, 1);
    const days = (Date.UTC(year + 1, 0, 1) - start) / 864e5;
    const mh = settings.missionDays * 24;
    const ser = series(site, start, days * 24 + mh);
    const out = [];
    for (let d = 0; d < days; d++) out.push({ day: d, t: start + d * 864e5, ...windowStats(ser, d * 24, mh) });
    return out;
  }

  // Best / median / worst landing day (ranked by hours survived, then Sun+Earth %)
  // mode 'both' ranks by measured Sun+Earth time (data); 'survival' by the lander model
  function pickThree(scores, mode = 'both') {
    const sorted = [...scores].sort(mode === 'both'
      ? (a, b) => (b.bothPct - a.bothPct) || (b.sunPct - a.sunPct)
      : (a, b) => (b.survivedH - a.survivedH) || (b.bothPct - a.bothPct));
    return { best: sorted[0], median: sorted[Math.floor(sorted.length / 2)], worst: sorted[sorted.length - 1] };
  }

  // Stats for an arbitrary landing time
  function statsAt(site, ms) {
    const mh = settings.missionDays * 24;
    const start = Math.floor(ms / HOUR) * HOUR;
    return { t: start, ...windowStats(series(site, start, mh), 0, mh) };
  }

  // Continuous windows of Sun (disk ≥ 50 % visible) and Earth in view over a series
  function windows(ser) {
    const out = { sun: [], earth: [] };
    for (const [k, f] of [['sun', h => h.fSun >= 0.5], ['earth', h => h.earth]]) {
      let st = null;
      ser.forEach((h, i) => { if (f(h) && st == null) st = i; if ((!f(h) || i === ser.length - 1) && st != null) { const e = f(h) ? i + 1 : i; out[k].push({ start: ser[st].t, end: ser[st].t + (e - st) * HOUR, hours: e - st, open: st === 0 || e === ser.length }); st = null; } });
    }
    return out;
  }

  window.Model = { panelFactor, windows, RESERVE, prepareYear, HOUR, DEFAULT_LANDER, LANDERS, settings, horizonFor, sample, series, simulate, windowStats, yearScores, pickThree, statsAt, clearCache: () => cache.clear() };
})();
