# GradientRip Crews (Phase C) — Design (community surfaces + crew-targeted posts)

**Date:** 2026-10-07
**Status:** design approved in chat (2026-10-07); pending file review
**Scope:** Phase C of the social-media rebuild. Phases A (shell) and B (posts) are
merged to main. Later phases: D safety reports, E live ride posts.
**Basis:** brainstorming answers — crew-targeted posts, invite-link entry, full
transferable admin, all-at-once release. Jev-validated: S3 avatars (0.98),
immediate access loss on removal (0.86). Brain memory:
`~/.local/state/brain/gradientRip.json`.

## 1. Goal

Turn crews from directory rows (name + count + join button) into real community
surfaces: full profiles, member rosters with admin management, invite-link entry for
private crews, and crew-targeted posts — a members-only shared space that makes a
private crew a community instead of a list.

Non-goals: crew-profile reporting (Phase D moderation scope); reposts/quote-posts;
push notifications; live (Phase E); HLS/new renditions; post editing.

## 2. Locked decisions

- **Feed model:** crew-targeted posts — a third post audience (`visibility='crew'`,
  members-only), not a member-posts filter.
- **Entry:** invite links for private crews (mirror the events invite pattern:
  member-minted token URL, instant join, rotatable/revocable). Open crews keep one-tap
  join. No approval queues.
- **Admin:** full and transferable — edit profile, remove/promote/demote members,
  revoke invites, delete crew. Creator starts as admin; demoting the final admin is
  refused (422). Uses the `role` column that has sat unused since social-v1.
- **Avatars:** uploaded through the proven presigned S3 photo flow (same caps and
  validation as post photos) — Jev 0.98 over identicons/generic.
- **Removal:** immediate access loss, no former-member state — Jev 0.86, consistent
  with unfriend/share-off/revoke everywhere else.
- **Release:** all-at-once (profiles + roster + invites + targeted posts + composer
  targeting + feed), not split.

## 3. What exists today (do not regress)

`/crew/[id]` detail card (name, visibility, member count, sport, area, join states);
`/explore/crews` list + create; `channels` table (`name`, `visibility`, `sport`,
`home_area`, `created_by`) + `channel_members` (`role`, `status`, CASCADE both);
`POST …/join` (open only, idempotent); events invite-token pattern
(`gen_random_bytes`, rotate endpoint, `?invite=` auto-join); posts with
`public|friends` visibility + `resolveUserId` identity; `FeedItem` shell; composer
(Everyone/Friends); `is_friend(UUID)` RLS idiom; comments `findOwner` with
route/event/post branches; reports store-only for posts (threshold parked to Phase D).

## 4. Data model (additive migration, up + down)

- `channels`: + `about TEXT CHECK (char_length ≤ 500)`, `avatar_key TEXT NULL`,
  `invite_token TEXT NULL` (NULL = no active link).
- `channel_members.role`: `CHECK (role IN ('admin','member'))` (normalize any other
  stored values to `'member'` first, then add the constraint).
- `posts`: `visibility` gains `'crew'` + `crew_id UUID NULL → channels ON DELETE
  CASCADE`, with exactly-one CHECK (`crew` ⟺ `crew_id NOT NULL`).
- New helper `is_crew_member(UUID)` mirroring `is_friend` (active membership row).
- Posts RLS read += `OR (visibility='crew' AND is_crew_member(crew_id))`; writes stay
  author-only. Comments `findOwner` post branch and media-GET minting inherit the same
  expression — no parallel logic.

## 5. APIs (mirror existing patterns)

- `PATCH` / `DELETE /api/channels/[id]` (admin only; delete cascades members + crew posts).
- `POST /api/channels` gains optional `about`/`avatar_key` (avatar via existing
  upload-urls endpoint — photo kind — no new upload path).
- `GET /api/channels/[id]/members` (open: any signed-in user; private: members only)
  with display_name/avatar/role/joined; `PATCH …/members` (admin:
  promote/demote/remove + last-admin 422).
- `POST` / `DELETE /api/channels/[id]/invite` (any member mints/rotates/revokes;
  token `encode(gen_random_bytes(12),'hex')`, exactly like events).
- `POST …/join` extended with optional `{invite}` (private + valid token joins).
- `GET /api/channels/[id]/feed` (cursor-paged crew posts; private = members only).
- Posts create/feed/detail accept `visibility:'crew'` + `crew_id` (caller must be an
  active member, else 403). Kudos/comments need no changes beyond the visibility
  expression.

## 6. UX design

- **`/crew/[id]` profile:** avatar header (initial fallback), name, visibility badge,
  stats, About; `SegmentedControl` Posts | Events | Routes | Members (same language
  as Explore). Posts tab: crew-targeted `FeedItem` cards + "Post to crew" entry.
  Members tab: roster rows (avatar, name, role badge, joined) + admin controls +
  self-leave. Admins: edit-profile form, invite row (link + copy + rotate + revoke),
  confirm-to-delete danger zone.
- **Join states:** open → Join button; private → invite-link paste field + `?invite=`
  auto-join (mirrors events exactly).
- **Composer:** audience Everyone / Friends / **Crew** (Crew reveals my-crews picker;
  `crew_id` submitted). Full-screen (`noTabs`) like today.
- **Home:** crew posts visible to members with an "in CrewName" chip linking to the
  crew. Membership is the subscription — no follow model.

## 7. Testing

- Migration reversibility (up/down/up on dummy Postgres).
- Visibility matrix extended: member sees, stranger 404s (page + media URLs absent
  from JSON), removed ex-member loses access immediately (remove → re-request as
  ex-member → 404), last-admin demotion refused, invite rotation invalidates old
  links, revoked link 403s.
- Browser as dummy users: profile render + edit, roster + promote/demote/remove/leave,
  invite mint/copy/rotate/revoke/join-via-link, compose-to-crew, crew feed tab,
  home crew chip, admin delete cascade.
- Gates unchanged: `npm run check && npm run lint && npm test && npm run build`.

## 8. Rollout (app stays runnable throughout)

1. Migration (channel columns, role CHECK, posts crew audience + helper + RLS).
2. Members + invites APIs (roster, admin actions, token lifecycle, join-via-invite).
3. Posts visibility extension (create/feed/detail/comments/media-minting, matrix proof).
4. Composer targeting + home crew chip.
5. Crew profile UI (header, tabs, roster, admin, invites, join states).
6. Full gate + visual pass (screenshots eyeballed by controller) + dummy-DB hygiene.
