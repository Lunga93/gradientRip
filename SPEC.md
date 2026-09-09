# Gradient — skate route planner

Route planning for electric skateboards. Given a chain of stops (origin, any number of
waypoints, destination), it profiles the terrain, colours the route by gradient, and
scores it against a specific board's climb limit, braking limit and battery capacity.

UI follows the Google Maps Directions pattern: full-screen map behind a floating white
panel with a stacked list of stop inputs (blue dot origin, grey numbered waypoints, red
pin destination), a reverse-order button, and a saved-places chip row backed by
`localStorage` (`gradient-presets-v1`) — click the ★ on any stop to save it, click a
saved chip to fill whichever stop was last focused.

Routes don't have to come from the router — two ways to make one by hand, both feeding
the same `scoreAndSaveCustomRoute(line, name, source)`:

- **"Draw a route"** (`enterDrawMode()` / `finishDrawing()`) — click points on the map to
  trace an informal shortcut you can see: a gap in a fence, a path through a park,
  anything OSRM has no OSM data for and therefore can never return from `route()`.
- **"Record live"** (`enterRecordMode()` / `finishRecording()`) — builds the line from
  actual GPS movement via `watchPosition()` instead, the way a fitness app records a
  track. Points under 5 m apart are dropped (GPS jitter while stationary isn't progress).

Either way the result is nothing but an array of `[lat, lon]` points, and from there it's
identical to scoring a computed route (`resample` → `elevations` → grade/energy
integration → `verdictFor` → `applyResult`) — that pipeline doesn't know or care where
the points came from, so there's no separate scoring logic to maintain. Saved trips flag
these with `drawn: true` / `recorded: true`; loading one skips repopulating the stop
search fields, since the `queries` value is just a single custom name, not a from/to
pair. The two modes are mutually exclusive with each other and with tracking an existing
route — entering one exits whichever of the others was active.

Planning a route (or finishing a drawn/recorded one) auto-starts live tracking and hides
the board picker + Plan button behind `#planControls` — the assumption is that planning
right now means riding right now. `stopTracking()` brings them back. Loading a route
from **Saved trips** does *not* auto-start tracking (browsing history isn't "about to
ride"), and a tracking start that never gets a first GPS fix reverts itself (see
`onTrackError`) rather than leaving the panel stuck with controls hidden.

Status: working prototype. Scores routes correctly. Does **not** yet optimise for
gradient — see [Limitation 1](#1-routing-is-not-gradient-aware-blocking).

---

## Run it

SvelteKit app (`gradientRip/app`) using `@sveltejs/adapter-node`. The page shell is
client-side only (`export const ssr = false`); all third-party lookups run as
**remote functions** on the Node server, so a `node build` is required — there is no
standalone static deploy.

```bash
npm run dev       # dev server (no CSRF origin check, no build)
npm run build && node build   # production: compiled server
```

Gates before handing off: `npm run test`, `npm run check`, `npm run lint`, `npm run build`.

---

## Architecture

SvelteKit + Svelte 5 runes build. Leaflet 1.9.4 (bundled) is the only runtime
UI dependency; Tailwind CSS v4 + DaisyUI 5 handle styling.

### The app talks to its own origin only

Every provider call happens **server-side** (honest `User-Agent`, quota/pace
server-side, no keys in the browser):

- `src/lib/server/services.ts` — Nominatim/Photon/OSRM/Open-Meteo callers.
- `src/lib/geo.remote.ts` — typed remote gateway: `query` for small idempotent
  reads (`geocodeRemote`, `reverseRemote`, `countryRemote`; deduped + cached by
  arg, good for the Nominatim quota), `command` for route legs and elevation
  batches (`routeRemote`, `elevationsRemote`; large payloads, never cached).
  Autocomplete keeps its `src/routes/api/autocomplete/+server.ts` endpoint —
  it needs `AbortSignal` cancellation, which remote functions don't thread through.
- Remote **command**: the Plan form calls `planRoute` (`src/lib/plan.remote.ts` →
  `runRemotePlan`), and the whole geocode→route→elevation→score pipeline runs on
  the server, returning a serialisable `PlanPacket`.

### Scoring shared, one implementation

`src/lib/engine/planCore.ts:buildPlanPacket()` is the pure scorer used by both the server
command (planned routes) and the browser (drawn/recorded routes via `elevationsRemote`).
No physics drift between paths. The engine (`src/lib/engine/`: modes, scoring,
geometry, planCore, planShared + tests) is dependency-free — no I/O, no framework —
and is the unit to extract if this ever becomes a standalone package.

### Data flow

```
address strings
  → (server) Nominatim geocode        (1 req/sec, hard rate limit)
  → (server) OSRM route               (returns GeoJSON polyline, no elevation)
  → resample every 50 m
  → (server) Open-Meteo elevation     (batched 100 coords/request)
  → 3-point moving average            (DEM noise suppression)
  → per-segment grade + energy integration
  → verdict + SVG profile + Leaflet overlay
```

### External services

| Service | Endpoint | Key | Notes |
|---|---|---|---|
| Geocoding | `nominatim.openstreetmap.org` | none | 1 req/sec ceiling; usage policy forbids production load. Called server-side with a proper `User-Agent` (Node's default `node` UA is 403'd). Bound via `countrycodes` to the user's detected country (`detectCountry()`), not a rectangle — a box cuts off results near a big country's edges or leaks across a border; `countrycodes` is a proper administrative filter |
| Autocomplete | `photon.komoot.io` | none | real prefix matching (Nominatim's /search doesn't reliably prefix-match — confirmed by hand: "Tyger" → 5 results, "Tygerb" → 0, full word → 2 again). Debounced 450ms, throttled 500ms between requests. No countrycodes param, so filtered server-side on each result's `properties.countrycode` instead; `lat`/`lon` stays a soft ranking bias, not a hard box |
| Routing | `routing.openstreetmap.de/routed-bike` | none | primary; no uptime guarantee |
| Routing fallback | `router.project-osrm.org` | none | driving profile only |
| Elevation | `api.open-meteo.com/v1/elevation` | none | 30 m DEM, CORS enabled |
| Tiles | `tile.openstreetmap.org` | none | respect the tile usage policy |

### Key modules

| Module | Contract |
|---|---|
| `src/lib/engine/planCore.ts` | `buildPlanPacket()` — shared pure scorer (server + client) |
| `src/lib/engine/planShared.ts` | the serialisable `PlanPacket` / `PlanSource` types |
| `src/lib/engine/scoring.ts` | `segWh`, `band`, `routeSegments`, `verdictFor`, `profileSVG` |
| `src/lib/engine/geometry.ts` | `LatLon`, `haversine`, `resample`, `cumulative`, `nearestOnLine` |
| `src/lib/engine/modes.ts` | transport-mode physics, boards, `NOMINATIM_DELAY_MS` |
| `src/lib/server/services.ts` | provider callers (Nominatim/Photon/OSRM/Open-Meteo) |
| `src/lib/geo.remote.ts` | typed remote gateway (query: geocode/reverse/country; command: route/elevations) |
| `src/lib/api.ts` | browser gateway (remote calls + `/api/autocomplete` fetch with abort) |
| `src/lib/geo-state.svelte.ts` | runes map bias: `geoState.center/country` + `DEFAULT_CENTER` |
| `src/lib/planner.svelte.ts` | `runPlan`, `finalisePlan`, `loadTrip`, `scoreAndSaveCustomRoute`, `locateInto`, `initMapCenter` |
| `src/lib/state/domain.svelte.ts` | ride data: stops, results, presets, trips, mode/board |
| `src/lib/state/ui.svelte.ts` | chrome: sheet, tab, theme, legal, net, status |
| `src/lib/state/session.svelte.ts` | live session: planning, tracking, draw/record, autocomplete |

---

## The physics model

Do not "simplify" this. The numbers were validated by hand against an independent
calculation before the code was written.

```js
const G=9.81, RHO=1.2, CDA=0.65, CRR=0.02, EFF=0.80, USABLE=0.87;

f_roll = CRR * mass * G
f_air  = 0.5 * RHO * CDA * v²
f_grav = mass * G * sin(atan(grade))
f      = max(0, f_roll + f_air + f_grav)      // clamped: no regen credited
Wh     = (f * distance) / EFF / 3600
```

`mass` is rider + kit + the active mode's vehicle mass (6.8 kg e-skate, 22 kg
e-bike, 14 kg e-scooter, 12 kg EUC). `USABLE` discounts nameplate capacity for BMS
cutoff and the reality that nobody rides to 0%.

**Regression values** (e-skate defaults: mass 116.8 kg, drivetrain 80%):

| Case | Expected |
|---|---|
| Flat, 25 km/h, 1 km | 14.5 Wh |
| Flat, 40 km/h, 1 km | 24.7 Wh |
| 1.9 km with 60 m ascent, 25 km/h | 51.4 Wh |

If a change moves these by more than ~5%, the change is wrong.

**Human-powered modes** (push skate, pedal bike, kick scooter) run the same
integration with muscular efficiency (~24%) instead of drivetrain efficiency, so
Wh is metabolic energy and the UI shows kcal (×0.86). Spot values: ~27 kcal/km
pushing at 12 km/h, ~25 kcal/km pedalling at 20 km/h, ~17 kcal/km kicking at
12 km/h. The "battery" is a comfortable day's output (fully available, no BMS
cutoff) and verdict copy switches to food/effort wording.

**The clamp at zero matters.** Descents draw nothing rather than returning energy.
This is deliberate: the reference board (Journ-E Phantom) publishes only
"Electronic brake EBS" with no regeneration claim, while a sibling board in the same
range is explicitly marketed as regenerative. Assume no recovery until measured.
If you add a regen toggle, cap recovery at 60% of the negative term — real-world
recovery on this class of hardware runs 3–8% of consumption.

---

## Gradient bands are deliberately asymmetric

```
≤ -12%   past braking       (oxblood)
≤  -8%   steep descent      (rust)
≤  -4%   watch your speed   (ochre)
  ±4%    easy going         (moss)
<  10%   working climb      (sage)
<  15%   hard climb         (ochre)
≥  15%   at the motor limit (rust)
```

A +10% climb is "working". A -10% descent is "steep" and one band more severe.
This is the core product thesis and a reviewer will try to symmetrise it.

**Rationale:** on a bicycle, uphill is the cost. On a skateboard, uphill costs
energy but downhill costs control. A grade the motors will grind up is a grade the
electronic brake may not hold, and electronic braking is *weakest on a full pack*
because a full battery has nowhere to put regenerated current — so the danger peaks
immediately after charging. A downhill grade past the braking limit returns a `stop`
verdict, not a warning. Keep it that way.

---

## Known limitations

### 1. Routing is not gradient-aware (blocking)

OSRM has no elevation support and cannot cost on slope. The app therefore **scores
the route it was handed** rather than searching for a flatter one. This is the gap
between the current prototype and the stated product goal.

### 2. DEM resolution is coarser than a street

Free DEMs (SRTM, Copernicus GLO-30) are 30 m horizontal. A street is ~15 m wide, so
each sample averages the road with the terrain beside it. Long climbs resolve fine;
short steep pitches get smoothed away — exactly the ones that matter here. No free
1 m LiDAR exists for South Africa. The 3-point moving average in `sm` suppresses
noise but cannot add resolution. Do not present gradients to users as precise.

### 3. Nominatim is not viable in production

Its usage policy caps automated use at 1 req/sec and prohibits heavy traffic. The
1100 ms delay in the click handler respects this for one user; it will not survive
real traffic.

### 4. No surface or smoothness costing

OSM `surface=*` and `smoothness=*` tags are sparse in Cape Town. A route over
cobbles scores identically to smooth tar. Small wheels care enormously about this.

### 5. "Offline" means replay, not first-time planning

Geocoding, routing and elevation are all live third-party lookups (see External
services). There is no bundled road graph, so **planning a brand-new route requires
a connection**, full stop — no amount of service-worker cleverness changes that.

What genuinely works with zero network access:

- The installed app shell (HTML/CSS/JS, Leaflet, the board/mode data) — precached
  on install and served network-first-with-cache-fallback so it still loads
  offline and always prefers a fresher copy when one's reachable.
- Map tiles and elevation samples already fetched once — the service worker caches
  these permanently (`TERRAIN_CACHE`), since terrain doesn't change. A never-before-seen
  area still shows a blank/grey map offline.
- **Saved trips** (`gradient-trips-v1` in `localStorage`, capped at `TRIPS_MAX`):
  every successful plan stores its full road geometry, elevation samples and
  verdict inputs — not just the summary — so `loadTrip()` re-derives `segs` and the
  verdict with `routeSegments()`/`verdictFor()` (cheap pure functions) and redraws
  the exact same map, profile and stats with **zero fetch calls**. This is the whole
  offline story: revisit a route you've already planned, anywhere, no signal needed.

`updateNetBadge()` reflects `navigator.onLine` in the header and the submit handler
short-circuits with a clear message when offline, rather than surfacing a raw
"Failed to fetch" from the geocoder. Don't build an offline-first router on top of
this without also solving Limitation 1 — bundling a real, sizeable road graph is a
different project.

---

## Roadmap

### Task 1 — Swap in gradient-aware routing (highest value)

Replace `route()` with GraphHopper. Its custom-model DSL exposes `average_slope` and
`max_slope` as first-class costing variables, which is the only clean way to get the
asymmetric cost into the search rather than the scoring.

```json
{
  "profile": "bike",
  "custom_model": {
    "priority": [
      { "if": "average_slope > 6",  "multiply_by": 0.4 },
      { "if": "average_slope > 12", "multiply_by": 0.05 },
      { "if": "average_slope < -8", "multiply_by": 0.15 },
      { "if": "average_slope < -12","multiply_by": 0.0 },
      { "if": "surface == COBBLESTONE || surface == GRAVEL", "multiply_by": 0.2 }
    ],
    "speed": [
      { "if": "true", "limit_to": 30 }
    ]
  }
}
```

Note the asymmetry survives into the routing weights: -12% is hard-blocked at 0.0
while +12% is merely heavily penalised at 0.05.

GraphHopper also returns elevation inline when `elevation=true`, which removes the
Open-Meteo round trip and roughly halves the request count.

Self-hosting alternatives if the free tier is too small: Valhalla (dynamic costing,
heavier to run) or BRouter (light, custom profile language, cyclist-oriented).

**Done when:** requesting a route between two points separated by a ridge returns a
path around it rather than over it, and the returned route differs measurably from
the OSRM path on at least one Cape Town test case.

### Task 2 — Route alternatives, ranked

Request `alternatives=true`, score each with the existing pipeline, present them
sorted by verdict severity rather than by duration. The scoring code already
handles this; only the UI is missing.

**Done when:** the user sees 2–3 options with distance, climbing and battery cost
side by side, and the flattest is not necessarily first if it is far longer.

### Task 3 — Board profiles as data (partially done)

`MODES` in `index.html` already holds per-transport-mode physics
(`cda/crr/eff/usable/speed/vehicleKg`), board presets (`Wh|climbLimit|brakeLimit`)
and mode-specific braking verdict copy, persisted via `gradient-transport-v1`.
Still missing: derating — a rider near the load limit should see the climb
limit reduced, since rated climb figures assume a light rider.

### Task 4 — Replace geocoding

Photon, Pelias, or a self-hosted Nominatim. Remove the 1100 ms delay once done.

### Task 5 — Crowdsource gradient corrections

The only realistic path past Limitation 2. Record rider GPS traces with barometric
altitude where available, aggregate per OSM way, override the DEM where enough
traces agree. This is a product in itself, not a patch.

---

## Constraints

- Net new runtime dependencies are fine, but they must be added deliberately (see
  `package.json`); the physics/scoring must never change (regressions above).
- No `localStorage` or `sessionStorage` if this is ever pasted into a Claude artifact
  preview — they are unsupported there. Real hosts are fine.
- The service worker must never cache routing or geocoding responses — including our
  own `/api/autocomplete` (a cached route hides a closed road). Remote-function
  calls already bypass the SW via the non-GET method check, and the autocomplete
  endpoint sends `Cache-Control: no-store`. Tiles and elevation are cached
  permanently and deliberately: terrain height does not change.
- Keyboard focus is visible and the layout is responsive to mobile. Keep both.
- On mobile (≤640px) the panel is a bottom sheet: peek (grabber + brand) and
  open states, transform-only animation with a spring easing, grabber is a real
  `<button>` (tap/keyboard alternative to swipe), safe-area insets respected.
- Theme: DaisyUI themes `gradient` (light, default) + `gradient-dark` (follows
  system); a header toggle pins auto/light/dark via `data-theme`, applied by a
  pre-paint script in `app.html` before first paint. Brand tokens (`--brand-gradient`,
  map filter/vignette, profile band colours) live in the theme blocks so they swap
  with the theme automatically.
- Motion: ease-out entries, staggered results reveal, `prefers-reduced-motion`
  disables it all. No emoji as icons — inline SVG only.
- Type: Space Grotesk (display: wordmark, headings, stat numerals) + Inter (UI),
  loaded with `display=swap` over system-stack fallbacks so offline still renders.
  Primary CTAs use the gradient `.btn-hero`; carousels drag-scroll on mouse.

## Post-migration audit — done 2026-09-09

Svelte 5/SvelteKit migration audit (the "check everything" pass). State:

- **Compliance:** all modules use `const` arrow functions — no `function`
  declarations anywhere in `src` (classes keep method syntax). Shared state lives
  in `.svelte.ts` runes modules (`state/domain|ui|session.svelte.ts`,
  `geo-state.svelte.ts`, `planner.svelte.ts`, `autocomplete.svelte.ts`,
  `mapController.svelte.ts`).

## Structural pass — done 2026-09-09 (IDEAS.md)

- **Engine extracted:** `modes/scoring/planCore/planShared/geometry` + both test
  files live in `src/lib/engine/` (pure, no I/O, no framework); `util.ts` keeps
  `geoErrorMessage` and re-exports geometry for the UI/session modules.
- **State split:** the `AppState` god object is now `domain` (ride data),
  `ui` (chrome + status) and `session` (planning/tracking/draw/record/
  autocomplete); dead `phys`/`mass`/`usableWh` deriveds removed. The
  `registerStopTracking` late-bound hook is gone — `applyResult` is pure
  assignment and the planner calls `stopTracking()` explicitly.
- **Geo bias in runes:** `mapCenter`/`countryCode` mutable `let`s are now
  `geoState.center/country` (`geo-state.svelte.ts`); server modules keep their
  own defaults and never import it.
- **Remote gateway:** `geo.remote.ts` (`query`: geocode/reverse/country,
  `command`: route/elevations) replaces five `/api/*` endpoints (deleted);
  autocomplete keeps its endpoint for `AbortSignal`. All remote transports are
  POST, so the SW method-check bypass covers them.
- **Page split:** `+page.svelte` (~350 → ~110 lines shell) with `PlanView`,
  `SavedView`, `RideView`, `PanelHeader`, `LegalNote`, `TabBar`, `MapFabs`,
  `SessionToolbar` components; `loadTrip` moved from `SavedTrips` into the
  planner; tracking markers owned by `mapController`.
- **Verified:** `npm run check` 0/0, `npm run test` 20/20, `npm run lint` clean,
  `npm run build` ok; production `node build` smoke GET / 200.

---
- **Fixed in this pass:**
  - DEM noise-suppression smoothing (`smooth3`) was silently missing from the new
    plan pipeline — restored in the single shared scorer `planCore.buildPlanPacket`
    and locked by `planCore.test.ts` (a lone ~9% spike must resolve to ~3% "easy going").
  - Autocomplete now strips control characters before hitting the geocoder and
    collapses whitespace on the reflected label.
  - Contrast: brand bolt is no longer white-on-white in dark mode (new `--brand-mark`
    token, one per theme).
  - Map stacking: desktop zoom control moved clear of the left panel, locate/recenter
    FABs moved bottom-right and raised to `z-30`, Leaflet attribution lifted above them.
  - Dead code removed: `online`/`offlineHint`/`hasResults` deriveds, `cloneStops`,
    `mapController.clearRoute`, `storage.loadCollapsed`/`saveCollapsed` +
    `COLLAPSE_KEY_PREFIX` (legacy collapse feature), duplicate `geoErrorMessage`.
- **Known limits (unchanged, no provider support):** no dedicated micromobility
  routing profile — OSRM *bicycle* profile is used (not automotive), so bike lanes and
  non-motorway ways are respected, but GIS surface type is not costed. See Roadmap
  Task 1 (GraphHopper).
- **Verified:** `npm run check` 0/0, `npm run test` 18/18, `npm run lint` clean,
  `npm run build` ok; live smoke of production `node build` (GET / 200) and the
  `?/plan` form action on the dev server (Sea Point → Mouille Point: verdict OK,
  3.93 km, 52.5 Wh, smoothed elevation array returned).
- Browser console has no app-authored CSS warnings: the `image-rendering`,
  VML `behavior`/`progid`, `interpolate-size`, `animation-timeline`,
  `-webkit-*` lines all come from Leaflet's shipped IE-era hacks and
  Tailwind/DaisyUI progressive features, and drop harmlessly in modern engines.

---

## Legal note — keep this in the UI

Electric skateboards cannot be legally ridden on public roads in South Africa. Under
the National Road Traffic Act 93 of 1996 anything self-propelled is a motor vehicle,
motor vehicles on public roads must be registered and licensed, and no registration
category exists for a motorised skateboard — so there is no compliance route to take.
Pavements form part of the public road reserve and are covered by the same position.

The practical exposure is not a traffic fine but personal liability and insurance
response after an incident on an unregistered vehicle.

This means a "private property" mode — estates, campuses, private trails, promenades
— is arguably the real product rather than a feature. The disclaimer currently in the
footer should not be removed. It may be collapsed via its ✕ button, but only
because a one-tap "Legal note hidden — Show" bar takes its place and restores
it (`gradient-legal-v1` in `localStorage`); the text itself must stay one tap
away at all times.
