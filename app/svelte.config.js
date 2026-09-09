import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		experimental: {
			// typed remote `command` for the plan pipeline — replaces the
			// form-action + use:enhance plumbing (flag stable enough in 2.70)
			remoteFunctions: true
		}
	}
};

export default config;