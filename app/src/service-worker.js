// Gradient — service worker (SvelteKit build).
// Rule (see ../SPEC.md "Constraints"): tiles and elevation cache permanently
// (terrain height doesn't change). Routing and geocoding responses must
// NEVER be cached — a cached route can hide a closed road.

/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const self = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (globalThis));

// Unique cache name per deployment — replaces the legacy hand-bumped
// 'gradient-static-v17' (SvelteKit invalidates via the version string).
const STATIC_CACHE = `gradient-static-${version}`;
const TERRAIN_CACHE = 'gradient-terrain-v1';

const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(STATIC_CACHE)
			.then((cache) => cache.addAll(ASSETS).catch(() => {}))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== TERRAIN_CACHE).map((k) => caches.delete(k)))
			)
			.then(() => self.clients.claim())
	);
});

const isNeverCache = (url) => {
	// Our own /api/autocomplete endpoint (it proxies Photon) plus the
	// direct provider hosts — always go to network when used. Remote
	// functions (plan/geo) are POSTs and bypass via the method check below.
	if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return true;
	return (
		url.hostname.includes('nominatim.openstreetmap.org') ||
		url.hostname.includes('routing.openstreetmap.de') ||
		url.hostname.includes('router.project-osrm.org') ||
		url.hostname.includes('photon.komoot.io')
	);
}

const isTerrain = (url) => {
	// Map tiles and elevation — safe to cache forever.
	return (
		url.hostname.includes('tile.openstreetmap.org') ||
		url.hostname.includes('api.open-meteo.com')
	);
}

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	if (event.request.method !== 'GET') return;

	if (isNeverCache(url)) {
		event.respondWith(fetch(event.request));
		return;
	}

	if (isTerrain(url)) {
		event.respondWith(
			caches.open(TERRAIN_CACHE).then(async (cache) => {
				const cached = await cache.match(event.request);
				if (cached) return cached;
				const resp = await fetch(event.request);
				if (resp.ok) cache.put(event.request, resp.clone());
				return resp;
			})
		);
		return;
	}

	// App shell: network-first so edits during development (and future
	// deploys) show up immediately, falling back to cache only when offline.
	// Only cache successful responses — never persist error pages.
	// Navigations fall back to the cached shell root for the ssr=false app.
	event.respondWith(
		fetch(event.request)
			.then((resp) => {
				if (resp.ok) {
					const copy = resp.clone();
					caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
				}
				return resp;
			})
			.catch(async () => {
				const cached = await caches.match(event.request);
				if (cached) return cached;
				if (event.request.mode === 'navigate') {
					const shell = await caches.match('/');
					if (shell) return shell;
				}
				throw new Error('offline');
			})
	);
});
