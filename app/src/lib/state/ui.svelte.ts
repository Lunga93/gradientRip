
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
	activeTab = $state<'plan' | 'saved' | 'ride' | 'channels' | 'friends'>('plan');
	isMobile = $state(false);
	panelVisible = $state(true);

	statusMsg = $state('');
	statusErr = $state(false);

	statusBusy = $derived(!!this.statusMsg && !this.statusErr);

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

	setTab(tab: 'plan' | 'saved' | 'ride' | 'channels' | 'friends') {
		this.activeTab = tab;
	}

	setTheme(pref: ThemePref) {
		this.theme = pref;
		saveThemePref(pref);
		if (pref === 'dark') document.documentElement.setAttribute('data-theme', 'gradient-dark');
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
