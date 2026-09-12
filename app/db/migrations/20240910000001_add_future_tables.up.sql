-- Migration: 20240910000001_add_future_tables
-- Up: reserved tables for future features (empty, ready for migration)

-- User profiles (per user)
CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_isolation ON profiles
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

-- Board garage: user's personal board inventory
CREATE TABLE IF NOT EXISTS board_garage (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    mode_id TEXT NOT NULL REFERENCES transport_modes(id) ON DELETE RESTRICT,
    board_value TEXT NOT NULL,
    wh_health NUMERIC DEFAULT 100,
    load_notes TEXT,
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_garage_user_id ON board_garage(user_id);

ALTER TABLE board_garage ENABLE ROW LEVEL SECURITY;
CREATE POLICY board_garage_isolation ON board_garage
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

-- Spots: user pins + votable OSM references
CREATE TABLE IF NOT EXISTS spots (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    coords JSONB NOT NULL,
    osm_way_ref TEXT,
    is_public BOOLEAN DEFAULT false,
    vote_score INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spots_user_id ON spots(user_id);
CREATE INDEX IF NOT EXISTS idx_spots_public ON spots(is_public) WHERE is_public = true;

ALTER TABLE spots ENABLE ROW LEVEL SECURITY;
CREATE POLICY spot_isolation ON spots
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

-- Crews
CREATE TABLE IF NOT EXISTS crews (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crews ENABLE ROW LEVEL SECURITY;
CREATE POLICY crews_all ON crews
    FOR ALL TO PUBLIC
    USING (true);

-- Crew memberships
CREATE TABLE IF NOT EXISTS crew_members (
    id BIGSERIAL PRIMARY KEY,
    crew_id BIGINT NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(crew_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_crew_members_user_id ON crew_members(user_id);

ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY crew_members_isolation ON crew_members
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

-- Group rides
CREATE TABLE IF NOT EXISTS group_rides (
    id BIGSERIAL PRIMARY KEY,
    crew_id BIGINT NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    starts_at TIMESTAMPTZ,
    route_coords JSONB,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_rides_crew_id ON group_rides(crew_id);

ALTER TABLE group_rides ENABLE ROW LEVEL SECURITY;
CREATE POLICY group_rides_isolation ON group_rides
    FOR ALL TO PUBLIC
    USING (true);

-- Per-rider battery snapshots on group rides
CREATE TABLE IF NOT EXISTS ride_battery_snapshots (
    id BIGSERIAL PRIMARY KEY,
    group_ride_id BIGINT NOT NULL REFERENCES group_rides(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode_id TEXT NOT NULL,
    board_val TEXT NOT NULL,
    wh_remaining NUMERIC,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ride_battery_snapshots_ride_id ON ride_battery_snapshots(group_ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_battery_snapshots_user_id ON ride_battery_snapshots(user_id);

ALTER TABLE ride_battery_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY ride_battery_snapshots_isolation ON ride_battery_snapshots
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

-- Challenges / leaderboards by board class
CREATE TABLE IF NOT EXISTS challenges (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    board_class TEXT NOT NULL,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY challenges_read ON challenges
    FOR SELECT TO PUBLIC
    USING (is_public = true);

-- Leaderboard entries
CREATE TABLE IF NOT EXISTS challenge_entries (
    id BIGSERIAL PRIMARY KEY,
    challenge_id BIGINT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id BIGINT REFERENCES trips(id) ON DELETE SET NULL,
    score NUMERIC NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_entries_challenge_id ON challenge_entries(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_entries_user_id ON challenge_entries(user_id);

ALTER TABLE challenge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY challenge_entries_isolation ON challenge_entries
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

-- Driver shifts: multi-drop lists
CREATE TABLE IF NOT EXISTS driver_shifts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    stops JSONB NOT NULL DEFAULT '[]',
    total_leg_wh JSONB NOT NULL DEFAULT '[]',
    battery_budget NUMERIC,
    top_up_stops JSONB DEFAULT '[]',
    cost_cents INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_shifts_user_id ON driver_shifts(user_id);

ALTER TABLE driver_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY driver_shifts_isolation ON driver_shifts
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

-- Battery diary: Wh/km history
CREATE TABLE IF NOT EXISTS battery_diary (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id BIGINT REFERENCES trips(id) ON DELETE SET NULL,
    mode_id TEXT NOT NULL,
    board_val TEXT NOT NULL,
    wh_per_km NUMERIC NOT NULL,
    distance_km NUMERIC NOT NULL,
    temperature_c NUMERIC,
    notes TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battery_diary_user_id ON battery_diary(user_id);
CREATE INDEX IF NOT EXISTS idx_battery_diary_trip_id ON battery_diary(trip_id);

ALTER TABLE battery_diary ENABLE ROW LEVEL SECURITY;
CREATE POLICY battery_diary_isolation ON battery_diary
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

-- Opt-in traces: raw GPS + barometer (append-only)
CREATE TABLE IF NOT EXISTS opt_in_traces (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id BIGINT REFERENCES trips(id) ON DELETE SET NULL,
    raw_points JSONB NOT NULL DEFAULT '[]',
    osm_way_aggregates JSONB DEFAULT '{}',
    consent_given BOOLEAN DEFAULT false,
    retention_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opt_in_traces_user_id ON opt_in_traces(user_id);
CREATE INDEX IF NOT EXISTS idx_opt_in_traces_trip_id ON opt_in_traces(trip_id);

ALTER TABLE opt_in_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY opt_in_traces_isolation ON opt_in_traces
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

-- Notification prefs + queue (store only)
CREATE TABLE IF NOT EXISTS notification_prefs (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    push_enabled BOOLEAN DEFAULT false,
    email_enabled BOOLEAN DEFAULT false,
    quiet_hours JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_prefs_isolation ON notification_prefs
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

CREATE TABLE IF NOT EXISTS notification_queue (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    delivered BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON notification_queue(user_id);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_queue_isolation ON notification_queue
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

-- Scored route-options cache per query hash
CREATE TABLE IF NOT EXISTS route_options_cache (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query_hash TEXT NOT NULL,
    mode_id TEXT NOT NULL,
    board_val TEXT NOT NULL,
    options JSONB NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, query_hash)
);

CREATE INDEX IF NOT EXISTS idx_route_options_cache_expires ON route_options_cache(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE route_options_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY route_options_cache_isolation ON route_options_cache
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());
