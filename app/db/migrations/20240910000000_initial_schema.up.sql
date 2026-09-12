-- Migration: 20240910000000_initial_schema
-- Up: create core tables, RLS, and helper functions

-- Users table with reserved auth fields
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Presets
CREATE TABLE IF NOT EXISTS presets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    query TEXT NOT NULL,
    coords JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presets_user_id ON presets(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_presets_user_label_query ON presets(user_id, label, query);

-- Trips
CREATE TABLE IF NOT EXISTS trips (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ts BIGINT NOT NULL,
    mode_id TEXT NOT NULL,
    board_val TEXT NOT NULL,
    queries TEXT[] NOT NULL DEFAULT '{}',
    coords JSONB NOT NULL DEFAULT '[]',
    line JSONB NOT NULL DEFAULT '[]',
    pts JSONB NOT NULL DEFAULT '[]',
    elev JSONB NOT NULL DEFAULT '[]',
    cum JSONB NOT NULL DEFAULT '[]',
    total_wh NUMERIC NOT NULL,
    total_climb NUMERIC NOT NULL,
    usable_wh NUMERIC NOT NULL,
    climb_limit NUMERIC NOT NULL,
    brake_limit NUMERIC NOT NULL,
    total_km NUMERIC NOT NULL,
    drawn BOOLEAN DEFAULT false,
    recorded BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_trips_user_ts ON trips(user_id, ts);

-- Prefs
CREATE TABLE IF NOT EXISTS prefs (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    transport_mode TEXT DEFAULT 'eskate',
    board TEXT DEFAULT '',
    theme TEXT DEFAULT 'auto',
    legal_dismissed BOOLEAN DEFAULT false,
    known_location JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reference data: transport modes (seeded, readonly)
CREATE TABLE IF NOT EXISTS transport_modes (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    tag TEXT NOT NULL,
    "group" TEXT NOT NULL CHECK ("group" IN ('electric', 'human')),
    unit TEXT NOT NULL,
    human BOOLEAN DEFAULT false,
    climb_note TEXT NOT NULL,
    brake_note TEXT NOT NULL,
    phys JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reference data: boards (seeded, readonly)
CREATE TABLE IF NOT EXISTS boards (
    id BIGSERIAL PRIMARY KEY,
    mode_id TEXT NOT NULL REFERENCES transport_modes(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    UNIQUE(mode_id, value)
);

CREATE INDEX IF NOT EXISTS idx_boards_mode_id ON boards(mode_id);

-- Migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS helper: current user ID from app context
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_user_id')::UUID;
EXCEPTION
    WHEN others THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable RLS on user-owned tables
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE prefs ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own rows
CREATE POLICY preset_isolation ON presets
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

CREATE POLICY trip_isolation ON trips
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

CREATE POLICY pref_isolation ON prefs
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

-- Reference tables are publicly readable but not writable by app users
ALTER TABLE transport_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY transport_modes_read ON transport_modes
    FOR SELECT TO PUBLIC
    USING (true);

CREATE POLICY boards_read ON boards
    FOR SELECT TO PUBLIC
    USING (true);
