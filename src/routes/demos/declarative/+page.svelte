<script lang="ts">
	import { themeAbyss } from 'dockview'
	import { onMount } from 'svelte'
	import { Dockview, type DockviewHandle, DvWidget, type PanelState } from '$lib/index.js'
	import BasicPanel from '../_widgets/BasicPanel.svelte'

	let handle = $state<DockviewHandle | undefined>(undefined)

	onMount(() => {
		handle?.openPanel('basic', { params: { text: 'Hello from a widget' } })
	})
</script>

<svelte:head><title>Declarative — dockview-svelte demos</title></svelte:head>

<h1>Declarative widgets (<code>&lt;DvWidget&gt;</code>)</h1>
<p>
	Same panel, no <code>widgets</code> prop — the body snippet receives the shared
	<code>state</code> object, exactly like a registry component's
	<code>{'{ state }'}</code> prop.
</p>
<div class="demo">
	<Dockview bind:handle options={{ theme: themeAbyss }}>
		<DvWidget name="basic" title="Basic">
			{#snippet children(state: PanelState<{ text?: string }>)}
				<BasicPanel {state} />
			{/snippet}
		</DvWidget>
	</Dockview>
</div>

<style>
	.demo {
		height: 40vh;
	}
</style>
