// Closed string sets — the TypeScript half of AGENTS.md §1.
//
// Every DB CHECK (… IN (…)) in db/migrations/*.up.sql mirrors exactly one
// exported `as const` array here, added in the same commit as the CHECK.
// `scripts/check-closed-sets.sh` enforces the pairing (literal-level:
// each CHECK literal appears in src AND is covered here, unless waived
// in the script).
//
// Local request-validation consts elsewhere (FEED_KINDS in feed.svelte.ts,
// STATUSES/KINDS in API routes) stay as-is; this file is the canonical
// DB mirror, adoption at usage sites is incremental.

// transport_modes."group" (20240910000000_initial_schema)
export const TRANSPORT_MODE_GROUPS = ['electric', 'human'] as const;
// friendships.status (20240910000002_social)
export const FRIENDSHIP_STATUSES = ['pending', 'accepted', 'blocked'] as const;
// shared_trips.visibility — single-value CHECK (20240910000002_social)
export const SHARED_TRIP_VISIBILITY = ['friends'] as const;
// channels.visibility (20260924000001_social_v1)
export const CHANNEL_VISIBILITY = ['open', 'private'] as const;
// event_rsvps.status (20260924000001_social_v1)
export const EVENT_RSVP_STATUSES = ['going', 'interested', 'cant_go'] as const;
// reports.target_kind — extended to 'post' by 20261004000001_posts
// (legacy 2-value CHECK in 20260924000001_social_v1 is a subset)
export const REPORT_TARGET_KINDS = ['route', 'event', 'post'] as const;
// comments.feed_kind — extended to 'post' by 20261004000001_posts
// (legacy 3-value CHECK in 20260924000001_social_v1 is a subset)
export const COMMENT_FEED_KINDS = ['activity', 'route', 'event', 'post'] as const;
// notifications.feed_kind — same extension history as comments.feed_kind
export const NOTIFICATION_FEED_KINDS = ['activity', 'route', 'event', 'post'] as const;
// notifications.kind (20260924000001_social_v1)
export const NOTIFICATION_KINDS = ['comment', 'reply'] as const;
// posts.visibility — 'crew' added by 20261007000001_crews
export const POST_VISIBILITY = ['public', 'friends', 'crew'] as const;
// posts.ride_kind (20261004000001_posts)
export const POST_RIDE_KINDS = ['trip', 'route'] as const;
// posts.status (20261004000001_posts)
export const POST_STATUSES = ['live', 'processing', 'failed'] as const;
// post_media.kind (20261004000001_posts)
export const POST_MEDIA_KINDS = ['photo', 'video', 'poster'] as const;
// transcode_jobs.status (20261004000001_posts)
export const TRANSCODE_JOB_STATUSES = ['queued', 'processing', 'done', 'failed'] as const;
// channel_members.role (20261007000001_crews; legacy 'owner' superseded —
// see the waiver in scripts/check-closed-sets.sh)
export const CHANNEL_MEMBER_ROLES = ['admin', 'member'] as const;
// hazards.kind (20261011000001_safety; re-exported from $lib/hazards.js
// alongside WORST_RANK for hazard code)
export const HAZARD_KINDS = ['pothole', 'unsafe', 'closure', 'police', 'surface', 'other'] as const;
