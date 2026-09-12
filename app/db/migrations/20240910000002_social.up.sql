-- Migration: 20240910000002_social
-- Up: Google OAuth identity, sessions, friendships, live positions, trip sharing

-- Google identity columns on users (anonymous device rows link up on login)
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- OAuth sessions: opaque SHA-256 token hashes, 30-day rolling expiry
CREATE TABLE IF NOT EXISTS oauth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_user_id ON oauth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires ON oauth_sessions(expires_at);

-- Friendships: directed request (requested_by) with canonical-pair dedupe
CREATE TABLE IF NOT EXISTS friendships (
    user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (user_a <> user_b),
    PRIMARY KEY (user_a, user_b)
);
-- One row per unordered pair regardless of column order
CREATE UNIQUE INDEX IF NOT EXISTS uq_friendships_pair
    ON friendships (LEAST(user_a, user_b), GREATEST(user_a, user_b));
CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON friendships(user_b);

-- Live positions: one row per riding user, upserted while recording/tracking
CREATE TABLE IF NOT EXISTS live_positions (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trip sharing: row presence = shared with accepted friends (private = no row)
CREATE TABLE IF NOT EXISTS shared_trips (
    trip_id BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visibility TEXT NOT NULL DEFAULT 'friends' CHECK (visibility IN ('friends')),
    shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (trip_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shared_trips_user ON shared_trips(user_id);

-- Friendship predicate shared by the friend-visibility policies below
CREATE OR REPLACE FUNCTION is_friend(other_id UUID) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND ((f.user_a = current_user_id() AND f.user_b = other_id)
            OR (f.user_b = current_user_id() AND f.user_a = other_id))
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- RLS: sessions and friendships are self/involved-only
ALTER TABLE oauth_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY oauth_session_isolation ON oauth_sessions
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY friendship_involvement ON friendships
    FOR ALL TO PUBLIC
    USING (user_a = current_user_id() OR user_b = current_user_id());

-- RLS: live positions readable by self + accepted friends
ALTER TABLE live_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY live_self ON live_positions
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());
CREATE POLICY live_friends_read ON live_positions
    FOR SELECT TO PUBLIC
    USING (is_friend(live_positions.user_id));

-- RLS: share rows readable by owner + accepted friends
ALTER TABLE shared_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY shared_self ON shared_trips
    FOR ALL TO PUBLIC
    USING (user_id = current_user_id());
CREATE POLICY shared_friends_read ON shared_trips
    FOR SELECT TO PUBLIC
    USING (is_friend(shared_trips.user_id));

-- RLS: friends may read trip rows the owner explicitly shared
CREATE POLICY trip_shared_read ON trips
    FOR SELECT TO PUBLIC
    USING (
        EXISTS (
            SELECT 1 FROM shared_trips st
            WHERE st.trip_id = trips.id
              AND st.user_id = trips.user_id
              AND is_friend(st.user_id)
        )
    );

-- RLS: friends may read each other's profiles
CREATE POLICY profile_friends_read ON profiles
    FOR SELECT TO PUBLIC
    USING (is_friend(profiles.user_id));
