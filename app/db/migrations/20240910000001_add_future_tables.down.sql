-- Migration: 20240910000001_add_future_tables
-- Down: drop future tables

DROP POLICY IF EXISTS profile_isolation ON profiles;
DROP POLICY IF EXISTS board_garage_isolation ON board_garage;
DROP POLICY IF EXISTS spot_isolation ON spots;
DROP POLICY IF EXISTS crews_all ON crews;
DROP POLICY IF EXISTS crew_members_isolation ON crew_members;
DROP POLICY IF EXISTS group_rides_isolation ON group_rides;
DROP POLICY IF EXISTS ride_battery_snapshots_isolation ON ride_battery_snapshots;
DROP POLICY IF EXISTS challenges_read ON challenges;
DROP POLICY IF EXISTS challenge_entries_isolation ON challenge_entries;
DROP POLICY IF EXISTS driver_shifts_isolation ON driver_shifts;
DROP POLICY IF EXISTS battery_diary_isolation ON battery_diary;
DROP POLICY IF EXISTS opt_in_traces_isolation ON opt_in_traces;
DROP POLICY IF EXISTS notification_prefs_isolation ON notification_prefs;
DROP POLICY IF EXISTS notification_queue_isolation ON notification_queue;
DROP POLICY IF EXISTS route_options_cache_isolation ON route_options_cache;

ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS board_garage DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS spots DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crews DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crew_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS group_rides DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ride_battery_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS challenges DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS challenge_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS driver_shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS battery_diary DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS opt_in_traces DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_prefs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS route_options_cache DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS route_options_cache CASCADE;
DROP TABLE IF EXISTS notification_queue CASCADE;
DROP TABLE IF EXISTS notification_prefs CASCADE;
DROP TABLE IF EXISTS opt_in_traces CASCADE;
DROP TABLE IF EXISTS battery_diary CASCADE;
DROP TABLE IF EXISTS driver_shifts CASCADE;
DROP TABLE IF EXISTS challenge_entries CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;
DROP TABLE IF EXISTS ride_battery_snapshots CASCADE;
DROP TABLE IF EXISTS group_rides CASCADE;
DROP TABLE IF EXISTS crew_members CASCADE;
DROP TABLE IF EXISTS crews CASCADE;
DROP TABLE IF EXISTS spots CASCADE;
DROP TABLE IF EXISTS board_garage CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
