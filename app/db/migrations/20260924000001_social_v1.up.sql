-- Up: social v1 slice 1 — profile/prefs extension (rest lands in Task 3/5/6 migrations appended here)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sports TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_lat DOUBLE PRECISION;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_lon DOUBLE PRECISION;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_label TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS units TEXT NOT NULL DEFAULT 'km';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_use TEXT;
ALTER TABLE prefs ADD COLUMN IF NOT EXISTS sports TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE prefs ADD COLUMN IF NOT EXISTS units TEXT NOT NULL DEFAULT 'km';
ALTER TABLE prefs ADD COLUMN IF NOT EXISTS primary_use TEXT;
CREATE TABLE IF NOT EXISTS public_routes (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	author UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
	sport TEXT NOT NULL,
	line JSONB NOT NULL,
	pts JSONB NOT NULL DEFAULT '[]',
	elev JSONB NOT NULL DEFAULT '[]',
	stats JSONB NOT NULL DEFAULT '{}',
	geom_hash TEXT NOT NULL,
	home_offset BOOLEAN NOT NULL DEFAULT true,
	source TEXT,
	device_kind TEXT,
	external_id TEXT,
	telemetry JSONB,
	hidden BOOLEAN NOT NULL DEFAULT false,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (geom_hash, sport)
);
CREATE TABLE IF NOT EXISTS route_stats (
	route_id UUID PRIMARY KEY REFERENCES public_routes(id) ON DELETE CASCADE,
	rides INT NOT NULL DEFAULT 0,
	saves INT NOT NULL DEFAULT 0,
	kudos INT NOT NULL DEFAULT 0,
	score DOUBLE PRECISION NOT NULL DEFAULT 0
);
ALTER TABLE public_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY routes_public_read ON public_routes FOR SELECT TO PUBLIC USING (hidden = false);
CREATE POLICY routes_self_write ON public_routes FOR ALL TO PUBLIC USING (author = current_user_id());
