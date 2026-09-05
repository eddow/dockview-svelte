<script lang="ts">
import { themeAbyss } from 'dockview'
import { onMount } from 'svelte'
import { Dockview, type DockviewHandle, defineWidgets } from '$lib/index.js'
import BasicPanel from '../_widgets/BasicPanel.svelte'

const widgets = defineWidgets({
	basic: { component: BasicPanel, title: 'Basic' },
})

let handle = $state<DockviewHandle<typeof widgets> | undefined>(undefined)

onMount(() => {
	handle?.openPanel('basic', { params: { text: 'Hello from a widget' } })
})
</script>

<svelte:head><title>Basic — dockview-svelte demos</title></svelte:head>

<h1>Basic: open a widget</h1>
<div class="demo"><Dockview bind:handle {widgets} options={{ theme: themeAbyss }} /></div>

<style>
	.demo {
		height: 40vh;
	}
</style>
