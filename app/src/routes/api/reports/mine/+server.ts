// GET /api/reports/mine — author-scoped report visibility (Phase D Task 4).
// Returns abuse reports filed on the CALLER's own posts and routes, grouped
// per target: distinct-reporter count + every reason (report id + reason text
// + created_at — never the reporter identity; reporters stay anonymous to
// authors). No target id param: both queries only join targets the caller
// authored, so a stranger gets an empty list by construction (200 with [] —
// never another author's reports). Signed-in only (401 otherwise).
// Events excluded by design: events belong to a channel (created_by is not
// authorship) — crew-side review of event reports is a follow-up, not this
// endpoint. Post targets carry visibility + crew_id + hidden so the author UI
// can pick the honest hidden state and the right remedy.
import { json, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

interface ReasonRow {
	id: string;
	target_kind: string;
	target_id: string;
	reporter: string;
	reason: string;
	created_at: Date;
}

export interface MineReportTarget {
	target_kind: 'post' | 'route';
	target_id: string;
	count: number;
	hidden: boolean;
	// Post-only: visibility + crew linkage for the remedy copy; route-only:
	// title. Null on the other kind.
	visibility: string | null;
	crew_id: string | null;
	label: string | null;
	reasons: { id: string; reason: string; created_at: string }[];
}

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const data = await withUser(me.id, async (c) => {
		// Targets the caller authored that carry at least one report, with
		// the distinct-reporter count the hide triggers use.
		const { rows: targetRows } = await c.query(
			`SELECT 'post' AS target_kind, p.id AS target_id, p.hidden,
			        COUNT(DISTINCT r.reporter)::int AS count,
			        MAX(r.created_at) AS latest,
			        p.visibility AS visibility, p.crew_id AS crew_id,
			        LEFT(p.body, 140) AS label
			 FROM posts p JOIN reports r ON r.target_kind = 'post' AND r.target_id = p.id
			 WHERE p.author = current_user_id()
			 GROUP BY p.id
			 UNION ALL
			 SELECT 'route' AS target_kind, t.id AS target_id, t.hidden,
			        COUNT(DISTINCT r.reporter)::int AS count,
			        MAX(r.created_at) AS latest,
			        NULL AS visibility, NULL AS crew_id,
			        t.title AS label
			 FROM public_routes t JOIN reports r ON r.target_kind = 'route' AND r.target_id = t.id
			 WHERE t.author = current_user_id()
			 GROUP BY t.id
			 ORDER BY latest DESC`
		);
		if (targetRows.length === 0) return { reports: [] as MineReportTarget[] };
		// Every reason on those targets (reporter selected for the distinct
		// count only — stripped before responding, never exposed to authors).
		const { rows: reasonRows } = await c.query(
			`SELECT r.id, r.target_kind, r.target_id, r.reporter, r.reason, r.created_at
			 FROM reports r
			 WHERE (r.target_kind = 'post'
			        AND EXISTS (SELECT 1 FROM posts p WHERE p.id = r.target_id AND p.author = current_user_id()))
			    OR (r.target_kind = 'route'
			        AND EXISTS (SELECT 1 FROM public_routes t WHERE t.id = r.target_id AND t.author = current_user_id()))
			 ORDER BY r.created_at ASC`
		);
		const reasonsByTarget = new Map<string, ReasonRow[]>();
		for (const row of reasonRows) {
			const r = row as unknown as ReasonRow;
			const key = `${r.target_kind}:${r.target_id as string}`;
			if (!reasonsByTarget.has(key)) reasonsByTarget.set(key, []);
			reasonsByTarget.get(key)?.push(r);
		}
		const reports: MineReportTarget[] = targetRows.map((t) => {
			const kind = t.target_kind as 'post' | 'route';
			const key = `${kind}:${t.target_id as string}`;
			const reasons = reasonsByTarget.get(key) ?? [];
			return {
				target_kind: kind,
				target_id: t.target_id as string,
				count: Number(t.count) || 0,
				hidden: Boolean(t.hidden),
				visibility: (t.visibility as string | null) ?? null,
				crew_id: (t.crew_id as string | null) ?? null,
				label: (t.label as string | null) ?? null,
				reasons: reasons.map((r) => ({
					id: r.id as string,
					reason: r.reason as string,
					created_at: (r.created_at as Date).toISOString()
				}))
			};
		});
		return { reports };
	});
	return json(data, { headers: { 'Cache-Control': 'no-store' } });
};
