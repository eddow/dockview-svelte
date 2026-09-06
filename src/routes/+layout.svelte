<script lang="ts">
import 'dockview/dist/styles/dockview.css'
import '../app.css'
import type { Snippet } from 'svelte'
import { page } from '$app/state'
import Code from './demos/Code.svelte'

let { children }: { children: Snippet } = $props()

const demos = [
	{ href: '/demos/basic', label: 'Basic: open a widget' },
	{ href: '/demos/params', label: 'Reactive params (two-way)' },
	{ href: '/demos/custom-tab', label: 'Custom tab + shared state' },
	{ href: '/demos/layout', label: 'Save / restore bind:layout' },
	{ href: '/demos/themes', label: 'Themes' },
	{ href: '/demos/events', label: 'bind:active + events' },
	{ href: '/demos/empty', label: 'Empty state (watermark)' },
	{ href: '/demos/floating', label: 'Floating groups' },
	{ href: '/demos/splitview', label: 'Splitview' },
	{ href: '/demos/gridview', label: 'Gridview' },
	{ href: '/demos/paneview', label: 'Paneview' },
	{ href: '/demos/declarative', label: 'Declarative widgets' },
] as const

const pageSources = import.meta.glob('./demos/*/+page.svelte', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>

const widgetSources = import.meta.glob('./demos/_widgets/*.svelte', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>

const demoWidgets: Record<string, string[]> = {
	'/demos/basic': ['BasicPanel.svelte'],
	'/demos/params': ['CounterPanel.svelte'],
	'/demos/custom-tab': ['InboxPanel.svelte', 'BadgeTab.svelte'],
	'/demos/layout': ['BasicPanel.svelte'],
	'/demos/themes': ['BasicPanel.svelte'],
	'/demos/events': ['BasicPanel.svelte'],
	'/demos/empty': ['BasicPanel.svelte', 'EmptyWatermark.svelte'],
	'/demos/floating': ['BasicPanel.svelte', 'GroupHeaderActions.svelte', 'PanelHeaderTab.svelte'],
	'/demos/splitview': ['SplitPanel.svelte'],
	'/demos/gridview': ['GridCell.svelte'],
	'/demos/paneview': ['PaneBody.svelte', 'PaneHeader.svelte'],
	'/demos/declarative': ['BasicPanel.svelte'],
}

let pathname = $derived(page.url.pathname)
let pageSource = $derived(pageSources[`.${pathname}/+page.svelte`])
let widgetCodes = $derived(
	(demoWidgets[pathname] ?? [])
		.map((file) => ({ file, code: widgetSources[`./demos/_widgets/${file}`] }))
		.filter((w) => w.code)
)
</script>

<header>
	<nav aria-label="Demos">
		<a href="/">dockview-svelte</a>
		<ul>
			{#each demos as demo (demo.href)}
				<li><a href={demo.href}>{demo.label}</a></li>
			{/each}
		</ul>
	</nav>
</header>

<main>
	{@render children()}

	{#if pageSource}
		<section aria-label="Demo source">
			<Code code={pageSource} title="+page.svelte" />
			{#each widgetCodes as { file, code } (file)}
				<Code {code} title={file} />
			{/each}
		</section>
	{/if}
</main>

<style>
	header {
		border-bottom: 1px solid #30363d;
		background: #0d1117;
		color: #e6edf3;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 1rem;
		flex-wrap: wrap;
	}
	nav > a {
		font-weight: 700;
		color: inherit;
		text-decoration: none;
	}
	ul {
		display: flex;
		gap: 0.75rem;
		list-style: none;
		margin: 0;
		padding: 0;
		flex-wrap: wrap;
	}
	ul a {
		color: inherit;
		opacity: 0.85;
	}
	main {
		padding: 1rem;
	}
</style>
