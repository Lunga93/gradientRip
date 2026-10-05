// Plain-Node stand-in for SvelteKit's `$env/dynamic/private`, for the tsx
// worker ONLY. SvelteKit serves `$env/dynamic/private` itself under vite
// dev/build; tsx has no such virtual module, so tsconfig.worker.json maps the
// specifier here, where env is just process.env (the same fallback the media
// module already uses). Never import this file from SvelteKit code — import
// `$env/dynamic/private` directly there.
export const env: Record<string, string | undefined> = process.env;
