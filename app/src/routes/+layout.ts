// Client-only app: the page drives Leaflet + geolocation + localStorage.
// Data services live in server boundaries (src/lib/server, src/routes/api),
// reached through the typed remote command (planRoute) and /api/* fetches.
export const ssr = false;