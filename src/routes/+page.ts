import { redirect } from '@sveltejs/kit'

/** The gallery has no index content — land directly on a complete demo. */
export function load(): never {
	throw redirect(307, '/demos/basic')
}
