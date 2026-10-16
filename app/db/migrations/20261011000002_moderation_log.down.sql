-- Down: moderation_log (Phase D Task 4) — exact reverse of
-- 20261011000002_moderation_log.up.sql (index first, then the table).
-- Loss note: dropping moderation_log discards dismiss audit rows; probes are
-- deleted before rollback during verification and seed data is untouched
-- (additive migration), so the loss is probe-only by construction.

DROP INDEX IF EXISTS idx_moderation_log_target;
DROP TABLE IF EXISTS moderation_log;
