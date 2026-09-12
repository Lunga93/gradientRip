-- Migration: 20240910000002_social
-- Down: drop social tables, helper, and identity columns

DROP POLICY IF EXISTS profile_friends_read ON profiles;
DROP POLICY IF EXISTS trip_shared_read ON trips;
DROP POLICY IF EXISTS shared_friends_read ON shared_trips;
DROP POLICY IF EXISTS shared_self ON shared_trips;
DROP POLICY IF EXISTS live_friends_read ON live_positions;
DROP POLICY IF EXISTS live_self ON live_positions;
DROP POLICY IF EXISTS friendship_involvement ON friendships;
DROP POLICY IF EXISTS oauth_session_isolation ON oauth_sessions;

DROP FUNCTION IF EXISTS is_friend(UUID);

DROP TABLE IF EXISTS shared_trips;
DROP TABLE IF EXISTS live_positions;
DROP TABLE IF EXISTS friendships;
DROP TABLE IF EXISTS oauth_sessions;

DROP INDEX IF EXISTS uq_users_google_id;
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE users DROP COLUMN IF EXISTS display_name;
ALTER TABLE users DROP COLUMN IF EXISTS google_id;
