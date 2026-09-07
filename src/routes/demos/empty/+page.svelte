<script lang="ts">
import { themeAbyss } from 'dockview'
import { Dockview, type DockviewHandle } from '$lib/index.js'
import BasicPanel from '../_widgets/BasicPanel.svelte'
import EmptyWatermark from '../_widgets/EmptyWatermark.svelte'

const widgets = {
	a: { component: BasicPanel, title: 'A' },
}

let handle = $state<DockviewHandle<typeof widgets> | undefined>(undefined)
</script>

<svelte:head><title>Empty state — dockview-svelte demos</title></svelte:head>

<h1>Empty state (watermark)</h1>
<p>
	With no panels open, <code>Dockview</code> shows the <code>watermark</code> prop — a plain Svelte
	component receiving <code>{`{ openPanel }`}</code>. No dockview
	<code>IWatermarkRenderer</code> factory involved.
</p>
<div class="row">
	<button onclick={() => handle?.openPanel('a', { params: { text: 'Panel A' } })}>open panel</button
	>
	<button onclick={() => handle?.api.clear()}>close all</button>
</div>
<div class="demo">
	<Dockview bind:handle {widgets} watermark={EmptyWatermark} options={{ theme: themeAbyss }} />
</div>

<style>
	.demo {
		height: 40vh;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.demo :global(.dv-svelte-watermark-overlay) {
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
