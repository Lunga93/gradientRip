-- Up: moderation_log (Phase D Task 4) — audit rows for crew-admin dismissals.
-- Home decision (Task 4 Step 1): Task 1 migration 20261011000001_safety already
-- landed (86b286c) and applies cleanly on dummy, so this lives in a NEW
-- migration — landed migrations are never amended.
-- Additive only: no existing rows read or rewritten, so down is a clean drop
-- and row parity holds trivially (verified up/down/up on dummy with counts).
-- target_kind mirrors reports.target_kind (same literals as REPORT_TARGET_KINDS
-- in src/lib/closed-sets.ts — no new const needed); TEXT + CHECK, no ENUMs
-- per AGENTS.md §1. action is free TEXT (currently only 'dismiss' is written).

CREATE TABLE IF NOT EXISTS moderation_log (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	target_kind TEXT NOT NULL CHECK (target_kind IN ('route', 'event', 'post')),
	target_id UUID NOT NULL,
	actor UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	action TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moderation_log_target ON moderation_log (target_kind, target_id);
