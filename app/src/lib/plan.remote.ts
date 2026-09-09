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
			throw error(400, (err as Error).message || 'Something went wrong.');
		}
	}
);
