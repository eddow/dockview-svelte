import { defineConfig } from 'vitest/config'
import { sveltekit } from '@sveltejs/kit/vite'

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		// Resolve `svelte` to its client build in jsdom, so component tests can
		// `mount` real Svelte 5 components (the default node condition resolves
		// to the SSR build, whose `mount` throws).
		conditions: ['browser'],
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		// `tests/install` is a separate consumer project (own package.json +
		// node_modules) — never pick it up in the main suite, at least on CI.
		exclude: ['**/node_modules/**', '**/dist/**', 'tests/install/**/*'],
		environment: 'jsdom',
	},
})
