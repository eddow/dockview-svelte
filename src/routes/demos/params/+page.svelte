<script lang="ts">
import { themeAbyss } from 'dockview'
import { onMount } from 'svelte'
import { Dockview, type DockviewHandle, defineWidgets } from '$lib/index.js'
import CounterPanel from '../_widgets/CounterPanel.svelte'

const widgets = defineWidgets({
	counter: { component: CounterPanel, title: 'Counter' },
})

let handle = $state<DockviewHandle<typeof widgets> | undefined>(undefined)

onMount(() => {
	handle?.openPanel('counter', { params: { start: 10, step: 2 } })
})
</script>

<svelte:head><title>Params — dockview-svelte demos</title></svelte:head>

<h1>Reactive params (two-way)</h1>
<p>
	Mutating <code>state.params</code> in the widget calls <code>api.updateParameters</code>;
	dockview-side updates merge back in.
</p>
<div class="demo"><Dockview bind:handle {widgets} options={{ theme: themeAbyss }} /></div>

<style>
	.demo {
		height: 40vh;
	}
</style>
