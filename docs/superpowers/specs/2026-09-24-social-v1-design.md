# Gradient Social v1 — Combined Design (onboarding + channels + events + circuits + feed)

**Date:** 2026-09-24
**Status:** approved sections, pending final review
**Scope:** single combined v1, both feed phases included, ordered Phase 1 → Phase 2
**Visuals:** `.superpowers/brainstorm/142821-1790226293/content/` (`onboarding`, `onboarding-v2`, `onboarding-v3`, `channels`, `events`, `circuits`, `feed`)

## 1. Goal

Turn the offline-first route planner into a free, community-powered network without rewriting it:
rich onboarding captures profile + home + device once; channels host events and public routes;
home circuits are one tap; feed + kudos/comments make it feel alive. Utility case (“best route to
school by popularity”) works alongside sport discovery. Hardware (boards/watches) stays door-open only.

Non-goals: live BLE, GPX/TCX import, clubs migration UI, ML recommendations, monetization, admin console.

## 2. Locked decisions

- Visibility: public + friends. Public route/event preview for growth; live positions friends-only forever.
- Sports: multi-sport now. Every route/channel/event carries `sport` (`eskate|ebike|scooter|euc|push|bike|kick`).
- Recommendation: popularity × fit. `log(rides+saves)` + recency, then per-viewer engine fit.
- Hardware: no ingestion in v1. Nullable `source/device_kind/external_id/telemetry` columns only.
- Onboarding: Option A 3-step wizard (You → Ride → Home), v3 automation. Full profile now.
- Channels: mixed — anyone creates, `open` (one-tap join) + `private` (approval/invite link).
- Events: members + link. Public preview (title/time/meetup + blurred route); full route + RSVP list for members/link-holders.
- Circuits: distance + fit loop from home pin.
- Feed: both phases, ordered — Phase 1 (RSVP + kudos + saves) ships first, Phase 2 (comments + notifications) behind stable Phase 1 in the same v1.

## 3. What exists today (do not regress)

- `app/src/lib/components/OnboardingModal.svelte` (gated by `!domain.onboardSeen`, `completeOnboarding`),
  `ModePicker.svelte` (electric/human groups from `MODES`), `state/domain.svelte.ts` (`modeId`, `boardVal`
  `cap|climb|brake`, `BOARD_RANGES`), `storage.ts` (`TRANSPORT_KEY`, `BOARD_KEY`, `TRIPS_MAX 15`).
- Server: `prefs(user_id, transport_mode, board, theme, legal_dismissed, known_location JSONB)` via
  `routes/api/prefs/+server.ts` (device-cookie `requireUser`, unused by client); `profiles` +
  `routes/api/profile/+server.ts` (`display_name` 1–40, Google `requireAuth`).
- Social: Google OAuth + device rows, `friendships(pending/accepted)` + `is_friend()` RLS,
  `shared_trips visibility='friends'`, `live_positions` 1 row/user + SSE `/api/live/friends` (5s publish).
  Client: `social.svelte.ts`, `live.ts`, `sync.ts` (trips+presets only).
- Engine: `src/lib/engine/` (`transport-modes`, `segWh`, gradient bands, verdict, elevation smooth).
  Multi-mode already; client mirror `engine/transport-modes/index.ts`, server seeds `001_reference_data.sql`.
- Geo: Photon `autocompleteSearch` (country bias), `reverseGeocode`, geolocation locate flow,
  `detectCountry`, `mapCenter` bias. Reuse all for home capture.
- No channels/events/clubs UI or API. Empty reserved tables `crews/crew_members/group_rides/challenges`
  in `20240910000001` — supersede with new `channels/*` model (do not retrofit UI onto them).
- Tabs today: `plan|saved|ride|friends` (`TabBar.svelte`, `state/ui.svelte.ts`).

## 4. UX design

### 4.1 Onboarding (A v3, cleaner + automated)

Three screens, one primary action each, progress `● ○ ○`, skip top-right always:
1. **You** — avatar auto from Google when signed in (editable), display name pre-filled (editable),
   sports chips multi-select (suggested from first route/mode, tap to fix).
2. **Ride** — existing `ModePicker` + board list; `cap|climb|brake` quiet steppers with mode defaults.
   Selection persists to `domain.selectMode/selectBoard`; never asked again (planner reads defaults).
3. **Home** — Photon autocomplete input (country-aware) + **Use my location** one-tap (geolocation →
   pin + `reverseGeocode` label, draggable to adjust). Units (km) + use (`school/commute`) chips.
   Ends with **Create my circuit →** jumping to planner with home pre-set.
Every pre-fill editable; skip allowed (defaults: `eskate`, most popular board, no home → circuits hidden
until set).

### 4.2 Channels (mixed)

Discover list with search (`Sea Point`, `school`, `night ride`): rows show name, visibility badge,
member count, route count, Join/Request button + **Create channel**. Channel page tabs:
Routes | Events | Members. Open channels: one-tap join, content readable signed-out. Private:
request → owner approves, or invite link (revocable). New `Channels` tab next to Friends.

### 4.3 Events (members + link)

Event has channel, title, start time, meetup point, attached route, capacity (optional).
Public preview: title/time/meetup + blurred route + attendee count + fit-for-you badge.
Member/link view: full route + elevation + verdict for viewer board, attendee avatars, RSVP
(Going/Interested/Can’t go), Share-link button, post-ride kudos. Live peers during the ride reuse
friends-only SSE; nothing public.

### 4.4 Home circuits (distance + fit)

Planner gets **Loop from home**: home pin (exact private) + board remembered → distance chips
5/8/12 km → generated loop scored by viewer engine (`climb vs climbLimit`, `brake vs brakeLimit`,
`Wh vs usable`). Public copies start ~200m from exact home. **Save → Publish to channel** feeds the
public-routes pool.

### 4.5 Feed + route detail (both phases)

Home feed cards: activity (X rode Y · kudos button), shared route (rating, rides, fit badge, Save),
event (time, going count, RSVP). Route detail: rating, rides/saves counts, top local note,
fit-for-viewer verdict, **Use route →** (clones to planner, re-scores). Phase 1: RSVP + kudos + saves.
Phase 2: comments threads + notifications (SSE + badge). Report affordance on every card from Phase 1.

## 5. Data model (additive migrations, RLS mirrors `is_friend` pattern)

- Extend `profiles`: `sports text[]`, `home_lat/home_lon double` (exact, owner-only), `home_label text`,
  `units text ('km')`, `primary_use text`, `avatar_url` (already). Extend `prefs`: `sports`, `units`,
  `primary_use` for anonymous users; client starts pushing `prefs/profile` in `sync.ts` (currently trips+presets only).
- `public_routes(id uuid pk, author uuid, title, sport, line jsonb, pts jsonb, elev jsonb, stats jsonb,
  geom_hash text, home_offset boolean default true, source text, device_kind text null, external_id text null,
  telemetry jsonb null, created_at)`. Public SELECT; INSERT owner; UPDATE/DELETE owner. Dedupe on
  `(geom_hash, sport)` — `geom_hash` is a stable hash of the simplified polyline rounded to 5 decimals;
  re-ride bumps counters, no new row. Public geometry always starts ~200m from exact home
  (test asserts ≥150m to allow rounding tolerance).
- `route_stats(route_id pk, rides int default 0, saves int default 0, kudos int default 0, rating numeric,
  score numeric)` maintained by triggers from join tables (cheap on free tier, no fan-out).
- `route_saves(route_id, user_id, created_at, pk)`, `route_rides(route_id, user_id, trip_id, created_at)`,
  `route_kudos(route_id, user_id, created_at)` with unique `(route,user)` guards.
- `channels(id, name citext unique-ish, visibility 'open|private', sport, home_area text, created_by, created_at)`;
  `channel_members(channel_id, user_id, role 'owner|mod|member', status 'active|pending', pk)`.
  RLS: open channels + their public routes/events SELECT public; private SELECT members only.
- `events(id, channel_id fk, title, start_at, meetup_lat/lon, route_id nullable fk, capacity nullable,
  invite_token text unique, created_by, created_at)`; `event_rsvps(event_id, user_id, status, pk)`.
  Preview columns SELECT public; full route + attendees SELECT members or valid `invite_token`.
- Phase 2: `comments(id, target_type 'route|event', target_id, user_id, body 1–500, created_at)` +
  `notifications(id, user_id, kind, ref, read boolean)`; rate-limit inserts, report/hide same as routes.
- `reports(id, target_type, target_id, reporter, reason, created_at)`; threshold trigger sets
  `hidden=true` on target pending owner/mod review. Owner/mod delete always allowed.

## 6. APIs (follow `friends/+server.ts`, `live/friends/+server.ts` patterns)

- `GET/PUT /api/profile` — extended fields, same validation style (lengths, enums, lat/lon ranges).
- `GET/PUT /api/prefs` — accept `sports/units/primary_use/known_location`; keep device-cookie scope.
- `GET /api/channels?q=&sport=` · `POST /api/channels` · `POST /api/channels/:id/join|request|approve|invite|revoke`.
- `GET /api/channels/:id/routes|events|members`.
- `POST /api/routes/publish {trip_ts | line, title, sport, channel_id?}` → dedupe + `route_stats` row.
- `GET /api/routes/explore?lat&lon&sport&query` → `score` order + viewer `fit` computed server-side via engine port.
- `POST /api/routes/:id/{save|ride|kudos}` (idempotent), `POST /api/routes/:id/report`.
- `POST /api/events` · `POST /api/events/:id/rsvp` · `GET /api/events/:id?invite=` (preview vs full).
- Phase 2: `GET/POST /api/{routes|events}/:id/comments`, `GET /api/notifications`, SSE badge reuse `live/` pattern.
Auth: public reads anonymous; writes `requireAuth` (Google) except prefs (device-cookie). Anonymous
onboarding stores locally, links up on login (existing `users.google_id` link-up).

## 7. Client state + files

- Extend `state/domain.svelte.ts` (profile/home/sports/units), `storage.ts` (new keys, same best-effort
  try/catch), `planner.svelte.ts:initCloudBackup` (hydrate prefs/profile), `sync.ts` (push them).
- New `lib/channels.svelte.ts` (copy `social.svelte.ts` rune pattern), `lib/feed.svelte.ts`,
  `lib/circuits.ts` (distance+fit builder calling engine).
- New `components/OnboardingWizard.svelte` (extends `OnboardingModal`, steps You/Ride/Home),
  `ChannelsView`, `ChannelDetail`, `EventsView`, `EventDetail`, `ExploreView`, `RouteDetail`,
  `HomeCircuitBar`; extend `TabBar` + `ui.svelte.ts` tab union (`plan|saved|ride|channels|friends`),
  wire in `routes/+page.svelte`.
- Offline: localStorage stays truth for drafts/onboarding; feed caches last snapshot; kudos/RSVP queue
  and flush on reconnect (same best-effort style as `scheduleBackup`).

## 8. Scoring, privacy, moderation, errors

- Score: `score = ln(1+rides+saves*2+kudos) − age_days/30`; list order by `score`, badge by viewer `fit`
  (Over limit / Tight / Easy + Wh%). Reuse `segWh`, bands, verdict — no new physics.
- Privacy: exact home owner-only (never in public payloads); public route/event geometry starts ~200m
  away; live positions friends-only; invite links random + revocable; school/private channels unlisted.
- Moderation: report → count threshold auto-hide + owner/mod restore/delete; rate limits on publish,
  comments, joins; display-name + title profanity length caps (no ML filter in v1).
- Errors: geolocation denied → manual pin; Photon empty → keep typed label + coords; offline →
  queue + “will send” hint (existing `trackMsg` pattern); publish conflict (same geom_hash) → return
  existing route (idempotent).

## 9. Testing

- Vitest (`src/**/*.test.ts`, node env): geom-hash dedupe, score ordering + recency decay, fit-badge
  thresholds, home-offset (public start ≥150m from exact), invite-token gate (preview vs full),
  idempotent save/ride/kudos, report auto-hide threshold, circuit builder uses remembered board.
- `svelte-check`, `eslint`, `prettier --check`; CI order `check → lint → test → build` (Node 22).
- DB: `scripts/verify-db.sh` extended for new tables/policies; seeds for modes/boards untouched.

## 10. Rollout (single v1, ordered)

1. Profile/prefs extension + wizard (anonymous-safe) 2. Channels mixed + discover 3. Publish + Explore +
   stats triggers 4. Events members+link + RSVP 5. Circuits distance+fit 6. Phase 1 feed (kudos/saves)
   7. Phase 2 comments/notifications (flagged, same v1). Each slice independently testable; no slice
   rewrites trips/friendships/live.
