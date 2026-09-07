<script lang="ts">
import { themeAbyss } from 'dockview'
import { onMount } from 'svelte'
import { type ActiveState, Dockview, type DockviewHandle } from '$lib/index.js'
import BasicPanel from '../_widgets/BasicPanel.svelte'

const widgets = {
	a: { component: BasicPanel, title: 'A' },
	b: { component: BasicPanel, title: 'B' },
}

let handle = $state<DockviewHandle<typeof widgets> | undefined>(undefined)
let active = $state<ActiveState>({ panel: undefined, group: undefined })
let log = $state<Array<{ n: number; msg: string }>>([])
let seq = 0

function push(msg: string) {
	seq += 1
	log = [...log.slice(-9), { n: seq, msg }]
}

onMount(() => {
	handle?.openPanel('a', { params: { text: 'Panel A' } })
	handle?.openPanel('b', { params: { text: 'Panel B' } })
})
</script>

<svelte:head><title>Events — dockview-svelte demos</title></svelte:head>

<h1><code>bind:active</code> + events</h1>
<p>active panel: <strong>{active.panel?.id ?? '(none)'}</strong></p>
<div class="row">
	<button onclick={() => handle?.openPanel('a', { params: { text: 'Another A' } })}
		>add panel</button
	>
</div>
<div class="demo">
	<Dockview
		bind:handle
		bind:active
		{widgets}
		options={{ theme: themeAbyss }}
		onDidActivePanelChange={(e) => push(`active panel → ${e.panel?.id ?? '(none)'}`)}
		onDidAddPanel={(p) => push(`added ${p.id}`)}
		onDidRemovePanel={(p) => push(`removed ${p.id}`)}
	/>
</div>
<ul>
	{#each log as entry (entry.n)}<li>{entry.msg}</li>{/each}
</ul>

<style>
	.demo {
		height: 40vh;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
</style>
