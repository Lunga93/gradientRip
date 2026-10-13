-- Down: safety (Phase D Task 1) — exact reverse of 20261011000001_safety.up.sql
-- Order: triggers/functions → policies → tables (dependents first) → columns.
-- Loss note: dropping hazards/hazard_confirmations discards hazard rows; probes are
-- deleted before rollback during verification and seed data is untouched (additive
-- migration), so the loss is probe-only by construction.

-- reports hide triggers + functions (route trigger from social-v1 untouched)
DROP TRIGGER IF EXISTS trg_reports_hide_post ON reports;
DROP FUNCTION IF EXISTS hide_post_on_reports();
DROP TRIGGER IF EXISTS trg_reports_hide_event ON reports;
DROP FUNCTION IF EXISTS hide_event_on_reports();

-- hazards RLS policies (dropped explicitly ahead of the table for review clarity)
DROP POLICY IF EXISTS hazards_reporter_delete ON hazards;
DROP POLICY IF EXISTS hazards_reporter_update ON hazards;
DROP POLICY IF EXISTS hazards_reporter_insert ON hazards;
DROP POLICY IF EXISTS hazards_route_read ON hazards;

-- hazard_confirmations (depends on hazards)
DROP TABLE IF EXISTS hazard_confirmations;

-- hazards (depends on public_routes + users, both persist)
DROP INDEX IF EXISTS idx_hazards_route_expires;
DROP TABLE IF EXISTS hazards;

-- hidden columns (added with defaults; no backfill to restore)
ALTER TABLE posts DROP COLUMN IF EXISTS hidden;
ALTER TABLE events DROP COLUMN IF EXISTS hidden;
