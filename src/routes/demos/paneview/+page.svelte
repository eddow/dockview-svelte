<script lang="ts">
import type { IPaneviewPanel } from 'dockview'
import { onMount } from 'svelte'
import { definePaneviewWidgets, Paneview, type PaneviewHandle } from '$lib/index.js'
import PaneBody from '../_widgets/PaneBody.svelte'
import PaneHeader from '../_widgets/PaneHeader.svelte'

const widgets = definePaneviewWidgets({
	a: { component: PaneBody, header: PaneHeader, title: 'Pane A' },
	b: { component: PaneBody, title: 'Pane B' },
})

let handle = $state<PaneviewHandle<typeof widgets> | undefined>(undefined)
let panels = $state<IPaneviewPanel[]>([])

onMount(() => {
	handle?.openPanel('a', { params: { text: 'First pane (custom header)' }, isExpanded: true })
	handle?.openPanel('b', { params: { text: 'Second pane (default header)' } })
})
</script>

<svelte:head><title>Paneview — dockview-svelte demos</title></svelte:head>

<h1>Paneview</h1>
<p>
	Collapsible VS Code-style sidebars with the same Svelte idiom as <code>Dockview</code> —
	widgets, typed <code>openPanel</code>, reactive <code>state</code>,
	<code>bind:layout</code>. Each pane mounts a body component plus an optional custom header
	(sharing one <code>state</code>); without a header dockview's default title header is used.
</p>
<div class="row">
	<button
		onclick={() => {
			handle?.openPanel('a', { params: { text: `Pane ${panels.length + 1}` } })
		}}>add pane</button
	>
	<button
		onclick={() => {
			handle?.movePanel(0, (handle?.api.panels.length ?? 1) - 1)
		}}>move first → last</button
	>
	<span>panes: <strong>{panels.length}</strong></span>
</div>
<div class="demo">
	<Paneview bind:handle bind:panels {widgets} />
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
