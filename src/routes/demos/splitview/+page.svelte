<script lang="ts">
import { type ISplitviewPanel, Orientation } from 'dockview'
import { onMount } from 'svelte'
import { defineSplitviewWidgets, Splitview, type SplitviewHandle } from '$lib/index.js'
import SplitPanel from '../_widgets/SplitPanel.svelte'

const widgets = defineSplitviewWidgets({
	a: { component: SplitPanel },
	b: { component: SplitPanel },
})

let handle = $state<SplitviewHandle<typeof widgets> | undefined>(undefined)
let orientation = $state<Orientation>(Orientation.HORIZONTAL)
let views = $state<ISplitviewPanel[]>([])

onMount(() => {
	handle?.openPanel('a', { params: { text: 'Left pane' } })
	handle?.openPanel('b', { params: { text: 'Right pane' } })
})
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
</div>
<div class="demo">
	<Splitview bind:handle bind:views {widgets} options={{ orientation, proportionalLayout: true }} />
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
