// Wasl — 3D view of the real LOLA terrain around a site, lit by the real Sun (Three.js, loaded on demand).
import * as THREE from './three.module.min.js';
import { regolith, makeEarth, makeSun } from './spacetex.js';
let REG = null;

let renderer, scene, camera, terrain, sun, sunBall, earthBall, lander, ring, raf, state = null;
const R = 1737.4; // km

function decode(b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Int16Array(u.buffer); }
// unit vector in scene coords (x = east, y = up, z = south) for azimuth/elevation in degrees
function dir(az, el) { const a = az * Math.PI / 180, e = el * Math.PI / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)); }

export function init(container) {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  camera = new THREE.PerspectiveCamera(45, 1, 0.05, 5000);
  scene.add(new THREE.AmbientLight(0x8fb3ff, 0.06));               // faint earthshine
  sun = new THREE.DirectionalLight(0xfff2dd, 3.2); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 400 });
  scene.add(sun, sun.target);
  sunBall = makeSun(60);                       // core + corona + camera glare
  earthBall = makeEarth(12.5);                 // ~2° wide from the Moon at 700 units, phase lit by the real Sun
  scene.add(sunBall, earthBall);
  // stars
  const sg = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(900); if (v.y > -50) sp.push(v.x, v.y, v.z); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false })));
  // lander marker
  lander = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.6, roughness: 0.35 }));
  body.position.y = 0.35; body.castShadow = true; lander.add(body);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff })); mast.position.y = 1; lander.add(mast);
  const flag = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 12), new THREE.MeshBasicMaterial({ color: 0xFC3D21 })); flag.position.y = 1.7; flag.rotation.x = Math.PI; lander.add(flag);
  scene.add(lander);
  ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 48), new THREE.MeshBasicMaterial({ color: 0xFC3D21, side: THREE.DoubleSide, transparent: true, opacity: .8 }));
  ring.rotation.x = -Math.PI / 2; scene.add(ring);
  // simple orbit controls (drag to rotate, wheel/pinch to zoom)
  const cam = { r: 34, th: 0.7, ph: 0.42 }; state = { cam };
  let drag = null, pinch = null;
  const el = renderer.domElement; el.style.touchAction = 'none';
  el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, th: cam.th, ph: cam.ph }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!drag) return; cam.th = drag.th - (e.clientX - drag.x) * 0.006; cam.ph = Math.min(1.45, Math.max(0.05, drag.ph + (e.clientY - drag.y) * 0.005)); place(); });
  el.addEventListener('pointerup', () => drag = null);
  el.addEventListener('wheel', e => { e.preventDefault(); cam.r = Math.min(80, Math.max(4, cam.r * (1 + Math.sign(e.deltaY) * 0.1))); place(); }, { passive: false });
  el.addEventListener('touchmove', e => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinch) cam.r = Math.min(80, Math.max(4, cam.r * pinch / d)); pinch = d; place(); } }, { passive: true });
  el.addEventListener('touchend', () => pinch = null);
  resize(); ro = new ResizeObserver(resize); ro.observe(container);
  loop();
}

function place() {
  const { r, th, ph } = state.cam;
  camera.position.set(r * Math.cos(ph) * Math.sin(th), (state.hc || 0) + r * Math.sin(ph), r * Math.cos(ph) * Math.cos(th));
  camera.lookAt(0, state.hc || 0, 0);
}
function resize() { const c = renderer.domElement.parentElement; const w = c.clientWidth, h = c.clientHeight; renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); }
function loop() { raf = requestAnimationFrame(loop); renderer.render(scene, camera); }

// patch: { n, px (m), lat, lon, h (base64 int16) }; exaggeration: vertical factor
export function setTerrain(patch, exaggeration = 1) {
  if (terrain) { scene.remove(terrain); terrain.geometry.dispose(); }
  const n = patch.n, half = (n - 1) / 2, step = patch.px / 1000, hts = decode(patch.h), h0 = hts[half * n + half];
  const lon = patch.lon * Math.PI / 180, ce = Math.cos(lon), se = Math.sin(lon);
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * n * 3), idx = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const dx = (j - half) * step, dy = -(i - half) * step;            // stereographic plane, km
    const e = dx * ce - dy * se, nn = dx * se + dy * ce;              // rotate to local east / north
    const d2 = e * e + nn * nn;
    const up = ((hts[i * n + j] - h0) / 1000) * exaggeration - d2 / (2 * R); // Moon curvature
    const k = (i * n + j) * 3; pos[k] = e; pos[k + 1] = up; pos[k + 2] = -nn;
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
  const uv = new Float32Array(n * n * 2); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { uv[(i * n + j) * 2] = j / (n - 1) * 14; uv[(i * n + j) * 2 + 1] = i / (n - 1) * 14; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  if (!REG) REG = regolith(512);
  terrain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: REG.map, bumpMap: REG.bump, bumpScale: 1.2, color: 0xd8d4cc, roughness: 1, metalness: 0 }));
  terrain.castShadow = terrain.receiveShadow = true; scene.add(terrain);
  lander.position.set(0, 0.02, 0); ring.position.set(0, 0.05, 0);
  state.hc = 0; place();
}

// Sun and Earth directions (deg) at the current time
export function setSky(sunAz, sunEl, earthAz, earthEl) {
  const s = dir(sunAz, sunEl), e = dir(earthAz, earthEl);
  sun.position.copy(s.clone().multiplyScalar(150)); sun.target.position.set(0, 0, 0);
  sun.intensity = sunEl > -0.3 ? 3.2 : 0;
  sunBall.position.copy(s.clone().multiplyScalar(700)); sunBall.visible = sunEl > -1.5;
  earthBall.position.copy(e.clone().multiplyScalar(700)); earthBall.visible = earthEl > -1.5;
}
export function dispose() { cancelAnimationFrame(raf); }
// move the 3D canvas into another container (day panel <-> full-screen explore view)
let ro = null;
export function attach(container) {
  container.appendChild(renderer.domElement);
  if (ro) ro.disconnect(); ro = new ResizeObserver(resize); ro.observe(container); resize();
}
// screen position (css px) of 'sun' | 'earth' | 'lander', or null when behind the camera
export function screenPos(which) {
  const o = which === 'sun' ? sunBall : which === 'earth' ? earthBall : lander;
  if (!o.visible) return null;
  const v = o.getWorldPosition(new THREE.Vector3()); if (which === 'lander') v.y += 2;
  v.project(camera); if (v.z > 1) return null;
  const c = renderer.domElement; return { x: (v.x + 1) / 2 * c.clientWidth, y: (1 - v.y) / 2 * c.clientHeight };
}
export function setView(r, ph) { state.cam.r = r; state.cam.ph = ph; place(); }
