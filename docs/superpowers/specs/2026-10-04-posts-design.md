# GradientRip Posts (Phase B) — Design (composer + media pipeline + post feed)

**Date:** 2026-10-04
**Status:** approved substance (chat answers 2026-10-04); pending file review
**Scope:** Phase B of the social-media rebuild. Phase A (shell) is merged-complete on
`feat/social-v1`. Later phases: C crews, D safety reports, E live ride posts.
**Basis:** brainstorming answers — self-hosted S3 API (MinIO), server transcode pipeline,
full posts (text + ≤4 photos + 1 video + 1 attached ride) with public/friends audiences.

## 1. Goal

Give riders a Twitter-shaped voice: write text, attach ride photos/video and the ride
itself, publish to everyone or friends-only, and talk back with threaded comments and
kudos. Phase A's `FeedItem` shell and `/home` list gain real post bodies; the Comment
button omitted in Phase A becomes functional.

Non-goals: post editing (delete + repost), drafts, reposts/quote-posts, hashtag/mention
parsing (plain text), push notifications, crew-targeted posts (Phase C), HLS/more than 2
renditions, live (Phase E), re-transcode UI beyond job retry.

## 2. Locked decisions

- **Media:** MinIO via the S3 API (`@aws-sdk/client-s3` + presigner), added to the root
  `docker-compose.yml` alongside a `worker` service. Endpoint swappable to R2/S3 later by
  changing one variable. No public bucket: uploads via presigned PUT, serving via
  server-minted presigned GETs (1h) embedded in feed/detail responses, so friends-only
  media is never URL-public.
- **Video:** server transcode, minimal shape — single `npm run worker` process (tsx),
  Postgres-backed jobs table (`FOR UPDATE SKIP LOCKED`), system ffmpeg. Outputs: 720p +
  480p progressive MP4 + poster JPG. Original kept (cheap locally, allows re-transcode).
  No Redis, no queue service, no HLS.
- **Post model:** text (1–500 chars, optional iff media or ride attached) + ≤4 photos +
  ≤1 video + ≤1 attached ride; visibility `public` | `friends` (mirrors the app-wide
  rule; RLS mirrors the `is_friend` pattern).
- **Caps (server-enforced):** photo ≤10MB each, video ≤200MB and ≤60s, posts ≤30/day,
  upload-URL mints ≤100/day. Client pre-compresses photos (max 1600px, JPEG ~0.82) and
  probes video duration before upload; server re-validates by HEADing every key at
  post-create (missing/mismatch/oversize → 400, strays deleted).
- **Attachment rule:** own trips only (`trips.user_id = me`) plus visible public routes.
  The attachment card (stats + line) is visible to the post's audience; opening the full
  trip still requires its existing visibility. Attaching creates NO new trip visibility.
- **Composer:** full `/compose` route (form wants a screen, not a sheet): text + counter,
  photo picker with previews + remove, video picker with duration check, attach-ride
  picker (my recent trips via `GET /api/trips` + public routes via explore), visibility
  segmented control, Post button with upload progress. Offline → composer disabled with
  honest copy (uploads need connection). No draft persistence in v1.
- **Failure posture:** failed transcode jobs (max 3 attempts) surface a retry button on
  the post for the author (requeues); processing posts show a processing card to the
  author only.

## 3. What exists today (do not regress)

`/home` + `FeedItem` header/body/actions shell (actions currently kudos + share + RSVP
for events; Comment omitted pending this phase); `/post/[id]` reserved (no page yet);
comments GET/POST with threading (`parent_id`), 500-char limit, rate window, and owner
notifications via `findOwner` (handles `route`/`event` only); kudos pattern
(`route_kudos` + trigger-bumped count); reports (`KINDS = ['route','event']`, reporter-
unique, hiding support); feed API (`route`/`event` kinds, auth-required);
`resolveUserId` identity model (all writes land on the Google identity).

## 4. UX design

- **`/compose`:** header (Cancel / Post), audience segmented control (Everyone/Friends),
  text area with 500-char counter, photo strip (≤4 thumbnails, tap × to remove),
  video row (thumbnail + duration + transcode note), attach-ride row (opens picker:
  two sections — My recent trips, Public routes — radio-select one, clearable),
  progress state on Post (upload % → Creating → done → `goto('/home')`).
  Validation messages inline per field; Post disabled until ≥1 of text/photo/video/ride.
- **Post card (FeedItem body):** author header (existing shell), text (clamped 6 lines +
  More), photo grid (1 large / 2×2), video player (480p default, 720p toggle, poster
  until data), attached ride card (mini stats + line + Open → route/trip), processing
  card (author only: spinner + status + retry on failure). Actions row: kudos (count,
  optimistic + rollback, mirrors route pattern), Comment (count → `/post/[id]`),
  Share (existing `navigator.share` + clipboard pattern).
- **`/post/[id]`:** full post, kudos/share row, threaded comments (existing style:
  indent replies, 200 cap), reply composer (500-char, rate-limit copy reused), delete
  affordance for the author's own post (confirm via native confirm — matches existing
  minimalism; no custom modal in v1).
- **Empty/error states:** feed with no posts → existing `EmptyState` + composer CTA;
  processing/failed copy truthful (`Processing video…`, `Video failed — Retry`).

## 5. Data model (additive migration `20261004000001_posts`, up + down)

- `posts (id UUID PK, author UUID→users, body TEXT, visibility 'public'|'friends',
  ride_kind NULL|'trip'|'route', ride_id UUID NULL, status 'live'|'processing'|'failed',
  kudos INT default 0, created_at, updated_at)`; index `(visibility, created_at DESC)`.
- `post_media (id UUID PK, post_id→posts CASCADE, kind 'photo'|'video'|'poster',
  s3_key TEXT, width/height INT NULL, duration_s REAL NULL, bytes INT, sort INT)`.
- `post_kudos (post_id, user_id, PRIMARY KEY (post_id, user_id))` + trigger bumping
  `posts.kudos` (mirror `trg_route_kudos_bump` exactly).
- `transcode_jobs (id UUID PK, post_id→posts CASCADE, media_id→post_media CASCADE,
  status 'queued'|'processing'|'done'|'failed', attempts INT default 0,
  last_error TEXT NULL, created_at, updated_at)`; index on `(status, created_at)`.
- Extend: comments `findOwner` + `KINDS` gain `'post'` (owner = author iff post visible
  to commenter, else 404 — mirrors event visibility branch); reports `KINDS` gains
  `'post'` as store-only in Phase B (accepted + stored, reporter-unique, NO
  hide-threshold — hide-threshold enforcement is Phase D (moderation) scope).
- RLS: posts readable iff `visibility='public'` OR `author = current_user_id()` OR
  (`visibility='friends'` AND `is_friend(author)`); write/delete owner-only. Media/kudos
  ride the post's visibility via joins (no independent RLS).

## 6. APIs (follow `friends/+server.ts`, `events/[id]/+server.ts` patterns)

- `POST /api/media/upload-urls { files: [{ kind: 'photo'|'video', contentType, bytes }] }`
  → presigned PUTs with UUID keys + expiry (rate-limited; validates kind/size caps).
- `POST /api/posts { body?, media: [{ key, kind }], ride?: { kind: 'trip'|'route', id }, visibility }`
  → HEAD-validates every key, checks trip ownership / route visibility, inserts post +
  media rows, enqueues video job if present, returns post (status `processing` when a
  video job is queued). ≥1 content part required; else 400.
- `GET /api/posts/[id]` → single post with author, media (presigned GETs), ride card
  data, kudos + `kudosed`, comments count; visibility-filtered (404 otherwise).
- `POST /api/posts/[id]/kudos` → idempotent kudos (mirror route kudos handler).
- `DELETE /api/posts/[id]` → owner only; cascades rows, deletes MinIO objects,
  cancels pending jobs.
- `POST /api/posts/[id]/retry` → author only; requeues failed video job (attempts reset
  capped: refuse after 3rd failure with 422 + honest copy).
- `GET /api/feed` gains `kind: 'post'` entries (author + excerpt + kudos + status;
  `processing`/`failed` visible to author only), still `created_at DESC`.
- Comments/reports: accept `kind: 'post'` with the §5 rules; no shape changes.

## 7. Worker (`app/src/worker/transcode.ts`, `npm run worker` via tsx)

Loop: `SELECT … FOR UPDATE SKIP LOCKED` one `queued` job (oldest first) →
`processing` → ffprobe duration check first (over 60s → `failed` with honest
`last_error`, no transcode attempted) → ffmpeg (`-i original -map 0:v -map 0:a?` → 720p + 480p libx264 +
poster `-ss 1 -vframes 1`) → PUT outputs to MinIO → update `post_media` rows +
`posts.status='live'` → `done`. Any failure: `attempts++`, `last_error`, back to
`queued` (<3) else `failed` (+ `posts.status='failed'`). Graceful SIGTERM (finish job,
release row). Concurrency 1. Structured log lines (job id, stage, seconds).
Dockerfile: worker target adds `ffmpeg` via apk on the same image; compose runs
`npm run worker`. Dev: `npm run worker` locally against dummy MinIO + dummy DB.

## 8. Client state + files

- `app/src/lib/posts.svelte.ts` (new, mirrors `social.svelte.ts` patterns): post CRUD,
  kudos optimistic + rollback, comments thread state reusing `feed.svelte.ts` shapes
  where possible (no duplicate cache implementations — extend, don't fork).
- `app/src/routes/(tabs)/compose/+page.svelte` + `AttachRidePicker.svelte`
  (new route; tab bar hidden via `noTabs` — composing wants full screen; entry point:
  Home header action + feed empty-state CTA).
- `app/src/routes/post/[id]/+page.svelte` (the reserved route, now built) + thread UI.
- `/home` body renders `PostCard.svelte` (new) inside the untouched `FeedItem` shell;
  Comment button returns (→ post detail).
- Photo compression util `app/src/lib/media.ts` (canvas resize, EXIF-orientation-safe
  via `createImageBitmap`, JPEG 0.82) with unit tests (pure dimension math tested;
  browser encode path covered by type-check + manual pass).

## 9. Scoring, privacy, moderation, errors

- Friends-only posts: enforced in SQL (RLS) AND in presigned-URL minting (server only
  mints media GETs for posts the caller can see — checked in the same query).
- Author-deleted posts: media GETs stop minting immediately (rows gone); existing URLs
  expire within the hour.
- Reports on posts are store-only in Phase B (accepted + stored, no auto-hide);
  hide-threshold enforcement is Phase D (moderation) scope.
- Upload abuse: per-day caps (§2) + key namespacing per user (`<userId>/<uuid>`) so
  users can never address each other's keys; post-create HEAD check rejects foreign keys.
- Errors: 400 validation shapes mirror existing handlers; 413 on oversize (before
  upload via client probe, after via HEAD); 429 copies reuse the comments tone
  (`Slow down — …`); transcode failure never loses the post (text + photos stay live,
  video slot shows retry).

## 10. Testing

- Migration `up/down/up` on dummy Postgres (prove reversibility like social-v1).
- Unit: `stripParams`-style pure helpers (acceptance rules, cap validation, attachment
  eligibility), `media.ts` dimension math, `nav.test.ts`-style route cases for
  `/compose` + `/post/[id]` (tab-bar hidden, back links).
- Component tests (happy-dom): composer validation states, PostCard slots, thread
  rendering, processing/failed cards.
- Browser as dummy users: compose text+photo+ride → appears in friends' feed, not in
  strangers'; friends-only post invisible to non-friend + media URL without post
  visibility 404s/denied; video post shows processing → live after worker run; kudos
  idempotent; comment thread + reply + notification; report hides at threshold; delete
  removes rows + objects.
- Gates unchanged: `npm run check && npm run lint && npm test && npm run build`.

## 11. Rollout (Phase B, app stays runnable throughout)

1. Migration (posts/media/kudos/jobs + comments/reports kind extension) with down.
2. S3 plumbing (`@aws-sdk/client-s3` + presigner, server `media.ts`, upload-URL endpoint,
   MinIO + worker compose entries, Dockerfile worker target) — no UI yet.
3. Worker (transcode loop, retry semantics, SIGTERM) runnable against dummy MinIO.
4. Posts API (CRUD + kudos + retry + feed kind) with browser-proven visibility matrix.
5. Composer (`/compose`, picker, progress, caps, offline-disabled).
6. Feed/home post bodies + `/post/[id]` + comments UI + reports on posts.
7. Full gate + visual pass + dummy-DB hygiene.
