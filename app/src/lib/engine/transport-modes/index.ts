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
	eskate: '<svg viewBox="0 0 24 24"><path d="M2 16.5h18.5v2H2zM6 18.5a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6zm12 0a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6zM13 2l-2.2 9.5H4.5L6 14h6l2.4-9.5z"/></svg>',
	ebike: '<svg viewBox="0 0 24 24"><path d="M5.5 17.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm13 0a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM5 10h4l2.5 6H9.8L8 12H6v9H4v-9c0-1.1.9-2 2-2zm11-4h-3v2h3v4l5 7v-2.4l-3.7-5.1V8H18V6z"/></svg>',
	scooter: '<svg viewBox="0 0 24 24"><path d="M12 2v8.5L6.5 20H4l6-9.5V4H8V2h4zm3 0v2h4.5l2 6H19l-1.6-4.5H15V14h6v-2.3l2.3 5.3H4v2h20v-2h-2.6L19 10V4h-4V2h-3zM7 20a2 2 0 100 4 2 2 0 000-4z"/></svg>',
	euc: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 3a6 6 0 110 12 6 6 0 010-12zm0 3a3 3 0 100 6 3 3 0 000-6z"/></svg>',
	push: '<svg viewBox="0 0 24 24"><path d="M2 15.5h18v2H2zM5 17.5a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6zm14 0a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6zM12 2c-1 3.5-2.5 6-4.5 8.5l1.7 1.5C10.7 10.2 11.8 8 12.6 5l3.9 7H19l-4.5-8.5c-.8-1-1.7-1.5-2.5-1.5z"/></svg>',
	bike: '<svg viewBox="0 0 24 24"><path d="M5.5 16.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm13 0a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM12 4a1 1 0 011 1v3.6l3.5 5.9h-2.2L11.5 10H8.7l1.9 4.5H8.4L5.5 9.6 7.2 8.4l1.6 2.7 1-2.7V5a1 1 0 011-1h1.2zM14.5 2v2H17v2h-2.5v2h-2V6H10V4h2.5V2h2z"/></svg>',
	kick: '<svg viewBox="0 0 24 24"><path d="M13 2v3h5l3 9h-2.1l-2.4-7H13v13h4v2H5v-2h6V4H8V2h5zm-6 16a2 2 0 100 4 2 2 0 000-4zm12 0a2 2 0 100 4 2 2 0 000-4z"/></svg>'
};