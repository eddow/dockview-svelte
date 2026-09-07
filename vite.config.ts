import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Target Vercel for the demo deploy. `build` (npmjs) still only
			// packages the library via svelte-package; `build:demo` is the
			// Vercel entrypoint. See https://svelte.dev/docs/kit/adapters.
			adapter: adapter()
		})
	]
});
