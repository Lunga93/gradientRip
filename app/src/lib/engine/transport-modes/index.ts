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
	eskate:
		'<svg viewBox="0 0 52 27" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 14C7 10 11 9.5 14 9.5h24c3 0 7 .5 9 4.5" stroke-width="2.5"/><path d="M47 14c1.2 1.2 1.2 2.5 0 3M5 14c-1.2 1.2-1.2 2.5 0 3" stroke-width="2"/><path d="M11 9.5v6M41 9.5v6" stroke-width="1.8" opacity=".55"/><path d="M8 15h6M38 15h6" stroke-width="2.8"/><circle cx="9.5" cy="21.5" r="4" stroke-width="2.2"/><circle cx="42.5" cy="21.5" r="4" stroke-width="2.2"/><circle cx="9.5" cy="21.5" r="1" fill="currentColor" stroke="none"/><circle cx="42.5" cy="21.5" r="1" fill="currentColor" stroke="none"/></svg>',
	push: '<svg viewBox="0 0 52 26" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13C7 9.5 11 9 14 9h24c3 0 7 .5 9 4" stroke-width="2.5"/><path d="M11 9v5.5M41 9v5.5" stroke-width="1.8" opacity=".45"/><path d="M8 14h6M38 14h6" stroke-width="2.6"/><circle cx="9.5" cy="20.5" r="3.8" stroke-width="2.2"/><circle cx="42.5" cy="20.5" r="3.8" stroke-width="2.2"/></svg>',
	ebike:
		'<svg viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="28" r="9" stroke-width="2.2"/><circle cx="40" cy="28" r="9" stroke-width="2.2"/><circle cx="12" cy="28" r="2.5" fill="currentColor" stroke="none"/><circle cx="40" cy="28" r="2.5" fill="currentColor" stroke="none"/><path d="M40 28L26 11 12 28" stroke-width="2.2"/><path d="M26 11v7M22 18h8" stroke-width="2"/><path d="M40 28l-8-6" stroke-width="2"/><circle cx="33" cy="11" r="3.5" stroke-width="1.8"/><path d="M26 11h7" stroke-width="1.8" opacity=".6"/></svg>',
	bike: '<svg viewBox="0 0 52 40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="28" r="9" stroke-width="2.2"/><circle cx="40" cy="28" r="9" stroke-width="2.2"/><path d="M40 28L26 10 12 28" stroke-width="2.2"/><path d="M26 10v7M21 17h10" stroke-width="2"/><circle cx="26" cy="26" r="4" stroke-width="1.8"/><path d="M26 22v4M22 28l4-2M30 28l-4-2" stroke-width="1.5" opacity=".6"/></svg>',
	scooter:
		'<svg viewBox="0 0 44 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="36" cy="38" r="8" stroke-width="2.2"/><circle cx="10" cy="38" r="5.5" stroke-width="2.2"/><circle cx="36" cy="38" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="38" r="1.5" fill="currentColor" stroke="none"/><path d="M10 38V16l18-10h8v16l-26 10" stroke-width="2.2"/><path d="M32 6h8" stroke-width="2.8"/><path d="M36 22v8" stroke-width="2" opacity=".55"/><rect x="22" y="14" width="12" height="8" rx="2" stroke-width="1.8" opacity=".6"/></svg>',
	kick: '<svg viewBox="0 0 44 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="36" cy="38" r="8" stroke-width="2.2"/><circle cx="10" cy="38" r="5.5" stroke-width="2.2"/><circle cx="36" cy="38" r="2" fill="currentColor" stroke="none"/><path d="M10 38V16l18-10h8v22l-26 6" stroke-width="2.2"/><path d="M32 6h8" stroke-width="2.8"/></svg>',
	euc: '<svg viewBox="0 0 36 46" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="30" r="14" stroke-width="2.2"/><circle cx="18" cy="30" r="4" stroke-width="1.8"/><rect x="11" y="8" width="14" height="18" rx="3" stroke-width="2"/><path d="M14 26h8M14 16h8" stroke-width="1.5" opacity=".5"/></svg>'
};