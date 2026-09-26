import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	},
	// Component tests run in a DOM (happy-dom per file). Resolve the client
	// build of `svelte` under Vitest so @testing-library/svelte gets `mount`.
	...(process.env.VITEST ? { resolve: { conditions: ['browser'] } } : {})
});
