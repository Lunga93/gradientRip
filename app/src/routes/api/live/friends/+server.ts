// GET /api/live/friends — Server-Sent Events feed of accepted friends'
// recent positions plus the pending-request count. Polls the DB every 4s;
// riders older than LIVE_STALE_MS drop out of the payload automatically.
// EventSource sends same-origin cookies, so requireAuth just works.
import type { RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { listFriends, listPending } from '$lib/server/friends.js';
import { classifyFreshness } from '$lib/server/live.js';

const POLL_MS = 4000;

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);

	const stream = new ReadableStream({
		async start(controller) {
			const enc = new TextEncoder();
			let closed = false;
			const close = (): void => {
				if (closed) return;
				closed = true;
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			};
			event.request.signal.addEventListener('abort', close);

			const send = (payload: unknown): void => {
				if (closed) return;
				try {
					controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
				} catch {
					close();
				}
			};

			send({ type: 'hello', ts: Date.now() });
			while (!closed) {
				try {
					const snapshot = await withUser(me.id, async (c) => ({
						friends: (await listFriends(c))
							.map((f) => ({
								id: f.id,
								display_name: f.display_name,
								avatar_url: f.avatar_url,
								lat: f.lat,
								lon: f.lon,
								speed: f.speed,
								live_at: f.live_at,
								freshness: classifyFreshness(f.live_at)
							}))
							.filter((f) => f.freshness !== null),
						incoming: (await listPending(c, true)).length
					}));
					send({ type: 'friends', ts: Date.now(), ...snapshot });
				} catch {
					// DB hiccup mid-stream — heartbeat so the client knows we're alive.
					send({ type: 'ping', ts: Date.now() });
				}
				await new Promise((r) => setTimeout(r, POLL_MS));
				if (event.request.signal.aborted) close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-store',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
