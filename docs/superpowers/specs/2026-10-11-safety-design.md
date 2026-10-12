# GradientRip Safety (Phase D) — Design (hazard reports + moderation enforcement)

**Date:** 2026-10-11
**Status:** design approved in chat (2026-10-11); pending file review
**Scope:** Phase D of the social-media rebuild, in two slices: D1 hazards, D2
moderation — each shippable, spec→plan→execute in order. Phases A–C merged to main.
Later phase: E live ride posts.
**Basis:** user answers — route + optional pin, expiry + confirm-to-renew, thresholds +
authors + crew admins; Jev/brain consulted on process, design calls are the user's.

## 1. Goal

Keep riders safe and the corpus clean: structured hazard reports on routes (pothole
here, unsafe area, closure — with expiry and crowd renewal) surfaced on route cards,
route maps, and in the planner; plus moderation with teeth (distinct-reporter hide
thresholds, author visibility, crew-admin review). No new moderator role, no queues.

Non-goals: severity scales, standalone map pins (hazards always attach to a route),
push notifications, appeals beyond edit/delete/dismiss, ML triage.

## 2. Locked decisions

- **Hazards live apart from abuse reports.** Dedicated `hazards` table (first-class
  content with its own lifecycle); `reports` stays abuse-only. No shared queries.
- **Location:** route + optional pin. Pin validated server-side (≤2 km from the route
  line, else 400) — stops map spam. Pins render on the route detail map (Leaflet
  markers, friend-pins pattern) and warn in the planner (~200 m corridor check in JS
  with existing haversine).
- **Freshness:** reporter picks 7/30-day expiry (default 30); any rider confirms
  ("still there") → extends +7d up to created+90d cap; one confirmation per rider
  (`UNIQUE(reporter, hazard_id)`); reporter or route author resolves anytime.
- **Kind set (closed, TS const + CHECK):** `pothole|unsafe|closure|police|surface|other`.
  No severity — kind + note (≤280) + confirmations carry the signal.
- **Reach:** anonymous read access for public-route hazards (safety over walls; signed-in
  required to report/confirm).
- **Moderation:** N = 3 distinct reporters hides content (tunable const); extend the
  route-hide trigger pattern to posts (`posts.hidden` + trigger) and events; authors
  always see reports on their content; crew admins dismiss reports on crew-targeted
  posts (+ remove the post); remedy is edit/delete/dismiss.

## 3. What exists today (do not regress)

`reports` (route/event/post kinds, free-text reason, reporter-UNIQUE, route auto-hide
trigger); route detail + cards; explore rows; planner with route scoring; friends/posts
visibility matrix; crew roles + admin endpoints; `FeedItem`/composer/home/feed;
`is_friend`/`is_crew_member` RLS idioms; closed-set rule (AGENTS.md) with
`check-closed-sets.sh` enforcement.

## 4. Data model (additive migration, up + down)

- `hazards (id UUID PK, route_id UUID → public_routes CASCADE, reporter UUID →
  users CASCADE, kind TEXT CHECK, lat/lon DOUBLE NULL, note TEXT ≤280,
  expires_at TIMESTAMPTZ, confirmations INT default 0, created_at)`; index
  `(route_id, expires_at)`; exactly-one rule is soft (pin NULL = route-wide, no CHECK
  needed beyond nullable columns).
- `hazard_confirmations (hazard_id → hazards CASCADE, reporter → users CASCADE,
  PRIMARY KEY (hazard_id, reporter))`.
- `posts.hidden BOOLEAN default false` + hide trigger mirroring
  `hide_route_on_reports` (count distinct reporters ≥ 3 → set hidden; un-hide only
  via author edit? No — hidden stays until crew-admin dismiss or author delete;
  document the terminal states).
- Events: enable the anticipated hiding the reports comment references (same
  threshold, same shape as routes).

## 5. APIs (mirror existing patterns)

- `POST /api/routes/[id]/hazards {kind, lat?, lon?, note?, expires_days: 7|30}`
  (signed-in; pin-proximity ≤2 km check in SQL/JS with existing haversine; 400s mirror
  post-create copy).
- `POST /api/hazards/[id]/confirm` (signed-in; UNIQUE-guarded; extends expiry per §2).
- `POST /api/hazards/[id]/resolve` (reporter or route author only; immediate vanish).
- `GET` bundled: route detail gains `hazards[]` (open only: `expires_at > now()` +
  unresolved); explore rows gain `hazard_count` (+ worst kind for the badge, ranked
  `closure > unsafe > police > pothole > surface > other`).
- Moderation: threshold triggers (posts/events, mirroring routes); `GET` report
  visibility for authors (counts + reasons, author-only); crew-admin dismiss endpoint
  (`POST …/dismiss` resetting the counter with audit note — new `report_dismissals`
  log or a `dismissed_at/by` on the hidden flag? Choose log table: `moderation_log
  (id, target_kind, target_id, actor, action, created_at)` — auditability beats
  cleverness).

## 6. UX design

- **Report flow (route detail + cards):** "Report hazard" opens kind picker (6 closed
  options with icons) → optional pin drop on the route map (defaults to route-wide) →
  optional note → expiry picker (7/30, default 30) → submit. Inline validation, honest
  errors, 44px targets, type floors.
- **Hazard display:** badge on route cards (`⚠ 2` + worst kind), pins on detail map
  (tap → kind/note/confirms/age + Still-there + Resolve-if-mine buttons), planner
  warning strip when the scored line passes a pin corridor ("Pothole reported near
  km 3 — 12 riders confirm").
- **Moderation UI:** author view of reports on own content (reason list + fix/delete
  CTAs); crew-admin dismiss affordance on reported crew posts; hidden content shows
  the author an honest "hidden after N reports" state (never a silent vanish).
- **Anonymous:** hazard badges/pins/notes readable on public routes without sign-in.

## 7. Testing

- Migration reversibility + row parity on seed.
- Pin-proximity rejection (>2 km → 400); cap validation; expiry default/7/30;
  confirm extends + cap math; UNIQUE double-confirm refused; resolve by
  non-reporter-non-author refused (403); expired vanish from reads but rows remain.
- Threshold: 3 distinct reporters hides (same user twice counts once — UNIQUE);
  author sees reports, stranger 403s; crew-admin dismiss resets + audit row;
  events parity with routes.
- Browser as dummies + anonymous: full report→pin→confirm→resolve lifecycle; planner
  warning appears only inside corridor; hidden-post author state; crew-admin flow.
- Gates unchanged: `npm run check && npm run lint && npm test && npm run build`
  (lint includes `check-closed-sets.sh` — new kind literals ship with TS consts).

## 8. Rollout (app stays runnable throughout)

1. D1 migration (hazards + confirmations + posts.hidden + event hiding).
2. D1 hazard APIs (report/confirm/resolve + detail/explore bundling).
3. D1 surfacing (badges, pins, planner warning, anonymous reads).
4. D2 moderation (thresholds posts/events, author visibility, crew-admin dismiss +
   moderation_log).
5. Full gate + visual pass (screenshots eyeballed by controller) + dummy-DB hygiene.
