// Curated landing sites. lon = degrees east (-180..360 accepted).
// horizon profiles (360 values, 1 deg azimuth steps, degrees above the astronomical horizon)
// are loaded from data/horizons.js when available (computed from LRO LOLA topography).
window.SITES = [
  { id: 'degerlache', name: 'de Gerlache Rim 2', lat: -88.6834, lon: -67.9321,
    tag: 'Artemis candidate region', note: 'Near the south pole, on the rim of de Gerlache crater.', src: { t: 'NASA, Artemis III landing regions update (28 Oct 2024)', u: 'https://ntrs.nasa.gov/citations/20250011660' } },
  { id: 'nobile2', name: 'Nobile Rim 2', lat: -84.2016, lon: 60.6999,
    tag: 'Artemis candidate region', note: 'One of NASA’s nine Artemis III candidate regions.', src: { t: 'NASA, Artemis III landing regions update (28 Oct 2024)', u: 'https://ntrs.nasa.gov/citations/20250011660' } },
  { id: 'haworth', name: 'Haworth', lat: -86.7262, lon: 338.3613,
    tag: 'Artemis candidate region', note: 'Next to permanently shadowed craters that may hold water ice.', src: { t: 'NASA, Artemis III landing regions update (28 Oct 2024)', u: 'https://ntrs.nasa.gov/citations/20250011660' } },
  { id: 'ridge', name: 'Shackleton–de Gerlache Ridge', lat: -89.5343, lon: 209.9477,
    tag: 'Reference: one of the best-lit spots', note: 'A ridge that sees the Sun most of the year.', src: { t: 'Mazarico et al. 2011, Icarus 211; Gläser et al. 2018, Planet. Space Sci. 162 (best-lit areas); exact point from our LOLA analysis', u: 'https://doi.org/10.1016/j.icarus.2010.10.030' } },
  { id: 'monsmouton', name: 'Mons Mouton', lat: -84.6, lon: 31.0,
    tag: 'Artemis candidate region', note: 'Artemis III candidate region; IM-2 Athena landed on it in 2025.', src: { t: 'NASA, Artemis III landing regions update (28 Oct 2024)', u: 'https://ntrs.nasa.gov/citations/20250011660' } },
  { id: 'im2', name: 'IM-2 Athena', lat: -84.7906, lon: 29.1957, landing: Date.UTC(2025, 2, 6, 17, 29),
    tag: 'Real mission · Mar 6, 2025', note: 'Athena came down too fast and ended on its side in a 20 m crater, but still sent data.', src: { t: 'LROC / NASA GSFC / ASU, “IM-2 Athena Seen Obliquely”', u: 'https://lroc.im-ldi.com/images/1408' } },
  { id: 'malapert', name: 'Malapert A (IM-1 landing)', lat: -80.13, lon: 1.44, landing: Date.UTC(2024, 1, 22, 23, 23),
    tag: 'Real mission · Feb 22, 2024', note: 'Intuitive Machines’ Odysseus came to rest on a 12° slope near Malapert A.', src: { t: 'LROC / NASA GSFC / ASU, “Intuitive Machines IM-1 On The Moon!”', u: 'https://www.lroc.asu.edu/images/1360' } },
  { id: 'chandrayaan3', name: 'Chandrayaan-3 (India)', lat: -69.3741, lon: 32.32, landing: Date.UTC(2023, 7, 23, 12, 33),
    tag: 'Real mission · Aug 23, 2023', note: 'ISRO’s Vikram lander, about 600 km from the south pole.', src: { t: 'LROC / NASA GSFC / ASU, “Chandrayaan-3 Landing Site”', u: 'https://www.lroc.asu.edu/images/1314' } },
  { id: 'blueghost', name: 'Blue Ghost M1 (CLPS)', lat: 18.5623, lon: 61.8103, landing: Date.UTC(2025, 2, 2, 8, 34),
    tag: 'Real mission · Mar 2, 2025', note: 'Firefly’s CLPS lander in Mare Crisium.', src: { t: 'LROC / NASA GSFC / ASU, “Blue Ghost Lunar Lander Seen From Above”', u: 'https://www.lroc.asu.edu/images/1407' } },
  { id: 'apollo11', name: 'Apollo 11', lat: 0.674, lon: 23.473, landing: Date.UTC(1969, 6, 20, 20, 17),
    tag: 'Contrast: equator', note: 'At the equator the Sun climbs high and Earth hangs still overhead.', src: { t: 'NASA NSSDCA, Apollo Landing Site Coordinates (Davies & Colvin 2000)', u: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html' } },
  { id: 'apollo15', name: 'Apollo 15', lat: 26.1322, lon: 3.6339, landing: Date.UTC(1971, 6, 30, 22, 16),
    tag: 'Apollo · 1971', note: 'Hadley–Apennine, at the edge of a mountain range.', src: { t: 'NASA NSSDCA, Apollo Landing Site Coordinates (Davies & Colvin 2000)', u: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html' } },
  { id: 'apollo17', name: 'Apollo 17', lat: 20.1908, lon: 30.7717, landing: Date.UTC(1972, 11, 11, 19, 54),
    tag: 'Apollo · 1972', note: 'Taurus–Littrow valley, the last crewed landing.', src: { t: 'NASA NSSDCA, Apollo Landing Site Coordinates (Davies & Colvin 2000)', u: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html' } },
];

// Use the terrain-refined coordinates when available (see data/horizons.js)
(function () {
  const H = window.HORIZONS || {};
  for (const s of window.SITES) {
    const h = H[s.id];
    if (h && h.lat != null) { s.pubLat = s.lat; s.pubLon = s.lon; s.lat = h.lat; s.lon = h.lon; s.elev = h.elev; s.optimized = h.optimized; }
  }
})();
