import { redirect } from '@sveltejs/kit';

// Index is a bare redirect to /home — except it must carry the OAuth
// callback params through: /?login=ok lands here cold (Google 302s to a
// full document load), and the root layout's onMount login handling only
// ever runs on the mounted /home boot. Dropping the query would swallow
// both the welcome status and the stashed crew-invite return trip.
// Narrow: only login/reason survive, nothing else.
export const load = ({ url }) => {
	const login = url.searchParams.get('login');
	const reason = url.searchParams.get('reason');
	const next = new URLSearchParams();
	if (login === 'ok' || login === 'error') next.set('login', login);
	if (login === 'error' && reason) next.set('reason', reason);
	const qs = next.size ? `?${next}` : '';
	throw redirect(307, `/home${qs}`);
};
