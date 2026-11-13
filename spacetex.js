// Procedural, original textures for a more realistic Moon, Sun and Earth (no external images).
import * as THREE from './three.module.min.js';

// --- value-noise fBm ---
function hash(x, y, s) { let h = x * 374761393 + y * 668265263 + s * 982451653; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, s, wrap) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const w = v => wrap ? ((v % wrap) + wrap) % wrap : v;
  const a = hash(w(xi), w(yi), s), b = hash(w(xi + 1), w(yi), s), c = hash(w(xi), w(yi + 1), s), d = hash(w(xi + 1), w(yi + 1), s);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 5, s = 1, wrap = 0) {
  let t = 0, amp = .5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { t += amp * vnoise(x * f, y * f, s + o, wrap ? wrap * f : 0); n += amp; amp *= .5; f *= 2; }
  return t / n;
}

// --- regolith: grey albedo with small craters + matching bump map (tileable) ---
export function regolith(size = 512) {
  const col = document.createElement('canvas'), bmp = document.createElement('canvas'); col.width = col.height = bmp.width = bmp.height = size;
  const cg = col.getContext('2d'), bg = bmp.getContext('2d');
  const ci = cg.createImageData(size, size), bi = bg.createImageData(size, size), H = new Float32Array(size * size);
  const P = 8; // noise period in cells -> tileable
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * P, v = y / size * P;
    H[y * size + x] = fbm(u, v, 6, 7, P) * .7 + fbm(u * 4, v * 4, 3, 11, P * 4) * .3;
  }
  // stamp small craters (bowl + raised rim), wrapped around the edges
  for (let k = 0; k < 140; k++) {
    const cx = hash(k, 1, 3) * size, cy = hash(k, 2, 3) * size, r = 3 + Math.pow(hash(k, 3, 3), 3) * 40, depth = .25 + hash(k, 4, 3) * .25;
    for (let y = -r * 1.6; y <= r * 1.6; y++) for (let x = -r * 1.6; x <= r * 1.6; x++) {
      const d = Math.hypot(x, y) / r; if (d > 1.6) continue;
      const px = ((Math.round(cx + x) % size) + size) % size, py = ((Math.round(cy + y) % size) + size) % size;
      H[py * size + px] += d < 1 ? -depth * (1 - d * d) : depth * .35 * Math.cos((d - 1) / .6 * Math.PI / 2);
    }
  }
  let lo = Infinity, hi = -Infinity; for (const h of H) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
  for (let i = 0; i < H.length; i++) {
    const h = (H[i] - lo) / (hi - lo), g = 105 + h * 70 + (hash(i, 5, 9) - .5) * 18;
    ci.data[i * 4] = g; ci.data[i * 4 + 1] = g * .985; ci.data[i * 4 + 2] = g * .95; ci.data[i * 4 + 3] = 255;
    const b = h * 255; bi.data[i * 4] = bi.data[i * 4 + 1] = bi.data[i * 4 + 2] = b; bi.data[i * 4 + 3] = 255;
  }
  cg.putImageData(ci, 0, 0); bg.putImageData(bi, 0, 0);
  const map = new THREE.CanvasTexture(col), bump = new THREE.CanvasTexture(bmp);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bump, height: H, lo, hi, size };
}

// --- Earth: oceans, continents, ice caps; separate cloud layer ---
export function earthTextures(w = 1024, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
  const cl = document.createElement('canvas'); cl.width = w; cl.height = h; const cg = cl.getContext('2d'), ci = cg.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w * 6, v = y / h * 3, lat = Math.abs(y / h - .5) * 2;
    const land = fbm(u, v, 6, 21, 6) + (fbm(u * 3, v * 3, 3, 23, 18) - .5) * .15;
    let r, gg, b;
    if (lat > .86) { r = gg = b = 235; }
    else if (land > .57) { const dry = Math.min(1, Math.max(0, (fbm(u * 2, v * 2, 4, 25, 12) - .4) * 2.2 + (1 - lat) * .3 - .15));
      r = 52 + dry * 120; gg = 70 + dry * 75; b = 40 + dry * 45; }
    else { const deep = Math.min(1, (.57 - land) * 6); r = 8 + 14 * (1 - deep); gg = 28 + 40 * (1 - deep); b = 72 + 55 * (1 - deep); }
    const i = (y * w + x) * 4; im.data[i] = r; im.data[i + 1] = gg; im.data[i + 2] = b; im.data[i + 3] = 255;
    const cloud = Math.max(0, fbm(u * 1.5 + 9, v * 2.5, 6, 31, 9) - .5) * 3.2 * (1 - Math.max(0, lat - .85) * 3);
    ci.data[i] = ci.data[i + 1] = ci.data[i + 2] = 255; ci.data[i + 3] = Math.min(220, cloud * 230);
  }
  g.putImageData(im, 0, 0); cg.putImageData(ci, 0, 0);
  const map = new THREE.CanvasTexture(c), clouds = new THREE.CanvasTexture(cl);
  map.colorSpace = clouds.colorSpace = THREE.SRGBColorSpace;
  return { map, clouds };
}

export function makeEarth(radius) {
  const { map, clouds } = earthTextures();
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), new THREE.MeshStandardMaterial({ map, roughness: .75, metalness: 0, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: .07 })));
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(radius * 1.012, 64, 32), new THREE.MeshStandardMaterial({ map: clouds, transparent: true, depthWrite: false, roughness: 1 })));
  const atm = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial([[0, 'rgba(120,180,255,0)'], [.66, 'rgba(110,170,255,0)'], [.7, 'rgba(110,170,255,.35)'], [.8, 'rgba(110,170,255,0)']]), blending: THREE.AdditiveBlending, depthWrite: false }));
  atm.scale.set(radius * 2.86, radius * 2.86, 1); grp.add(atm);
  grp.rotation.z = .4;
  return grp;
}

function radial(stops, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) r.addColorStop(o, col);
  g.fillStyle = r; g.fillRect(0, 0, size, size); return new THREE.CanvasTexture(c);
}
function streaks(size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.translate(size / 2, size / 2);
  for (let k = 0; k < 6; k++) {
    g.rotate(Math.PI / 6);
    const gr = g.createLinearGradient(-size / 2, 0, size / 2, 0);
    gr.addColorStop(0, 'rgba(255,240,210,0)'); gr.addColorStop(.5, k % 2 ? 'rgba(255,240,210,.5)' : 'rgba(255,240,210,.9)'); gr.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = gr; g.fillRect(-size / 2, -1.2, size, 2.4);
  }
  return new THREE.CanvasTexture(c);
}
// Sun: blinding core, soft corona, diffraction streaks (camera glare) — no atmosphere, so a hard black sky around it
export function makeSun(scale) {
  const grp = new THREE.Group();
  const add = (tex, s, opacity = 1) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true, opacity })); sp.scale.set(s, s, 1); grp.add(sp); return sp; };
  add(radial([[0, 'rgba(255,255,255,1)'], [.18, 'rgba(255,252,240,1)'], [.24, 'rgba(255,230,180,.6)'], [.5, 'rgba(255,200,130,.12)'], [1, 'rgba(255,180,100,0)']]), scale);
  add(radial([[0, 'rgba(255,220,160,.35)'], [1, 'rgba(255,200,120,0)']]), scale * 4, .7);
  add(streaks(), scale * 6, .4);
  return grp;
}
