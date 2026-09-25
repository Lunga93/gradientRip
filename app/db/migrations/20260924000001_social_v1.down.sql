-- Down Task 9: comments + notifications (dependents first; prior blocks below untouched)
DROP INDEX IF EXISTS idx_notifications_unread;
DROP INDEX IF EXISTS idx_notifications_user;
DROP TABLE IF EXISTS notifications;
DROP INDEX IF EXISTS idx_comments_user_created;
DROP INDEX IF EXISTS idx_comments_target;
DROP TABLE IF EXISTS comments;
-- Down Task 8: feed kudos + reports (dependents first; prior blocks below untouched)
DROP TRIGGER IF EXISTS trg_reports_autohide ON reports;
DROP FUNCTION IF EXISTS hide_route_on_reports();
DROP INDEX IF EXISTS idx_reports_target;
DROP TABLE IF EXISTS reports;
DROP TRIGGER IF EXISTS trg_route_kudos_bump ON route_kudos;
DROP FUNCTION IF EXISTS bump_route_kudos();
DROP TABLE IF EXISTS route_kudos;
-- Down Task 6: events + RSVP (dependents first; prior blocks below untouched)
DROP TABLE IF EXISTS event_rsvps;
DROP TABLE IF EXISTS events;
-- Down Task 5: channels + route_saves (dependents first; prior blocks below untouched)
DROP TRIGGER IF EXISTS trg_route_saves_bump ON route_saves;
DROP FUNCTION IF EXISTS bump_route_saves();
-- Policies on channels reference channel_members — drop them before the member table.
DROP POLICY IF EXISTS channels_member_read ON channels;
DROP POLICY IF EXISTS channels_open_read ON channels;
DROP TABLE IF EXISTS channel_members;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS route_saves;
-- Down counterpart
DROP TABLE IF EXISTS route_stats;
DROP TABLE IF EXISTS public_routes;
ALTER TABLE prefs DROP COLUMN IF EXISTS primary_use;
ALTER TABLE prefs DROP COLUMN IF EXISTS units;
ALTER TABLE prefs DROP COLUMN IF EXISTS sports;
ALTER TABLE profiles DROP COLUMN IF EXISTS primary_use;
ALTER TABLE profiles DROP COLUMN IF EXISTS units;
ALTER TABLE profiles DROP COLUMN IF EXISTS home_label;
ALTER TABLE profiles DROP COLUMN IF EXISTS home_lon;
ALTER TABLE profiles DROP COLUMN IF EXISTS home_lat;
ALTER TABLE profiles DROP COLUMN IF EXISTS sports;
