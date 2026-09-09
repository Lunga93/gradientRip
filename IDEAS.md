# Architectural Improvement Ideas

Generated 2026-09-09 from full-diff review. Not a to-do list — a menu of options ranked by impact.

## Status — implemented 2026-09-09

- **#1 (hybrid, not full delete):** `geo.remote.ts` added — `query` for
  geocode/reverse/country, `command` for route/elevations; five `/api/*`
  endpoint files deleted. Autocomplete kept its endpoint on purpose:
  `AbortController` cancels real Photon traffic (quota), the stale-guard alone
  only gives correctness. Verified both transports are POST, so the SW
  method-check bypass covers them — no SW change needed.
- **#2 (done):** `+page.svelte` split into `PlanView`/`SavedView`/`RideView`/
  `PanelHeader`/`LegalNote`/`TabBar` plus `MapFabs`/`SessionToolbar`.
- **#3 (done, with correction):** state is now `domain`/`ui`/`session`
  singletons; dead `phys`/`mass`/`usableWh` deriveds removed. Note: the
  `stopTracking` hook existed because of the `tracker ↔ planner` cycle, not
  state size — fixed by making `applyResult` pure and calling `stopTracking()`
  explicitly in `finalisePlan`/`loadTrip`. The remaining planner↔tracker edge
  is runtime-only ESM (no eval-time access) and benign.
- **#4 (done + extended):** engine is now `src/lib/engine/` including
  `geometry.ts` (`LatLon`, `haversine`, `resample`, `cumulative`,
  `nearestOnLine`, `RESAMPLE_STEP_M`); `util.ts` keeps `geoErrorMessage` and
  re-exports geometry.
- **Quick wins:** `registerCumulative` deleted, `submitPlan` inlined.
  Abort cleanup **rejected** — per-field abort preserved (see #1).
- **Out-of-scope, all done:** map bias moved to runes (`geo-state.svelte.ts`,
  server keeps its own defaults and never imports it); SW note confirmed
  (POST bypass, no change needed); no `+page.server.ts` still correct.

---

## 1. Eliminate `/api/*` passthrough endpoints

**Problem:** Six endpoint files (`/api/geocode`, `/api/reverse`, `/api/country`, `/api/autocomplete`, `/api/route`, `/api/elevations`) are thin passthrough wrappers around `services.ts`. Each is 15-26 lines that receive a request, call a function, and return JSON. The client (`api.ts`) fetches each endpoint, which then fetches the external service. Two network hops where one would do.

**Idea:** Replace with remote `query` functions in `src/lib/geo.remote.ts`. Export `geocode`, `reverseGeocode`, `detectCountry`, `routeLegs`, `fetchElevations`. Delete all six `+server.ts` files. Slim `api.ts` to call the remote queries.

**Autocomplete exception:** `autocompleteSearch` needs `AbortSignal` for cancelling stale requests. Remote `query` doesn't natively support abort. Two options:
- Keep `/api/autocomplete` as the one endpoint (simplest)
- Drop `AbortController` entirely — the existing `stop.value.trim() !== query` guard already handles staleness

**Impact:** Deletes ~120 lines. Removes one network hop for every geocode/route/elevation call. Types flow directly from server return types.

**Effort:** Medium — mechanical. Autocomplete is the one edge case.

**Tradeoffs:** `kit.experimental.remoteFunctions` already enabled. Autocomplete abort integration is the one place endpoints beat remote queries.

---

## 2. Split `+page.svelte` (350 lines) into focused view components

**Problem:** `+page.svelte` is a monolith containing plan view, saved view, ride view, panel chrome, map FABs, draw/record toolbars, and bottom sheet handling.

**Idea:** Extract each tab view into its own component:
```
+page.svelte          → layout shell (map, panel, FABs, toolbars, tabs)
├── PlanView.svelte   → stops, presets, mode/board pickers, plan button
├── SavedView.svelte  → saved trips (wraps SavedTrips component)
├── RideView.svelte   → results, tracker (wraps ResultsPanel)
├── PanelHeader.svelte → brand, net badge, theme toggle
├── LegalNote.svelte  → legal notice
└── TabBar.svelte     → bottom navigation
```

**Evidence:** The three tab sections are `{#if activeTab === '...'}` blocks with no shared state between them. Each is 40-80 lines — already component-sized.

**Impact:** +page.svelte drops from 350 to ~120 lines. Each view is self-contained and testable.

**Effort:** Low — purely structural. No logic changes.

---

## 3. Split `app.svelte.ts` (301 lines) — separate UI chrome from domain state

**Problem:** `AppState` is a god class mixing domain state (stops, results, presets, trips, mode/board), UI chrome (sheet, tab, theme, legal, net), tracking state, draw/record state, and autocomplete state.

**Idea:** Split into focused state objects:
```ts
export const domain = new DomainState();  // stops, results, route, presets, trips, mode, board
export const ui = new UIState();          // sheet, tab, theme, legal, net, mobile
export const tracking = new TrackingState(); // active, stats, msg, following
export const draw = new DrawState();      // mode, points, record
```

**Impact:** Each state object is ~60-80 lines instead of 300. The `stopTracking` hook (late-bound to avoid circular imports) goes away if tracking state owns its own lifecycle.

**Effort:** Medium — need to update imports in every component.

**Tradeoffs:** More files, more imports. Single AppState is simpler for small apps. At 300 lines and growing, the split pays for itself.

---

## 4. Extract scoring engine as a pure package

**Problem:** `planCore.ts`, `scoring.ts`, and `modes.ts` form a coherent domain (physics, gradient scoring, verdict) imported by both server and client. The SPEC regression values live here. These files are pure — no I/O, no framework.

**Idea:** Move to `$lib/engine/`:
```
src/lib/engine/
├── modes.ts
├── scoring.ts
├── planCore.ts
├── planShared.ts
├── scoring.test.ts
└── planCore.test.ts
```

**Impact:** The scoring engine becomes a clear, isolated unit. Could be extracted as a standalone npm package later. Tests co-located with code.

**Effort:** Low — file moves + import path updates. No logic changes.

---

## 5. Quick wins (each under 10 lines)

| Change | What | Lines saved |
|--------|------|-------------|
| Delete `registerCumulative` | Remove deprecated no-op from `app.svelte.ts` and its import in `+page.svelte`. `cumulative` is imported directly. | 4 |
| Inline `submitPlan` | Replace `const submitPlan = () => runPlan()` with `onsubmit={(e) => { e.preventDefault(); runPlan(); }}` | 3 |
| Autocomplete abort cleanup | `AbortController` in `autocomplete.svelte.ts` is unnecessary — the stale-result guard already handles this. Remove it or pass signal through to endpoint. | 2 |

---

## Out-of-scope observations

1. **`api.ts` module-level `mapCenter` / `countryCode` are plain `let`s, not runes.** They work via ES module live bindings but can't be tracked by Svelte templates. Fine for now — if any future code reads these in a template, it'll be stale. Move to `.svelte.ts` runes module if that happens.

2. **Service worker caches app shell but not remote function responses.** Remote POSTs bypass SW (correct). If you add `query` functions later, their GET responses would be cached as app shell (network-first), which could serve stale data.

3. **`+page.server.ts` is deleted.** With `ssr = false` and no server load/actions, the server manifest is empty for this route. The app is now 100% client-side except for the remote command endpoint. This is fine — just noting it.

---

## The big shake-up

**Remote functions for the entire API surface.** If you commit to `kit.experimental.remoteFunctions`, delete all 6 `/api/*` endpoint files + slim `api.ts` + manual `fetch` + JSON parsing. Type story: `planRoute(input)` returns `PlanPacket`, `geocodeRemote(query)` returns `LatLon`, etc. No manual casting, no endpoint boilerplate.

The one blocker is autocomplete's `AbortSignal`. If you restructure autocomplete to ignore stale results (the guard already does this), drop `AbortController` entirely and use remote `query` for everything. That kills all 6 endpoint files in one move.
