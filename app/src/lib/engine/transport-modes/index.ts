import type { Mode } from '../plan-packet/types.js';
import { eskate } from './eskate.js';
import { ebike } from './ebike.js';
import { scooter } from './scooter.js';
import { euc } from './euc.js';
import { pushSkate } from './push-skate.js';
import { pedalBike } from './pedal-bike.js';
import { kickScooter } from './kick-scooter.js';

export const MODES: Record<string, Mode> = {
	eskate,
	ebike,
	scooter,
	euc,
	push: pushSkate,
	bike: pedalBike,
	kick: kickScooter
};

export const MODE_ICONS: Record<string, string> = {
	eskate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="11" width="20" height="2.5" rx="1.2"/><circle cx="6" cy="17" r="1.8"/><circle cx="18" cy="17" r="1.8"/><path d="M7 11v-2.5M17 11v-2.5"/></svg>',
	push: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="10.5" width="20" height="2.5" rx="1.2"/><circle cx="5.5" cy="17" r="1.8"/><circle cx="18.5" cy="17" r="1.8"/><path d="M7 10.5V8M17 10.5V8"/></svg>',
	ebike: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path d="M6 17l4-7h3l2 4h2.5l2-5h-2l-1.5 3.5H13l-1-2.5h-2l1 2.5H6z"/><rect x="9.5" y="10.5" width="2.5" height="1.5" rx="0.3" fill="currentColor" stroke="none"/></svg>',
	bike: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M7 12.5L8.5 9.5M8.5 9.5H16M8.5 9.5L10.5 16.5L16 9.5M8.5 9.5L7.5 7M16 9.5L17 12.5M16 9.5L15.5 8.5L18.5 8V9.5M9 15.5C9 17.433 7.433 19 5.5 19C3.567 19 2 17.433 2 15.5C2 13.567 3.567 12 5.5 12C7.433 12 9 13.567 9 15.5Z"/></svg>',
	scooter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M7 17V10l3-4h7l2 5.5"/><path d="M10 10l2-2.5"/></svg>',
	kick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path d="M6 17l3-7h6l2 5"/><path d="M12 10l2-2.5"/></svg>',
	euc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="15" r="5"/><path d="M12 6v4M9 8l3-2 3 2M8 15h8"/></svg>'
};