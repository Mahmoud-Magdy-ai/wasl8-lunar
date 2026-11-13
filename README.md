# Wasl (واصل) — Lunar Landing Site Navigator · Team Wasl8

**NASA Space Apps Challenge 2026 · Cairo · Challenge: Lunar Landing Site Navigator**

Pick a place at the lunar south pole and a landing day, and see — in seconds — how much sunlight (power) and direct Earth view (communications) a lander gets, and whether it survives. Then *live* the mission from inside the lander: the real terrain horizon, the Sun and Earth moving across it, battery, countdowns to sunset / Earth-set, alarms, and a "Why?" button that explains every event.

**Live site:** _(GitHub Pages link)_ · English + العربية · works on phones

## What it does
- **Plan:** curated sites (NASA Artemis candidate regions, CLPS target Mons Mouton, real landings IM-1, IM-2, Blue Ghost M1, Chandrayaan-3, Apollo 11/15/17 — each with a 'replay the real landing' button) or any point you tap on a LOLA map of the south pole; a year calendar coloured by Sun+Earth availability; best / typical / worst landing day; landing hour (UTC); years 2024–2030; side-by-side comparison of two sites (table + overlaid timeline); highest/average Sun elevation; first sunset and first Earth loss after landing; a table of every sunlight and Earth-contact window; "what if the launch slips ±1/7/30 days"; same-day comparison of all sites; a timeline chart of Sun and Earth elevation vs. the terrain; **CSV export**; a **3D view** of the real LOLA terrain (48 km around the site) lit by the real Sun, with a mission time slider.
- **Live it:** cockpit view of the real horizon, Sun and Earth (with Earth's true phase), battery with a 20 % safety reserve, power/link gauges, countdowns, ⏭ jump to next event, mission-control audio and haptics.
- **Report:** how long the lander lasted, battery trace, comparison with the best day, shareable result image.

## NASA data and how we use it
| Data | Use |
|---|---|
| **LRO LOLA LDEM_75S_240M** (NASA PDS Geosciences) | Terrain horizon: for every 0.25° of azimuth, the highest terrain angle within 200 km, exact spherical geometry (R = 1737.4 km), 2 m panel height (`tools/horizons.py`). A 480 m copy powers in-browser horizons for any tapped point. |
| **Astronomy Engine + JPL Horizons** | Sun and Earth azimuth/elevation from the lunar surface (Astronomy Engine in the browser, IAU Moon rotation, parallax, libration). Validated against the JPL Horizons API: max difference **0.002°** (`tools/VALIDATION.md`). |
| **NASA Artemis III candidate regions (Oct 2024)** | Site list. For each region we use the best-lit point (most hours with Sun and Earth together, 2027–2028) within 2 km of the published coordinates; both are shown and the published point can be selected. |

## Validation
- Sun & Earth az/el vs JPL Horizons: max difference 0.002°.
- Terrain horizons vs NASA PGDA 18.6-year average illumination map (LOLA AVGVISIB_85S_060M): correlation 0.98 over 40 points south of 85°S; every never-lit PGDA point is never lit in our model. Details: `tools/VALIDATION.md`.

## Method
- Sunlight = fraction of the solar disk (r = 0.267°) above the terrain. Earth in view = Earth's centre above the terrain + a user-set margin (0–10°). No atmosphere → no refraction, no twilight.
- Lander model (editable, illustrative): Sun-tracking vertical panel, battery, base load, radio load; shutdown at 20 % reserve.
- Best / typical / worst day = highest / median / lowest share of hours with Sun and Earth together over the mission window.

## What is real in the visuals
- Real: the south-pole map (LOLA elevations; shading/colours chosen for readability), the cockpit skyline (highest terrain per direction within 200 km), Sun/Earth positions and Earth's phase.
- Exaggerated: the skyline is drawn 3× taller on screen (true slopes are 1–3°).
- Illustrative only (not used in calculations): foreground rocks in the window, the intro landing scene, Earth's continents/clouds.

## Limits (honest list)
240 m terrain smooths small hills (real missions use 5–20 m); no thermal model; no Deep Space Network scheduling; absolute long-term illumination % not yet compared with NASA PGDA maps (relative pattern: correlation 0.98 over 40 points); lander classes are illustrative.

## Run locally
Static site, no build step: `python3 -m http.server` in this folder and open `http://localhost:8000`.
Regenerate horizons: download `LDEM_75S_240M.IMG` from NASA PDS into `../dem/`, then `python3 tools/optimize.py`.

## Sources & credits
Everything taken from outside the team, with its source and licence. The same list is in the app under **Data & method → Sources & credits**.

### Data
- **LRO LOLA LDEM_75S_240M**, NASA Planetary Data System, Geosciences Node: https://pds-geosciences.wustl.edu/missions/lro/lola.htm (terrain, horizons, map, 3D).
- **LOLA polar illumination map AVGVISIB_85S_060M**, NASA GSFC Planetary Geodesy Data Archive (E. Mazarico): https://pgda.gsfc.nasa.gov/products/69 (validation only; the archive asks users to cite Mazarico et al. 2011).
- **JPL Horizons**, NASA JPL Solar System Dynamics: https://ssd.jpl.nasa.gov/horizons/ (validation and "Check in JPL Horizons" links).
- **Artemis III candidate regions**: NASA, "NASA Provides Update on Artemis III Moon Landing Regions", 28 Oct 2024; George et al., NTRS 20250011660: https://ntrs.nasa.gov/citations/20250011660
- NASA data are generally not subject to US copyright; used per https://www.nasa.gov/nasa-brand-center/images-and-media/

### Landing-site coordinates
| Site | Coordinates | Source |
|---|---|---|
| de Gerlache Rim 2, Nobile Rim 2, Haworth, Mons Mouton | Artemis III regions; best-lit point within 2 km picked by our LOLA analysis | NASA Artemis III update (2024), NTRS 20250011660 |
| Shackleton–de Gerlache Ridge | −89.5343°, 209.9477°E (our LOLA analysis) | best-lit areas in Mazarico et al. 2011; Gläser et al. 2018 |
| IM-1 Odysseus (Malapert A) | −80.13°, 1.44°E | LROC, https://www.lroc.asu.edu/images/1360 |
| IM-2 Athena | −84.7906°, 29.1957°E | LROC, https://lroc.im-ldi.com/images/1408 |
| Chandrayaan-3 | −69.3741°, 32.32°E | LROC, https://www.lroc.asu.edu/images/1314 |
| Blue Ghost M1 | 18.5623°, 61.8103°E | LROC, https://www.lroc.asu.edu/images/1407 |
| Apollo 11, 15, 17 | LM positions | NASA NSSDCA, https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html (Davies & Colvin 2000) |

### Open-source software (full licence texts in `THIRD_PARTY_NOTICES.md`)
- **Astronomy Engine**, © 2019–2023 Don Cross, MIT: https://github.com/cosinekitty/astronomy
- **three.js**, © 2010–2024 three.js authors, MIT: https://threejs.org

### Fonts
- Inter (Rasmus Andersson), DM Mono (Colophon Foundry), IBM Plex Sans Arabic (IBM); SIL Open Font License 1.1, via Google Fonts.

### Scientific references
- Mazarico, E., et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211, 1066–1081. doi:10.1016/j.icarus.2010.10.030
- Gläser, P., et al. (2018). Illumination conditions at the lunar poles: Implications for future exploration. *Planetary and Space Science* 162.
- Archinal, B. A., et al. (2018). Report of the IAU WGCCRE: 2015. *Celest. Mech. Dyn. Astron.* 130, 22. doi:10.1007/s10569-017-9805-5
- Davies, M. E. & Colvin, T. R. (2000). Lunar coordinates in the regions of the Apollo landers. *JGR* 105(E8), 20277–20280.

### Notes
- South-pole map image rendered by us from LOLA; 3D lander is an original generic design (not a copy of any real spacecraft); Earth, Sun and regolith textures are procedural; sounds are synthesized; icons drawn by us; lander power numbers are illustrative assumptions.

## Use of AI
Code, data processing scripts and texts were developed with the help of Claude (Anthropic), directed and reviewed by the team. All scientific data come from NASA sources listed above. No NASA logos or insignia are used.

## Team Wasl8
Kyrollous Ayman Barsoom (lead) · Mahmoud Magdy Mohamed


_This is a NASA Space Apps Challenge 2026 project. It uses public NASA data but is not affiliated with, sponsored by or endorsed by NASA._
