// Wasl — 3D intro: a lander descends to the lunar south pole under a low Sun, Earth on the horizon.
import * as THREE from './three.module.min.js';
import { regolith, makeEarth, makeSun, fbm } from './spacetex.js';

export function create(host, { tLand = 2400, onLand } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.domElement.className = 'intro3d';
  host.insertBefore(renderer.domElement, host.firstChild);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 4000);

  // low Sun from the side: long shadows, like the real south pole
  const sun = new THREE.DirectionalLight(0xfff1dc, 4.5); sun.position.set(50, 7, 55); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 });
  sun.shadow.bias = -0.0005; scene.add(sun);
  scene.add(new THREE.AmbientLight(0x6f8fd0, 0.08));
  const rim = new THREE.DirectionalLight(0x8fb3ff, 0.18); rim.position.set(-40, 20, -30); scene.add(rim);

  // stars
  const sg = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 2500; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(1500); if (v.y > -100) sp.push(v.x, v.y, v.z); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false })));

  // Earth low on the horizon: oceans, continents, clouds, thin atmosphere; phase set by the same Sun light
  const earth = makeEarth(34); earth.position.set(-650, 70, -560); scene.add(earth);
  // Sun: no air on the Moon, so a hard white disc with camera glare on a black sky
  const sunGlow = makeSun(170); sunGlow.position.copy(sun.position.clone().normalize().multiplyScalar(1200)); scene.add(sunGlow);

  // terrain: rolling regolith with craters
  const tg = new THREE.PlaneGeometry(220, 220, 220, 220); tg.rotateX(-Math.PI / 2);
  const craters = Array.from({ length: 70 }, () => ({ x: (Math.random() - .5) * 200, z: (Math.random() - .5) * 200, r: 1 + Math.random() * 9 }));
  craters.push({ x: 0, z: 0, r: 0 });
  const p = tg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i); let y = (fbm(x * .03 + 50, z * .03 + 50, 5, 3) - .5) * 4 + 0.6 * Math.sin(x * .05) * Math.cos(z * .045) + .5 * Math.sin(x * .17 + z * .11) + 0.12 * Math.sin(x * 1.3) * Math.cos(z * 1.1);
    if (Math.hypot(x, z) > 60) y += (Math.hypot(x, z) - 60) * .08 * (1 + Math.sin(Math.atan2(z, x) * 3)); // distant ridges
    for (const c of craters) { if (!c.r) continue; const d = Math.hypot(x - c.x, z - c.z) / c.r; if (d < 1) y -= c.r * .35 * (1 - d * d); else if (d < 1.4) y += c.r * .12 * (1.4 - d); }
    if (Math.hypot(x, z) < 6) y *= Math.hypot(x, z) / 6; // flat landing zone
    p.setY(i, y);
  }
  tg.computeVertexNormals();
  const REG = regolith(512); { const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 22, uv.getY(i) * 22); }
  const ground = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: REG.map, bumpMap: REG.bump, bumpScale: 1.5, color: 0xcfcac2, roughness: 1 }));
  ground.receiveShadow = ground.castShadow = true; scene.add(ground);

  // lander (original, generic design in the style of modern CLPS landers: tall body in white thermal blanket,
  // gold-foil lower bay with propellant tanks, vertical solar panels for the low polar Sun, dish, four braced legs)
  const L = new THREE.Group();
  const blanketTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#e9ebee'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { const v = 200 + Math.random() * 45; g.strokeStyle = `rgba(${v},${v},${v + 4},.5)`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); g.quadraticCurveTo(x + Math.random() * 30 - 15, y + Math.random() * 10, x + Math.random() * 40 - 20, y + Math.random() * 20 - 10); g.stroke(); }
    for (let y = 0; y < 256; y += 64) { g.fillStyle = 'rgba(150,155,165,.35)'; g.fillRect(0, y, 256, 3); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const foilTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#f3cf7a'); gr.addColorStop(.5, '#b8862c'); gr.addColorStop(1, '#e7b85a'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 500; i++) { g.strokeStyle = `rgba(${90 + Math.random() * 120},${60 + Math.random() * 70},20,.35)`; g.lineWidth = 1 + Math.random() * 3; g.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); g.lineTo(x + Math.random() * 40 - 20, y + Math.random() * 40 - 20); g.stroke(); }
    return new THREE.CanvasTexture(c); })();
  const white = new THREE.MeshStandardMaterial({ map: blanketTex, roughness: .85, metalness: .05 });
  const gold = new THREE.MeshStandardMaterial({ map: foilTex, metalness: .9, roughness: .35 });
  const grey = new THREE.MeshStandardMaterial({ color: 0xc8ccd3, metalness: .7, roughness: .35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2f343c, metalness: .5, roughness: .5 });
  const cell = new THREE.MeshStandardMaterial({ color: 0x14306e, metalness: .6, roughness: .2, emissive: 0x050f2a });
  // upper body: tall hexagonal column in white blanket
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, 3.2, 6), white); upper.position.y = 4.6; L.add(upper);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, .15, 6), grey); top.position.y = 6.25; L.add(top);
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; const rail = new THREE.Mesh(new THREE.BoxGeometry(.04, .3, 1.3), grey); rail.position.set(Math.cos(a) * 1.25, 6.45, Math.sin(a) * 1.25); rail.rotation.y = -a + Math.PI / 2; L.add(rail); }
  // gold-foil lower bay
  const bay = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.25, .9, 12), gold); bay.position.y = 2.6; L.add(bay);
  // propellant tanks around the base
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4;
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(.55, .9, 8, 20), white); tank.position.set(Math.cos(a) * 1.25, 1.85, Math.sin(a) * 1.25); L.add(tank); }
  // vertical solar panels on two sides (the Sun is low at the pole)
  for (const sx of [-1, 1]) { const pnl = new THREE.Mesh(new THREE.BoxGeometry(.06, 2.2, 1.1), cell); pnl.position.set(sx * 1.5, 4.7, 0); L.add(pnl);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(.08, 2.3, 1.2), grey); fr.position.copy(pnl.position); fr.position.x += sx * -.02; fr.scale.set(1, 1, 1); L.add(fr); L.add(pnl); }
  // high-gain dish
  const dish = new THREE.Mesh(new THREE.SphereGeometry(.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.8), grey); dish.material.side = THREE.DoubleSide;
  dish.position.set(-.6, 5.6, 1.25); dish.rotation.set(-1.1, 0, .3); L.add(dish);
  // engine
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(.3, .62, .9, 24, 1, true), dark); bell.material.side = THREE.DoubleSide; bell.position.y = 1.55; L.add(bell);
  // four braced legs with pads
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2, ux = Math.cos(a), uz = Math.sin(a);
    const foot = new THREE.Vector3(ux * 2.9, .1, uz * 2.9);
    const strut = (p0, p1, r = .07) => { const d = new THREE.Vector3().subVectors(p1, p0), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), gold);
      m.position.copy(p0).add(d.clone().multiplyScalar(.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); L.add(m); };
    strut(new THREE.Vector3(ux * 1.4, 3.0, uz * 1.4), foot, .09);
    strut(new THREE.Vector3(ux * 1.2 - uz * .6, 1.4, uz * 1.2 + ux * .6), foot.clone().add(new THREE.Vector3(0, .3, 0)), .05);
    strut(new THREE.Vector3(ux * 1.2 + uz * .6, 1.4, uz * 1.2 - ux * .6), foot.clone().add(new THREE.Vector3(0, .3, 0)), .05);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(.45, .55, .1, 20), grey); pad.position.copy(foot); L.add(pad);
  }
  L.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb35a, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.5, 3, 20, 1, true), flameMat); flame.rotation.x = Math.PI; flame.position.y = -.4; L.add(flame);
  const fl = new THREE.PointLight(0xffa64d, 30, 25, 2); fl.position.y = -.5; L.add(fl);
  scene.add(L);

  // dust
  const dn = 400, dg = new THREE.BufferGeometry(), dp = new Float32Array(dn * 3), dv = [];
  for (let i = 0; i < dn; i++) { dp[i * 3 + 1] = -100; dv.push(new THREE.Vector3()); }
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xc9c3b8, size: .18, transparent: true, opacity: .8 })); scene.add(dust);
  let dustOn = false;

  function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);

  let started = false, t0 = null, landed = false, raf, stopped = false;
  const H0 = 15, ease = k => 1 - Math.pow(1 - k, 3);
  function frame(ts) {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (started && t0 == null) t0 = ts;
    const t = started ? ts - t0 : 0, k = Math.min(1, t / tLand);
    const y = started ? H0 * (1 - ease(k)) : H0 + Math.sin(ts / 500) * .4;
    L.position.set(started ? 6 * (1 - ease(k)) : 6, y, 0); L.rotation.y = .6 + (started ? ease(k) * .5 : 0);
    const thrust = !started ? .6 : t < tLand ? .8 + .2 * Math.random() : Math.max(0, 1 - (t - tLand) / 300);
    flame.scale.set(1, thrust * (0.8 + Math.random() * .3), 1); flame.visible = thrust > .02; fl.intensity = 30 * thrust;
    if (started && t >= tLand && !landed) {
      landed = true; dustOn = true;
      for (let i = 0; i < dn; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 8; dp[i * 3] = Math.cos(a) * .5; dp[i * 3 + 1] = .2; dp[i * 3 + 2] = Math.sin(a) * .5; dv[i].set(Math.cos(a) * s, Math.random() * 1.5, Math.sin(a) * s); }
      onLand && onLand();
    }
    if (dustOn) { for (let i = 0; i < dn; i++) { dp[i * 3] += dv[i].x * .016; dp[i * 3 + 1] = Math.max(0, dp[i * 3 + 1] + dv[i].y * .016); dp[i * 3 + 2] += dv[i].z * .016; dv[i].y -= .03; dv[i].multiplyScalar(.985); } dg.attributes.position.needsUpdate = true; dust.material.opacity = Math.max(0, dust.material.opacity - .004); }
    // camera: low, slowly orbiting, following the descent
    const a = 0.75 + Math.sin(ts / 7000) * 0.25;
    camera.position.set(Math.cos(a) * 26, 3.5 + L.position.y * .35, Math.sin(a) * 26);
    camera.lookAt(L.position.x * .5, 3 + L.position.y * .8, 0);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);
  return {
    start() { started = true; },
    alt() { return Math.max(0, L.position.y); },
    stop() { stopped = true; cancelAnimationFrame(raf); removeEventListener('resize', resize); renderer.dispose(); },
  };
}

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.2, 'rgba(255,230,180,.6)'); r.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
