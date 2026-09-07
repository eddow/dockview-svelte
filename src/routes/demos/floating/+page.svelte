<script lang="ts">
import { themeAbyss } from 'dockview'
import { onMount } from 'svelte'
import { Dockview, type DockviewHandle, type FloatingState, type PopoutState } from '$lib/index.js'
import BasicPanel from '../_widgets/BasicPanel.svelte'
import GroupHeaderActions from '../_widgets/GroupHeaderActions.svelte'
import PanelHeaderTab from '../_widgets/PanelHeaderTab.svelte'

const widgets = {
	a: { component: BasicPanel, tab: PanelHeaderTab, title: 'A' },
	b: { component: BasicPanel, tab: PanelHeaderTab, title: 'B' },
}

let handle = $state<DockviewHandle<typeof widgets> | undefined>(undefined)
let floating = $state<FloatingState>({ count: 0, hasFloating: false })
let popout = $state<PopoutState>({ count: 0, hasPopout: false })
let gridPanelId = $state<string | undefined>(undefined)

onMount(() => {
	const first = handle?.openPanel('a', { params: { text: 'Panel A (grid)' } })
	handle?.openPanel('b', { params: { text: 'Panel B (grid)' } })
	gridPanelId = first?.id
})
</script>

<svelte:head><title>Floating groups — dockview-svelte demos</title></svelte:head>

<h1>Floating groups</h1>
<p>
	Floating windows stay reactive via <code>bind:floating</code> — dragging, floating, or docking
	back all update it. <code>handle.float()</code> floats an existing panel or group;
	<code>handle.dockAll()</code> docks everything back. Each group header (via
	<code>rightHeaderActions</code>) and each panel tab carries ⧉ float / ↗ popout buttons.
</p>
<div class="row">
	<button
		onclick={() => {
			handle?.openPanel('a', {
				id: `float-${Date.now()}`,
				title: 'Floating A',
				floating: { x: 80, y: 80, width: 320, height: 220 },
				params: { text: 'I am floating' }
			})
		}}>open floating</button
	>
	<button onclick={() => gridPanelId && handle?.float(gridPanelId)} disabled={!gridPanelId}
		>float panel A</button
	>
	<button onclick={() => handle?.dockAll()} disabled={!floating.hasFloating}>dock all</button>
	<span>floating groups: <strong>{floating.count}</strong></span>
	<span>popout windows: <strong>{popout.count}</strong></span>
</div>
<div class="demo">
	<Dockview
		bind:handle
		bind:floating
		bind:popout
		{widgets}
		rightHeaderActions={GroupHeaderActions}
		options={{ theme: themeAbyss }}
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
	}
</style>
