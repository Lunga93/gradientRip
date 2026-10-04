-- Down: posts (Phase B Task 1) — exact reverse of 20261004000001_posts.up.sql
-- Order: kind restores → policies → trigger/function → tables (dependents first).

-- Restore original kind checks (drop the 'post' variant, re-add the social-v1 originals)
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_target_kind_check;
ALTER TABLE reports ADD CONSTRAINT reports_target_kind_check CHECK (target_kind IN ('route', 'event'));
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_feed_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_feed_kind_check CHECK (feed_kind IN ('activity', 'route', 'event'));
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_feed_kind_check;
ALTER TABLE comments ADD CONSTRAINT comments_feed_kind_check CHECK (feed_kind IN ('activity', 'route', 'event'));

-- RLS policies on posts
DROP POLICY IF EXISTS posts_read ON posts;
DROP POLICY IF EXISTS posts_self_write ON posts;

-- transcode_jobs (depends on posts + post_media)
DROP INDEX IF EXISTS idx_transcode_jobs_status_created;
DROP TABLE IF EXISTS transcode_jobs;

-- post_kudos trigger + function + table
DROP TRIGGER IF EXISTS trg_post_kudos_bump ON post_kudos;
DROP FUNCTION IF EXISTS bump_post_kudos();
DROP TABLE IF EXISTS post_kudos;

-- post_media (depends on posts)
DROP INDEX IF EXISTS idx_post_media_post;
DROP TABLE IF EXISTS post_media;

-- posts
DROP INDEX IF EXISTS idx_posts_visibility_created;
DROP TABLE IF EXISTS posts;
