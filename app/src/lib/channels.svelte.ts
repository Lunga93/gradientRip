// Channels client state — plain fetch + Svelte 5 runes, mirroring the
// SocialState class shape in social.svelte.ts. Consumed by Task 6 events
// and the Task 8 feed.
export interface Channel {
	id: string;
	name: string;
	visibility: 'open' | 'private';
	sport: string | null;
	home_area: string | null;
	about: string | null;
	avatar_key: string | null;
	created_at: string;
	is_member: boolean;
	is_admin: boolean;
	member_count: number;
}

export interface RosterMember {
	user_id: string;
	display_name: string;
	avatar_url: string | null;
	role: 'admin' | 'member';
	joined_at: string;
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

	async joinWithInvite(
		id: string,
		invite: string
	): Promise<{ ok: boolean; message: string }> {
		this.lastError = '';
		try {
			const resp = await fetch(`/api/channels/${encodeURIComponent(id)}/join`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ invite })
			});
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

	async roster(
		id: string
	): Promise<{ ok: boolean; message: string; members: RosterMember[] }> {
		this.lastError = '';
		try {
			const resp = await fetch(`/api/channels/${encodeURIComponent(id)}/members`);
			const data = (await resp.json().catch(() => ({}))) as {
				members?: RosterMember[];
				message?: string;
			};
			if (!resp.ok) {
				const message = typeof data.message === 'string' ? data.message : 'Could not load the roster';
				this.lastError = message;
				return { ok: false, message, members: [] };
			}
			return { ok: true, message: 'Roster loaded', members: data.members ?? [] };
		} catch {
			const message = 'You appear to be offline';
			this.lastError = message;
			return { ok: false, message, members: [] };
		}
	}

	private async adminAction(
		id: string,
		userId: string,
		action: 'promote' | 'demote' | 'remove',
		successMessage: string,
		failureMessage: string
	): Promise<{ ok: boolean; message: string }> {
		this.lastError = '';
		try {
			const resp = await fetch(`/api/channels/${encodeURIComponent(id)}/members`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: userId, action })
			});
			const data = (await resp.json().catch(() => ({}))) as { message?: string };
			if (!resp.ok) {
				const message = typeof data.message === 'string' ? data.message : failureMessage;
				this.lastError = message;
				return { ok: false, message };
			}
			await this.list();
			return { ok: true, message: successMessage };
		} catch {
			const message = 'You appear to be offline';
			this.lastError = message;
			return { ok: false, message };
		}
	}

	async promote(id: string, userId: string): Promise<{ ok: boolean; message: string }> {
		return this.adminAction(id, userId, 'promote', 'Promoted to admin', 'Could not promote');
	}

	async demote(id: string, userId: string): Promise<{ ok: boolean; message: string }> {
		return this.adminAction(id, userId, 'demote', 'Demoted to member', 'Could not demote');
	}

	async removeMember(id: string, userId: string): Promise<{ ok: boolean; message: string }> {
		return this.adminAction(id, userId, 'remove', 'Removed from crew', 'Could not remove');
	}

	async leave(id: string, userId: string): Promise<{ ok: boolean; message: string }> {
		return this.adminAction(id, userId, 'remove', 'You left the crew', 'Could not leave');
	}

	async mintInvite(
		id: string
	): Promise<{ ok: boolean; message: string; invite_token: string | null }> {
		this.lastError = '';
		try {
			const resp = await fetch(`/api/channels/${encodeURIComponent(id)}/invite`, {
				method: 'POST'
			});
			const data = (await resp.json().catch(() => ({}))) as {
				invite_token?: string;
				message?: string;
			};
			if (!resp.ok) {
				const message =
					typeof data.message === 'string' ? data.message : 'Could not create the invite link';
				this.lastError = message;
				return { ok: false, message, invite_token: null };
			}
			const invite_token = typeof data.invite_token === 'string' ? data.invite_token : null;
			if (!invite_token) {
				const message = 'Could not create the invite link';
				this.lastError = message;
				return { ok: false, message, invite_token: null };
			}
			return { ok: true, message: 'Invite link ready', invite_token };
		} catch {
			const message = 'You appear to be offline';
			this.lastError = message;
			return { ok: false, message, invite_token: null };
		}
	}

	async revokeInvite(id: string): Promise<{ ok: boolean; message: string }> {
		this.lastError = '';
		try {
			const resp = await fetch(`/api/channels/${encodeURIComponent(id)}/invite`, {
				method: 'DELETE'
			});
			const data = (await resp.json().catch(() => ({}))) as { message?: string };
			if (!resp.ok) {
				const message = typeof data.message === 'string' ? data.message : 'Could not revoke the invite link';
				this.lastError = message;
				return { ok: false, message };
			}
			return { ok: true, message: 'Invite link revoked' };
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

	async update(
		id: string,
		patch: { name?: string; about?: string | null; avatar_key?: string | null }
	): Promise<{ ok: boolean; message: string }> {
		this.lastError = '';
		try {
			const resp = await fetch(`/api/channels/${encodeURIComponent(id)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(patch)
			});
			const data = (await resp.json().catch(() => ({}))) as { message?: string };
			if (!resp.ok) {
				const message = typeof data.message === 'string' ? data.message : 'Could not save the crew';
				this.lastError = message;
				return { ok: false, message };
			}
			await this.list();
			return { ok: true, message: 'Crew updated' };
		} catch {
			const message = 'You appear to be offline';
			this.lastError = message;
			return { ok: false, message };
		}
	}

	async remove(id: string): Promise<{ ok: boolean; message: string }> {
		this.lastError = '';
		try {
			const resp = await fetch(`/api/channels/${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});
			const data = (await resp.json().catch(() => ({}))) as { message?: string };
			if (!resp.ok) {
				const message = typeof data.message === 'string' ? data.message : 'Could not delete the crew';
				this.lastError = message;
				return { ok: false, message };
			}
			await this.list();
			return { ok: true, message: 'Crew deleted' };
		} catch {
			const message = 'You appear to be offline';
			this.lastError = message;
			return { ok: false, message };
		}
	}
}

export const channels = new ChannelsState();
