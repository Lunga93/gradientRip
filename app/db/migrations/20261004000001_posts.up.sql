-- Up: posts (Phase B Task 1) — posts + media + kudos + transcode jobs + RLS + kind extension
-- Mirrors the current_user_id()/is_friend() session idiom and the trg_route_kudos_bump
-- pattern from 20260924000001_social_v1.up.sql. Child tables carry no independent
-- RLS; they inherit the post's visibility via parent joins in API queries.

-- posts (spec §5 verbatim + brief CHECKs)
CREATE TABLE IF NOT EXISTS posts (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	author UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	body TEXT,
	visibility TEXT NOT NULL CHECK (visibility IN ('public', 'friends')),
	ride_kind TEXT CHECK (ride_kind IN ('trip', 'route')),
	ride_id UUID,
	status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'processing', 'failed')),
	kudos INT NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_visibility_created ON posts (visibility, created_at DESC);

-- post_media (spec §5 verbatim)
CREATE TABLE IF NOT EXISTS post_media (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
	kind TEXT NOT NULL CHECK (kind IN ('photo', 'video', 'poster')),
	s3_key TEXT NOT NULL,
	width INT,
	height INT,
	duration_s REAL,
	bytes INT NOT NULL,
	sort INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media (post_id);

-- post_kudos (mirrors route_kudos shape, incl. created_at; PK gives idempotency)
CREATE TABLE IF NOT EXISTS post_kudos (
	post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (post_id, user_id)
);

-- kudos bump trigger (byte-mirror of bump_route_kudos, counting on posts.kudos directly)
CREATE OR REPLACE FUNCTION bump_post_kudos() RETURNS trigger AS $$
BEGIN
	UPDATE posts SET kudos = kudos + 1 WHERE id = NEW.post_id;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_post_kudos_bump ON post_kudos;
CREATE TRIGGER trg_post_kudos_bump AFTER INSERT ON post_kudos FOR EACH ROW EXECUTE FUNCTION bump_post_kudos();

-- transcode_jobs (spec §5 verbatim)
CREATE TABLE IF NOT EXISTS transcode_jobs (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
	media_id UUID NOT NULL REFERENCES post_media(id) ON DELETE CASCADE,
	status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
	attempts INT NOT NULL DEFAULT 0,
	last_error TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transcode_jobs_status_created ON transcode_jobs (status, created_at);

-- RLS on posts (shape copied from social-v1: SELECT read policy + owner FOR ALL policy)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY posts_read ON posts FOR SELECT TO PUBLIC USING (
	visibility = 'public' OR author = current_user_id() OR (visibility = 'friends' AND is_friend(author))
);
CREATE POLICY posts_self_write ON posts FOR ALL TO PUBLIC USING (author = current_user_id());

-- Extend comment/report/notification kinds to accept 'post' (constraints exist per social-v1)
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_feed_kind_check;
ALTER TABLE comments ADD CONSTRAINT comments_feed_kind_check CHECK (feed_kind IN ('activity', 'route', 'event', 'post'));
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_feed_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_feed_kind_check CHECK (feed_kind IN ('activity', 'route', 'event', 'post'));
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_target_kind_check;
ALTER TABLE reports ADD CONSTRAINT reports_target_kind_check CHECK (target_kind IN ('route', 'event', 'post'));
