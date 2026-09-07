<script lang="ts">
import { highlight } from './highlight.js'

interface Props {
	code: string
	lang?: 'svelte' | 'typescript'
	title?: string
}

let { code, lang = 'svelte', title = 'Code' }: Props = $props()

let html = $state('<pre><code>loading…</code></pre>')

$effect(() => {
	let cancelled = false
	highlight(code, lang).then((h) => {
		if (!cancelled) html = h
	})
	return () => {
		cancelled = true
	}
})
</script>

<details class="code" open>
	<summary>{title}</summary>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<div class="code__body">{@html html}</div>
</details>

<style>
	.code {
		border: 1px solid #30363d;
		border-radius: 6px;
		background: #0d1117;
		color: #e6edf3;
	}
	.code summary {
		cursor: pointer;
		padding: 0.5rem 0.75rem;
		font-weight: 600;
	}
	.code__body {
		overflow: auto;
		max-height: 24rem;
	}
	.code__body :global(pre) {
		margin: 0;
		padding: 0.75rem;
		tab-size: 2;
	}
</style>
