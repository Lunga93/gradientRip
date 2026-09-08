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
			.then((cache) => cache.addAll(ASSETS))
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

function isNeverCache(url) {
	// Routing and geocoding — always go to network, never served from cache.
	return (
		url.hostname.includes('nominatim.openstreetmap.org') ||
		url.hostname.includes('routing.openstreetmap.de') ||
		url.hostname.includes('router.project-osrm.org') ||
		url.hostname.includes('photon.komoot.io')
	);
}

function isTerrain(url) {
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
	event.respondWith(
		fetch(event.request)
			.then((resp) => {
				const copy = resp.clone();
				caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
				return resp;
			})
			.catch(() => caches.match(event.request))
	);
});
