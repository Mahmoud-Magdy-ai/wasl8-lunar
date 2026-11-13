// Wasl8 — Sun & Earth positions as seen from a point on the Moon.
// Uses astronomy-engine (open-source ephemeris by Don Cross, MIT licence, ~arcminute accuracy) and the IAU Moon rotation model.
// Works in the browser (global Astronomy) and in Node (require).
(function (root) {
  const A = (typeof module !== 'undefined' && module.exports) ? require('astronomy-engine') : root.Astronomy;
  const R_MOON_KM = 1737.4;
  const DEG = Math.PI / 180;

  function rotZ(v, a) { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[1], -s * v[0] + c * v[1], v[2]]; }
  function rotX(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0], c * v[1] + s * v[2], -s * v[1] + c * v[2]]; }

  // J2000 equatorial vector -> Moon body-fixed (IAU) vector
  function toMoonFixed(v, axis) {
    let r = rotZ(v, (90 + axis.ra * 15) * DEG);   // ra is in sidereal hours
    r = rotX(r, (90 - axis.dec) * DEG);
    r = rotZ(r, axis.spin * DEG);
    return r;
  }

  // Azimuth (deg, clockwise from north) and elevation (deg) of a body-fixed target vector (km)
  function azEl(target, latDeg, lonDeg) {
    const la = latDeg * DEG, lo = lonDeg * DEG;
    const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    const east = [-Math.sin(lo), Math.cos(lo), 0];
    const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
    const obs = up.map(x => x * R_MOON_KM);
    const d = [target[0] - obs[0], target[1] - obs[1], target[2] - obs[2]];
    const n = Math.hypot(d[0], d[1], d[2]);
    const u = d.map(x => x / n);
    const e = u[0] * east[0] + u[1] * east[1] + u[2] * east[2];
    const no = u[0] * north[0] + u[1] * north[1] + u[2] * north[2];
    const z = u[0] * up[0] + u[1] * up[1] + u[2] * up[2];
    let az = Math.atan2(e, no) / DEG; if (az < 0) az += 360;
    return { az, el: Math.asin(Math.max(-1, Math.min(1, z))) / DEG, distKm: n };
  }

  // Sun & Earth az/el from (lat, lon east) on the Moon at a JS Date
  function sky(date, lat, lon) {
    const t = A.MakeTime(date);
    const axis = A.RotationAxis(A.Body.Moon, t);
    const moon = A.GeoMoon(t);                       // Earth->Moon, AU, J2000
    const sun = A.GeoVector(A.Body.Sun, t, true);    // Earth->Sun, AU, aberration corrected
    const AU = A.KM_PER_AU;
    const earthFromMoon = [-moon.x * AU, -moon.y * AU, -moon.z * AU];
    const sunFromMoon = [(sun.x - moon.x) * AU, (sun.y - moon.y) * AU, (sun.z - moon.z) * AU];
    const s = azEl(toMoonFixed(sunFromMoon, axis), lat, lon);
    const e = azEl(toMoonFixed(earthFromMoon, axis), lat, lon);
    return { sunAz: s.az, sunEl: s.el, earthAz: e.az, earthEl: e.el, earthDistKm: e.distKm };
  }

  // Horizon elevation (deg) at an azimuth from a 1-deg (or finer) profile array
  function horizonAt(profile, az) {
    if (!profile || !profile.length) return 0;
    const step = 360 / profile.length; // works for 1, 0.5 or 0.25 deg sampling
    const x = ((az % 360) + 360) % 360 / step;
    const i = Math.floor(x) % profile.length, j = (i + 1) % profile.length, f = x - Math.floor(x);
    return profile[i] * (1 - f) + profile[j] * f;
  }

  const SUN_RADIUS_DEG = 0.267;
  // Fraction of the solar disk above the local horizon (linear approximation)
  function sunFraction(sunEl, horizonEl) {
    return Math.max(0, Math.min(1, (sunEl - horizonEl + SUN_RADIUS_DEG) / (2 * SUN_RADIUS_DEG)));
  }

  const api = { sky, horizonAt, sunFraction, R_MOON_KM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Lunar = api;
})(this);
