// UI chrome state — panel, tabs, theme, legal note, net status, plan status.
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
	sheetOpen = $state(false);
	legalDismissed = $state(loadLegalDismissed());
	theme = $state<ThemePref>(loadThemePref());
	activeTab = $state<'plan' | 'saved' | 'ride'>('plan');
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

	setSheet(open: boolean) {
		this.sheetOpen = open;
	}

	setTab(tab: 'plan' | 'saved' | 'ride') {
		this.activeTab = tab;
	}

	// Cycles auto → light → dark (the toggle in the header). Persists the
	// choice; the pre-paint script in app.html applies it before first paint.
	setTheme(pref: ThemePref) {
		this.theme = pref;
		saveThemePref(pref);
		const el = document.documentElement;
		if (pref === 'light') el.setAttribute('data-theme', 'gradient');
		else if (pref === 'dark') el.setAttribute('data-theme', 'gradient-dark');
		else el.removeAttribute('data-theme');
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
