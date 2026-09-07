<script lang="ts">
import 'dockview/dist/styles/dockview.css'
import '../app.css'
import { Orientation } from 'dockview'
import type { Snippet } from 'svelte'
import { onMount } from 'svelte'
import { page } from '$app/state'
import { DvWidget, Splitview, type SplitviewHandle } from '$lib/index.js'
import Code from './demos/Code.svelte'

let { children: pageChildren }: { children: Snippet } = $props()

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
	'/demos/declarative': [],
}

let pathname = $derived(page.url.pathname)
let pageSource = $derived(pageSources[`.${pathname}/+page.svelte`])
let widgetCodes = $derived(
	(demoWidgets[pathname] ?? [])
		.map((file) => ({ file, code: widgetSources[`./demos/_widgets/${file}`] }))
		.filter((w) => w.code)
)

// Demo/code split: demo on the left, source on the right. The code pane
// starts hidden but pre-sized to 50% — `setVisible` caches the size and
// restores it on re-show, so "Show code" lands on a 50/50 split. The layout
// persists across demo navigation, so the panes are opened once and the
// code visibility survives route changes.
let splitHandle = $state<SplitviewHandle | undefined>(undefined)
let codeVisible = $state(false)
let opened = false

function toggleCode(): void {
	if (!splitHandle) return
	// Don't flip `codeVisible` here — `api.setVisible` fires
	// `onDidVisibilityChange` synchronously, and the `$effect` below syncs
	// `codeVisible` from it. A manual flip would read the already-updated
	// value and flip it straight back.
	splitHandle.setVisible('code', !codeVisible)
}

// Keep the toggle in sync when the code pane is hidden/shown through any
// other path (sash snap, api escape hatch). Subscribed once the panels exist
// — a `$effect` on `splitHandle` alone would run before `onMount` opens the
// panels (`getPanel` → undefined) and never re-run, missing every event.
let visibilityDisposable: { dispose(): void } | undefined

function syncCodeVisible(): void {
	visibilityDisposable?.dispose()
	const code = splitHandle?.api.getPanel('code')
	if (!code) return
	visibilityDisposable = code.api.onDidVisibilityChange((event) => {
		codeVisible = event.isVisible
	})
}

onMount(() => {
	// `splitHandle` is bound by the child `<Splitview>` (child `onMount`
	// runs before the parent's), but guard anyway and open exactly once.
	if (opened || !splitHandle) return
	opened = true
	// Seed one frame past layout: dockview's `Resizable` only learns the
	// container size on its first `ResizeObserver` pass. Panels opened
	// while the splitview still measures 0px keep a 0px first pane —
	// `Sizing.Distribute` divides the then-current size and
	// `proportionalLayout` locks in the split forever.
	const seed = () => {
		if ((splitHandle?.api.width ?? 0) <= 0) {
			requestAnimationFrame(seed)
			return
		}
		// No explicit `size`: both panes default to `Sizing.Distribute`,
		// so the code pane is pre-sized to 50% even while hidden —
		// `setVisible(false)` caches that size and `setVisible(true)`
		// restores it, so "Show code" lands on a 50/50 split.
		// `proportionalLayout` keeps the ratio on window resizes.
		splitHandle!.openPanel('demo', { id: 'demo', minimumSize: 200 })
		splitHandle!.openPanel('code', { id: 'code', minimumSize: 280 })
		// Hidden by default, but with its 50% width already configured.
		splitHandle!.setVisible('code', false)
		codeVisible = false
		syncCodeVisible()
	}
	requestAnimationFrame(seed)
})
</script>

<div class="shell">
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

	<div class="toolbar">
		<button onclick={toggleCode} aria-expanded={codeVisible} aria-controls="demo-source">
			{codeVisible ? 'Hide code' : 'Show code'}
		</button>
		<span class="toolbar__hint"
			>demo on the left, source on the right — drag the sash to resize</span
		>
	</div>

	<main class="split-wrap">
		<Splitview
			bind:handle={splitHandle}
			options={{ orientation: Orientation.HORIZONTAL, proportionalLayout: true }}
		>
			<DvWidget name="demo">
				{#snippet children()}
					<div class="pane-scroll">
						{@render pageChildren()}
					</div>
				{/snippet}
			</DvWidget>
			<DvWidget name="code">
				{#snippet children()}
					<div class="pane-scroll" id="demo-source">
						{#if pageSource}
							<section class="code-stack" aria-label="Demo source">
								<Code code={pageSource} title="+page.svelte" />
								{#each widgetCodes as { file, code } (file)}
									<Code {code} title={file} />
								{/each}
							</section>
						{:else}
							<p>Loading source…</p>
						{/if}
					</div>
				{/snippet}
			</DvWidget>
		</Splitview>
	</main>
</div>

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
	.shell {
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}
	.toolbar {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		padding: 0.4rem 1rem;
		border-bottom: 1px solid #30363d;
		background: #0d1117;
		color: #e6edf3;
	}
	.toolbar button {
		cursor: pointer;
		border: 1px solid #30363d;
		border-radius: 6px;
		background: #161b22;
		color: inherit;
		padding: 0.25rem 0.75rem;
	}
	.toolbar__hint {
		opacity: 0.7;
		font-size: 0.85rem;
	}
	.split-wrap {
		flex: 1;
		min-height: 0;
		/* Dockview sashes default to transparent — give the demo/code
		divider a resting color visible against both the light demo pane
		and the dark code pane, plus an instant hover highlight. */
		--dv-sash-color: #8b949e;
		--dv-active-sash-color: #1f6feb;
		--dv-active-sash-transition-delay: 0s;
		--dv-separator-border: #8b949e;
	}
	.pane-scroll {
		height: 100%;
		overflow: auto;
		padding: 1rem;
		box-sizing: border-box;
	}
	.code-stack {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
