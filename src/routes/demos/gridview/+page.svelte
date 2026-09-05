<script lang="ts">
import { type IGridviewPanel, Orientation } from 'dockview'
import { onMount } from 'svelte'
import { defineGridviewWidgets, Gridview, type GridviewHandle } from '$lib/index.js'
import GridCell from '../_widgets/GridCell.svelte'

const widgets = defineGridviewWidgets({
	a: { component: GridCell },
	b: { component: GridCell },
})

let handle = $state<GridviewHandle<typeof widgets> | undefined>(undefined)
let orientation = $state<Orientation>(Orientation.HORIZONTAL)
let panels = $state<IGridviewPanel[]>([])
let activePanel = $state<IGridviewPanel | undefined>(undefined)

onMount(() => {
	handle?.openPanel('a', { params: { text: 'Left cell' } })
	handle?.openPanel('b', {
		params: { text: 'Right cell' },
		position: { direction: 'right', referencePanel: 'a-1' },
	})
})
</script>

<svelte:head><title>Gridview — dockview-svelte demos</title></svelte:head>

<h1>Gridview</h1>
<p>
	Simple grid splits with the same Svelte idiom as <code>Dockview</code> — widgets, typed
	<code>openPanel</code>, reactive <code>state</code>, <code>bind:layout</code>. No tabs, no
	headers: each cell mounts its component directly. Position new cells with
	<code>position: {'{ direction, referencePanel }'}</code>.
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
			handle?.openPanel('a', { params: { text: `Cell ${panels.length + 1}` } })
		}}>add cell</button
	>
	<button
		onclick={() => {
			const first = panels[0]
			const last = panels[panels.length - 1]
			if (first && last && first !== last)
				handle?.movePanel(first.id, { direction: 'below', reference: last.id })
		}}>move first below last</button
	>
	<span>cells: <strong>{panels.length}</strong></span>
	<span>active: <strong>{activePanel?.id ?? 'none'}</strong></span>
</div>
<div class="demo">
	<Gridview
		bind:handle
		bind:panels
		bind:activePanel
		{widgets}
		options={{ orientation, proportionalLayout: true }}
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
