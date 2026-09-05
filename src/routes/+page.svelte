<script lang="ts">
	import { type SerializedDockview, themeAbyss } from 'dockview'
	import { onMount } from 'svelte'
	import type { ActiveState, DockviewHandle } from '$lib/index.js'
	import { Dockview, defineWidgets } from '$lib/index.js'
	import 'dockview/dist/styles/dockview.css'
	import ExamplePanel from './ExamplePanel.svelte'
	import ExampleTab from './ExampleTab.svelte'

	const widgets = defineWidgets({
		example: { component: ExamplePanel, tab: ExampleTab, title: 'Example' },
		plain: { component: ExamplePanel } // default tab, widget-key title fallback
	})

	let handle = $state<DockviewHandle<typeof widgets> | undefined>(undefined)
	let layout = $state<SerializedDockview | undefined>(undefined)
	let active = $state<ActiveState>({ panel: undefined, group: undefined })

	onMount(() => {
		handle?.openPanel('example', { title: 'First', params: { message: 'hello', count: 0 } })
		handle?.openPanel('example', { title: 'Second', params: { message: 'world', count: 10 } })
		handle?.openPanel('plain', { params: { message: 'no custom tab' } })
	})
</script>

<svelte:head>
	<title>dockview-svelte demo</title>
</svelte:head>

<main>
	<Dockview
		bind:handle
		bind:layout
		bind:active
		{widgets}
		options={{ theme: themeAbyss }}
		onReady={() => console.log('ready')}
	/>
</main>

<style>
	:global(html),
	:global(body) {
		height: 100%;
		margin: 0;
	}
	main {
		height: 100vh;
	}
</style>
