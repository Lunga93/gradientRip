// Typed plan pipeline entry — the only server boundary the Plan form needs.
// `command` gives us compile-time-checked Input/Output on both sides of the
// wire (no FormData, no hidden inputs, no ActionResult unwrapping).
// 'unchecked' skips the standard-schema validator: runRemotePlan already
// validates every input (stop count, empty queries, board/mode fallbacks).
import { command } from '$app/server';
import { error } from '@sveltejs/kit';
import { runRemotePlan } from '$lib/server/plan.js';
import type { RemoteStop } from '$lib/server/plan.js';
import type { PlanPacket } from '$lib/engine/index.js';

export interface PlanInput {
	stops: RemoteStop[];
	boardVal: string;
	modeId: string;
	country: string;
}

export const planRoute = command(
	'unchecked',
	async (input: PlanInput): Promise<PlanPacket> => {
		try {
			return await runRemotePlan(input.stops, input.boardVal, input.modeId, input.country);
		} catch (err) {
			// Operational failures (bad query, unreachable router) surface
			// the message to the browser; log server-side for 5xx triage.
			// eslint-disable-next-line no-console
			console.error('[planRoute]', err);
			throw error(400, (err as Error).message || 'Something went wrong.');
		}
	}
);
