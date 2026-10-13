-- Up: safety (Phase D Task 1) — hazards + confirmations + posts/events hidden + hide triggers + RLS
-- Mirrors the hide_route_on_reports() trigger shape and the current_user_id() session idiom
-- from 20260924000001_social_v1.up.sql. The confirmations child table carries no
-- independent RLS — it inherits the hazard's route visibility via parent joins in API
-- queries (same idiom as post_media/post_kudos in 20261004000001_posts.up.sql).
-- Table owners bypass RLS, so Task 2 APIs MUST also join public_routes in every
-- hazard read; the policies below are defense-in-depth documenting the rule.
-- Additive only: no existing rows rewritten, so down is a clean drop (probes deleted first).

-- hazards (spec §4 verbatim): route-wide when lat/lon NULL (no pair CHECK by design —
-- Task 2 validates the pair + 2 km proximity server-side)
CREATE TABLE IF NOT EXISTS hazards (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	route_id UUID NOT NULL REFERENCES public_routes(id) ON DELETE CASCADE,
	reporter UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	kind TEXT NOT NULL CHECK (kind IN ('pothole', 'unsafe', 'closure', 'police', 'surface', 'other')),
	lat DOUBLE PRECISION,
	lon DOUBLE PRECISION,
	note TEXT CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 280),
	expires_at TIMESTAMPTZ NOT NULL,
	confirmations INT NOT NULL DEFAULT 0 CHECK (confirmations >= 0),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hazards_route_expires ON hazards (route_id, expires_at);

-- hazard_confirmations (one confirm per rider; the PK is the UNIQUE pair from the plan)
CREATE TABLE IF NOT EXISTS hazard_confirmations (
	hazard_id UUID NOT NULL REFERENCES hazards(id) ON DELETE CASCADE,
	reporter UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (hazard_id, reporter)
);

-- RLS on hazards: readable iff the parent route row is readable by the caller
-- (open route → anyone incl. anonymous; hidden route → author only — the same rule
-- as routes_public_read/routes_self_write, evaluated by joining routes, never an
-- independent permissive policy). Writes: reporter-only insert,
-- reporter-or-route-author update/delete (resolve path).
ALTER TABLE hazards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hazards_route_read ON hazards;
CREATE POLICY hazards_route_read ON hazards FOR SELECT TO PUBLIC USING (
	EXISTS (SELECT 1 FROM public_routes r WHERE r.id = hazards.route_id AND (r.hidden = false OR r.author = current_user_id()))
);
DROP POLICY IF EXISTS hazards_reporter_insert ON hazards;
CREATE POLICY hazards_reporter_insert ON hazards FOR INSERT TO PUBLIC WITH CHECK (reporter = current_user_id());
DROP POLICY IF EXISTS hazards_reporter_update ON hazards;
CREATE POLICY hazards_reporter_update ON hazards FOR UPDATE TO PUBLIC USING (
	reporter = current_user_id() OR EXISTS (SELECT 1 FROM public_routes r WHERE r.id = hazards.route_id AND r.author = current_user_id())
) WITH CHECK (
	reporter = current_user_id() OR EXISTS (SELECT 1 FROM public_routes r WHERE r.id = hazards.route_id AND r.author = current_user_id())
);
DROP POLICY IF EXISTS hazards_reporter_delete ON hazards;
CREATE POLICY hazards_reporter_delete ON hazards FOR DELETE TO PUBLIC USING (
	reporter = current_user_id() OR EXISTS (SELECT 1 FROM public_routes r WHERE r.id = hazards.route_id AND r.author = current_user_id())
);

-- posts.hidden + hide trigger (byte-mirror of hide_route_on_reports, parameterized by kind)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION hide_post_on_reports() RETURNS trigger AS $$
BEGIN
	IF NEW.target_kind = 'post' THEN
		IF (SELECT COUNT(DISTINCT reporter) FROM reports WHERE target_kind = 'post' AND target_id = NEW.target_id) >= 3 THEN
			UPDATE posts SET hidden = true WHERE id = NEW.target_id;
		END IF;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_reports_hide_post ON reports;
CREATE TRIGGER trg_reports_hide_post AFTER INSERT ON reports FOR EACH ROW EXECUTE FUNCTION hide_post_on_reports();

-- events.hidden + hide trigger (events had no hidden column; same shape as posts)
ALTER TABLE events ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION hide_event_on_reports() RETURNS trigger AS $$
BEGIN
	IF NEW.target_kind = 'event' THEN
		IF (SELECT COUNT(DISTINCT reporter) FROM reports WHERE target_kind = 'event' AND target_id = NEW.target_id) >= 3 THEN
			UPDATE events SET hidden = true WHERE id = NEW.target_id;
		END IF;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_reports_hide_event ON reports;
CREATE TRIGGER trg_reports_hide_event AFTER INSERT ON reports FOR EACH ROW EXECUTE FUNCTION hide_event_on_reports();
