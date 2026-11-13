// Wasl8 — Mission-control audio (synthesized with Web Audio, no audio files) + short haptics.
// The Moon has no air, so these are the sounds of the lander's telemetry console, not of the outside.
(function () {
  let ctx = null, master = null, comp = null, hum = null, ticker = null, muted = false;
  try { muted = localStorage.getItem('wasl8-mute') === '1'; } catch (e) { }
  const last = {};              // per-sound cooldowns (alarm fatigue)
  let quiet = false;            // when time runs very fast, only critical sounds play

  // iOS: play a looping silent <audio> once so Web Audio is heard even with the silent switch on
  function iosUnlock() {
    try {
      const sr = 8000, n = sr / 10, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
      const a = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
      a.loop = true; a.setAttribute('playsinline', ''); a.volume = 0.01; a.play().catch(() => { });
    } catch (e) { }
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
      master.connect(comp).connect(ctx.destination);
      iosUnlock();
    } catch (e) { ctx = null; }
    return ctx;
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, init, { once: true, passive: true }));

  const noiseCache = {};
  function noiseBuf(sec) {
    const k = Math.ceil(sec * 10); if (noiseCache[k]) return noiseCache[k];
    const b = ctx.createBuffer(1, ctx.sampleRate * k / 10, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseCache[k] = b;
  }
  const drive = (() => { let c; return () => { if (c) return c; const n = 1024, a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / n * 2 - 1; a[i] = Math.tanh(3 * x); } return c = a; }; })();
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function tone(freq, t, dur, type = 'sine', vol = 0.15, slideTo, dest = master) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env(g, t, 0.008, vol, dur); o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, freq, q, vol, type = 'lowpass') {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf(dur + 0.1); f.type = type; f.frequency.value = freq; f.Q.value = q;
    env(g, t, 0.02, vol, dur); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.1);
    return { f, g };
  }
  function ok(name, cool = 2, critical = false) {
    if (!init() || muted) return false;
    if (quiet && !critical) return false;
    const now = ctx.currentTime; if (last[name] && now - last[name] < cool) return false;
    last[name] = now; return true;
  }
  function buzz(p) { if (muted) return; try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } }

  const S = {
    init,
    get muted() { return muted; },
    setMuted(m) { muted = m; try { localStorage.setItem('wasl8-mute', m ? '1' : '0'); } catch (e) { } if (master) master.gain.value = m ? 0 : 0.9; if (m) { S.humStop(); S.ticksStop(); } },
    setQuiet(q) { quiet = q; },
    click() { if (!ok('click', 0.03)) return; tone(1800, ctx.currentTime, 0.025, 'sine', 0.025); },
    // structure-borne engine rumble (felt through the lander, not heard through vacuum)
    thruster(sec) {
      if (!ok('thruster', 0.5)) return; const t = ctx.currentTime;
      const n = noise(t, sec, 700, 0.6, 0.32); n.f.frequency.setValueAtTime(900, t); n.f.frequency.exponentialRampToValueAtTime(220, t + sec);
      const sh = ctx.createWaveShaper(); sh.curve = drive(); const g = ctx.createGain(); env(g, t, 0.2, 0.09, sec);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(95, t + sec);
      o.connect(sh).connect(g).connect(master); o.start(t); o.stop(t + sec + 0.1);
      buzz([30, 40, 30, 40, 30, 40, 30]);
    },
    thud() {
      if (!ok('thud', 0.5)) return; const t = ctx.currentTime;
      tone(160, t, 0.35, 'sine', 0.45, 60); tone(320, t, 0.12, 'triangle', 0.15, 120); noise(t, 0.4, 1600, 0.5, 0.22);
      buzz(120);
    },
    // console ambience: a quiet, slightly beating fan/electronics bed (audible on phone speakers)
    humStart() {
      if (!init() || hum || muted) return;
      const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.018, ctx.currentTime + 1.2);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 1.2;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf(2); s.loop = true; s.connect(f).connect(g);
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), og = ctx.createGain(); og.gain.value = 0.35;
      o1.frequency.value = 240; o2.frequency.value = 241.5; o1.connect(og); o2.connect(og); og.connect(g);
      g.connect(master); s.start(); o1.start(); o2.start(); hum = { g, nodes: [s, o1, o2] };
    },
    humStop() { if (!hum || !ctx) return; const h = hum; hum = null; h.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4); setTimeout(() => h.nodes.forEach(n => { try { n.stop(); } catch (e) { } }), 500); },
    // sonification: tick rate follows solar power (fast = charging, silent = no power)
    ticks(rate01) {
      if (!init() || muted) return;
      if (!ticker) ticker = { next: ctx.currentTime, rate: 0 };
      ticker.rate = rate01;
    },
    ticksPump() {
      if (!ticker || !ctx || muted || ticker.rate <= 0.02) return;
      const now = ctx.currentTime, interval = 0.9 - 0.8 * ticker.rate;
      while (ticker.next < now + 0.1) { if (ticker.next >= now) tone(2600, ticker.next, 0.012, 'square', 0.02); ticker.next += interval; }
      if (ticker.next < now) ticker.next = now;
    },
    ticksStop() { ticker = null; },
    alarm() { if (!ok('alarm', 2.5, true)) return; const t = ctx.currentTime; [0, 0.2, 0.4, 0.6].forEach((d, i) => tone(i % 2 ? 660 : 880, t + d, 0.16, 'square', 0.08)); buzz([90, 60, 90]); },
    warn() { if (!ok('warn', 3)) return; const t = ctx.currentTime; tone(587, t, 0.18, 'triangle', 0.12); tone(587, t + 0.28, 0.18, 'triangle', 0.12); buzz(60); },
    good() { if (!ok('good', 2)) return; const t = ctx.currentTime; [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.08, 0.22, 'sine', 0.09)); buzz(25); },
    sunset() { if (!ok('sunset', 3)) return; const t = ctx.currentTime; [784, 659, 523, 392].forEach((f, i) => tone(f, t + i * 0.12, 0.3, 'sine', 0.09)); buzz(60); },
    lossOfSignal() { if (!ok('los', 3)) return; const t = ctx.currentTime; noise(t, 0.6, 2200, 0.9, 0.14, 'bandpass'); tone(1000, t + 0.62, 0.1, 'square', 0.05); tone(700, t + 0.76, 0.18, 'square', 0.05); buzz([40, 40, 40]); },
    signal() { if (!ok('signal', 2)) return; const t = ctx.currentTime; noise(t, 0.18, 3200, 1, 0.07, 'bandpass'); tone(880, t + 0.2, 0.09, 'sine', 0.09); tone(1320, t + 0.32, 0.15, 'sine', 0.09); buzz(20); },
    lost() { if (!ok('lost', 5, true)) return; const t = ctx.currentTime; tone(440, t, 1.8, 'sawtooth', 0.09, 70); noise(t, 1.2, 900, 0.5, 0.15); S.humStop(); S.ticksStop(); buzz([140, 80, 140]); },
    win() { if (!ok('win', 3, true)) return; const t = ctx.currentTime; [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.1, 0.35, 'triangle', 0.08)); buzz([30, 30, 30]); },
  };
  window.Sfx = S;
})();
