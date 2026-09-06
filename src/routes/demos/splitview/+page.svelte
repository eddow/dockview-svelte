<script lang="ts">
	import { type ISplitviewPanel, Orientation } from 'dockview'
	import { defineSplitviewWidgets, Splitview, type SplitviewHandle } from '$lib/index.js'
	import SplitPanel from '../_widgets/SplitPanel.svelte'

	const widgets = defineSplitviewWidgets({
		a: { component: SplitPanel },
		b: { component: SplitPanel }
	})

	let handle = $state<SplitviewHandle<typeof widgets> | undefined>(undefined)
	let orientation = $state<Orientation>(Orientation.HORIZONTAL)
	let views = $state<ISplitviewPanel[]>([])
	let activeView = $state<ISplitviewPanel | undefined>(undefined)

	// Seed one frame past `onReady`: dockview's `Resizable` only learns the
	// container size on its first `ResizeObserver` pass (dispatched through
	// `requestAnimationFrame`). Panels opened while the splitview still measures
	// 0px keep a 0px first pane — `Sizing.Distribute` divides the then-current
	// size and `proportionalLayout` locks in the [0, 1] split forever.
	// Seed once the splitview has a real size: dockview's `Resizable` learns
	// the container size on its first `ResizeObserver` pass, and the demo pane
	// itself is still settling (outer demo/code split) when `onReady` fires.
	// Panels opened at 0px keep a 0px first pane — `Sizing.Distribute` divides
	// the then-current size and `proportionalLayout` locks in the split.
	function seed() {
		const wait = () => {
			if ((handle?.api.width ?? 0) > 0) {
				handle?.openPanel('a', { params: { text: 'Left pane' } })
				handle?.openPanel('b', { params: { text: 'Right pane' } })
			} else {
				requestAnimationFrame(wait)
			}
		}
		requestAnimationFrame(wait)
	}
</script>

<svelte:head><title>Splitview — dockview-svelte demos</title></svelte:head>

<h1>Splitview</h1>
<p>
	Resizable split panes with the same Svelte idiom as <code>Dockview</code> — widgets, typed
	<code>openPanel</code>, reactive <code>state</code>, <code>bind:layout</code>. No tabs, no
	headers: each view mounts its component directly.
</p>
<div class="row">
	<button
		onclick={() => {
			orientation =
				orientation === Orientation.HORIZONTAL ? Orientation.VERTICAL : Orientation.HORIZONTAL
		}}>orientation: {orientation === Orientation.HORIZONTAL ? 'horizontal' : 'vertical'}</button
	>
	<button
		onclick={() => {
			handle?.openPanel('a', { params: { text: `Pane ${views.length + 1}` } })
		}}>add pane</button
	>
	<button
		onclick={() => {
			handle?.movePanel(0, (handle?.api.panels.length ?? 1) - 1)
		}}>move first → last</button
	>
	<span>views: <strong>{views.length}</strong></span>
	<span>active: <strong>{activeView?.id ?? 'none'}</strong></span>
</div>
<div class="demo">
	<Splitview
		bind:handle
		bind:views
		bind:activeView
		{widgets}
		options={{ orientation, proportionalLayout: true }}
		onReady={seed}
	/>
</div>

<style>
	.demo {
		height: 40vh;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
</style>
