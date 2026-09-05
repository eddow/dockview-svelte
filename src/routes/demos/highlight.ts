import { createHighlighter, type Highlighter } from 'shiki'

let highlighter: Highlighter | undefined

/** Shared Shiki instance (github-dark, svelte + ts). Created once, reused. */
export async function getHighlighter(): Promise<Highlighter> {
	if (!highlighter) {
		highlighter = await createHighlighter({
			themes: ['github-dark'],
			langs: ['svelte', 'typescript'],
		})
	}
	return highlighter
}

/** Highlight `code` to HTML (display-only, no editor). */
export async function highlight(code: string, lang: 'svelte' | 'typescript'): Promise<string> {
	const h = await getHighlighter()
	return h.codeToHtml(code, { lang, theme: 'github-dark' })
}
