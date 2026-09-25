# GradientRip App Shell Redesign — Design (design system + navigation shell)

**Date:** 2026-09-25
**Status:** approved by product owner (chat approval 2026-09-25)
**Scope:** Phase A of the social-media rebuild. Subsequent phases: B posts+feed, C crews,
D safety reports, E live ride posts — each its own spec.
**Basis:** brainstorming transcript 2026-09-25 (post model: user-authored posts with
text/photo/video + attached rides; live intent = live location posts, not video streaming).

## 1. Goal

Rebuild the app shell and visual language so GradientRip reads as a designed social app
(Twitter-shaped: feed, explore, activity, profile) instead of a single crowded planner
panel. Same information, new sequence: one idea per screen, quiet surfaces, real URLs for
everything shareable. The planner and ride screens adopt the new tokens and type but keep
their current layout and features — no planning-behaviour change in this phase.

Non-goals: posts/composer/media upload (Phase B), crew feeds (Phase C), safety reports
(Phase D), live ride posts (Phase E), planner/ride UI restructuring, ML recommendations,
monetization, admin console.

## 2. Locked decisions

- **Scope order:** A design system + shell → B posts + feed + composer → C crews →
  D safety reports → E live ride posts. Each phase gets its own spec → plan → implementation.
- **Map:** its own tab, no longer the permanent background. Mounts per route;
  `mapController.svelte.ts` stays a module singleton so its state survives mount/unmount.
- **Tabs:** Home · Map · Explore · Activity · Me (bottom bar; `aria-current` on active).
- **Routing:** every screen is a real SvelteKit route (approach A, not client-state tabs).
- **Visual base:** light editorial + confident restraint. White/off-white surfaces, near-black
  text, solid brand blue fills for actions/avatars/badges/active states, blue→cyan gradient
  spent only on route lines and the wordmark.
- **Text:** fully solid (no `rgba` ink), 12px floor for text (11px metadata only), minimum
  weight 600 for labels, one self-hosted Inter woff2 with preload, smoothing left on default.
- **Phase A reach:** reskin planner/ride with new tokens and type; restructure only the
  social half. Dark mode stays, designed as a proper second theme from the same tokens.
- **Ride mode:** keeps a full-screen layout with no tab bar.

## 3. What exists today (do not regress)

Planner (mode picker, presets, results panel, quick circuits, saved trips, share toggle),
ride recording + live position push, friends (requests, list, live peers, map pins, shared
routes), channels (list, create, join, member detail), explore (public routes + fit badges),
events (list, RSVP, invite links), onboarding wizard, feed API (routes + events, no UI),
service-worker offline shell, 129 pure-logic vitest tests, `npm run check/lint/test/build` gates.

## 4. Design system

### 4.1 Colour (solid only)

- Page `#FFFFFF`, sunken `#F6F7F9`, hairlines `#E4E7EC` / `#D0D5DD` (strong).
- Text: `--text-primary #0F172A`, `--text-secondary #46525F`, `--text-tertiary #6B7887`,
  `--text-disabled #9AA5B1`, `--text-on-accent #FFFFFF`. Hierarchy from colour value,
  never opacity. Dark theme inverts the same steps; also solid.
- Accent: `--accent #1D4ED8`, `--accent-hover #1E40AF`. Solid fills only — primary buttons,
  active tab indicator, filled avatars, selected states, kudos counts.
- `--brand-gradient` (blue→cyan) reserved for route lines + wordmark.
- Verdict/state (go `#047857`, caution `#B45309`, stop `#DC2626`, live `#059669`):
  slightly desaturated so they read as data, distinguishable from the accent.

### 4.2 Type

- One self-hosted Inter woff2, preloaded, service-worker cached (offline-safe).
- Scale: display 28/32 700 · title 20/26 600 · heading 17/24 600 · body 15/22 400 ·
  body-strong 15/22 600 · meta 13/18 500 · label 12/16 600. Mono for numbers/data only,
  never section labels. No weight below 500, nothing below 12px (11px metadata excepted).
- Drop `-webkit-font-smoothing: antialiased`. Uppercase labels only, max 0.04em tracking.

### 4.3 Primitives (`app/src/lib/ui/`)

`AppShell`, `TabBar`, `ScreenHeader`, `ListRow`, `MediaCard` (only card with a background),
`SegmentedControl`, `EmptyState`, `StateBadge`, `PrimaryButton`/`SecondaryButton` (44px min),
`Skeleton`, `Sheet`, `ErrorNotice`, `nav.ts` (route table), `format.ts` (relative
time/distance/counts). Cards-versus-list rule: cards only for media; everything else is a
`ListRow` with hairlines. One primary action per screen. No glow, no drop-shadow on lists.

### 4.4 Deletions

`.panel` / `.panel-scroll` / `.grabber` / `.view`, `clip-chamfer-*`, `.chamfer-card`,
`.verdict-tag`, `color-mix(...16%, transparent)` tints, `ui.activeTab` / `panelVisible` /
`sheetOpen`, `PanelHeader`, old `TabBar`, uppercase mono section labels, `rgba` ink tokens,
DaisyUI dependency (installed, verified never loaded — theme values are hand-written
Tailwind v4 `@theme`). The 104 inline `style="color: var(--ink-2)"` usages migrate to
semantic utility classes so the system is enforceable.

## 5. Routes and screen map

```
/ → /home
/home                     feed on the existing API (routes + events cards, kudos)
/map                      planner: map, mode picker, presets, results, quick circuits
/ride                     full-screen ride mode, no tab bar
/explore                  SegmentedControl: Routes | Crews | Events
/explore/routes           public routes with fit badges
/explore/crews            crew list, create, join
/explore/events           events with RSVP
/activity                 friend requests, notifications, buddy alerts (tab badge)
/me                       profile
/me/rides                 saved trips + share toggle
/me/friends               buddies with live status
/crew/[id]                crew profile: header, about, members, content
/route/[id]               route detail
/event/[id]               event detail with RSVP + invite links
/post/[id]                reserved for Phase B
```

Current → new: `PlanView`+`ResultsPanel`+`PresetChips`+`HomeCircuitBar` → `/map`;
`SessionToolbar` → `/ride`; `SavedView`/`SavedTrips` → `/me/rides`; `ChannelsView` →
`/explore/crews`, `ChannelDetail` → `/crew/[id]` (upgraded to community surface in
Phase C); `ExploreView` → `/explore/routes`, `RouteDetail` → `/route/[id]`;
`EventsView` → `/explore/events`, `EventDetail` → `/event/[id]`; `FriendsView` splits into
`/activity` + `/me/friends`. Friend live pins stay as a map layer on `/map`.
`/home` renders the existing feed API in Phase A so it ships populated; Phase B swaps the
content model (posts) without redesigning the screen.

## 6. Motion, accessibility, offline

- Bottom TabBar with safe-area insets; `aria-current` active tab; full keyboard traversal;
  visible focus rings; 44px minimum targets; `prefers-reduced-motion` respected.
- Skeletons for loading (no spinner jitter); `EmptyState` (title + one line + one action);
  `ErrorNotice` with retry; truthful error copy (no "are you offline?" for server rejections).
- Service worker precaches the new route chunks; offline shell and airplane-mode behaviour
  preserved and re-tested per tab.

## 7. Testing

- Add `@testing-library/svelte` + `happy-dom` (no DOM test setup exists today).
- Component tests for primitives: rendering, roles, `aria-current`, targets.
  Unit tests for `nav.ts` route table and `format.ts`.
- Update tests referencing removed `ui` state (`activeTab`/`setTab`); social, domain,
  engine, server and pure-logic tests stay untouched.
- Visual pass: screenshot review of every screen at 390px and desktop widths (Playwright
  browsers cached locally), plus a manual pass as the dummy user across all five tabs.
- Gate unchanged: `npm run check && npm run lint && npm test && npm run build`.

## 8. Rollout (Phase A, app stays runnable throughout)

1. Spec + implementation plan committed before code moves.
2. Token layer (`app.css`), Inter, DaisyUI removal.
3. Primitives + component tests.
4. Test setup (`testing-library` + `happy-dom`).
5. Routing skeleton + `+layout.svelte` shell, `/` redirect, `+error.svelte`.
6. `/map` + `/ride` reskin (tokens/type only, no behaviour change).
7. `/me`, `/me/rides`, `/me/friends`.
8. `/activity` (split from `FriendsView`).
9. `/explore` + Routes/Crews/Events segments.
10. Detail routes `/crew/[id]`, `/route/[id]`, `/event/[id]`.
11. `/home` on the existing feed API.
12. Delete legacy panel/tab machinery + dead state; update affected tests.
13. Service worker route coverage.
14. Visual review + full gate + manual pass.
