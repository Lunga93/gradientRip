// Channels client state — plain fetch + Svelte 5 runes, mirroring the
// SocialState class shape in social.svelte.ts. Consumed by Task 6 events
// and the Task 8 feed.
export interface Channel {
	id: string;
	name: string;
	visibility: 'open' | 'private';
	sport: string | null;
	home_area: string | null;
	created_at: string;
	is_member: boolean;
	member_count: number;
}

class ChannelsState {
	channels = $state<Channel[]>([]);
	lastError = $state('');
	loading = $state(false);

	readonly open = $derived(this.channels.filter((c) => c.visibility === 'open'));
	readonly mine = $derived(this.channels.filter((c) => c.is_member));
	readonly count = $derived(this.channels.length);

	channelFor(id: string): Channel | undefined {
		return this.channels.find((c) => c.id === id);
	}

	async list(): Promise<void> {
		this.loading = true;
		try {
			const resp = await fetch('/api/channels');
			if (!resp.ok) return;
			const data = (await resp.json()) as { channels: Channel[] };
			this.channels = data.channels;
		} catch {
			/* offline — keep last known list */
		} finally {
			this.loading = false;
		}
	}

	async join(id: string): Promise<{ ok: boolean; message: string }> {
		this.lastError = '';
		try {
			const resp = await fetch(`/api/channels/${encodeURIComponent(id)}/join`, { method: 'POST' });
			const data = (await resp.json().catch(() => ({}))) as { message?: string };
			if (!resp.ok) {
				const message = typeof data.message === 'string' ? data.message : 'Could not join the channel';
				this.lastError = message;
				return { ok: false, message };
			}
			await this.list();
			return { ok: true, message: 'Joined channel' };
		} catch {
			const message = 'You appear to be offline';
			this.lastError = message;
			return { ok: false, message };
		}
	}

	async create(
		name: string,
		visibility: 'open' | 'private',
		opts: { sport?: string; home_area?: string } = {}
	): Promise<{ ok: boolean; message: string }> {
		this.lastError = '';
		try {
			const resp = await fetch('/api/channels', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, visibility, ...opts })
			});
			const data = (await resp.json().catch(() => ({}))) as { message?: string };
			if (!resp.ok) {
				const message = typeof data.message === 'string' ? data.message : 'Could not create the channel';
				this.lastError = message;
				return { ok: false, message };
			}
			await this.list();
			return { ok: true, message: 'Channel created' };
		} catch {
			const message = 'You appear to be offline';
			this.lastError = message;
			return { ok: false, message };
		}
	}
}

export const channels = new ChannelsState();
