// UI chrome state — theme, legal note, net status, plan status.
// No ride data, no GPS session.

import {
	loadLegalDismissed,
	setLegalDismissed,
	clearLegalDismissed,
	loadThemePref,
	saveThemePref
} from '../storage.js';
import type { ThemePref } from '../storage.js';

class UiState {
	netOnline = $state(true);
	legalDismissed = $state(loadLegalDismissed());
	theme = $state<ThemePref>(loadThemePref());
	isMobile = $state(false);

	statusMsg = $state('');
	statusErr = $state(false);

	// --- derived ---
	statusBusy = $derived(!!this.statusMsg && !this.statusErr);

	// --- actions ---
	dismissLegal() {
		this.legalDismissed = true;
		setLegalDismissed();
	}

	restoreLegal() {
		this.legalDismissed = false;
		clearLegalDismissed();
	}

	// Cycles auto → light → dark (the toggle in the header). Persists the
	// choice; the pre-paint script in app.html applies it before first paint.
	setTheme(pref: ThemePref) {
		this.theme = pref;
		saveThemePref(pref);
		// Light = no attribute (the :root default); dark toggles the override.
		if (pref === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
		else document.documentElement.removeAttribute('data-theme');
	}

	cycleTheme() {
		this.setTheme(this.theme === 'auto' ? 'light' : this.theme === 'light' ? 'dark' : 'auto');
	}

	setStatus(msg: string, isErr = false) {
		const busy = !!(msg && !isErr);
		this.statusMsg = busy ? msg.replace(/…+$/, '') : msg;
		this.statusErr = isErr;
	}
}

export const ui = new UiState();
