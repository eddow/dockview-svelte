<script lang="ts">
import { themeAbyss } from 'dockview'
import { onMount } from 'svelte'
import { Dockview, type DockviewHandle, DvWidget, type PanelState } from '$lib/index.js'

let handle = $state<DockviewHandle | undefined>(undefined)
let seq = $state(0)

function addPanel() {
	handle?.openPanel('basic', { params: { n: ++seq } })
}

onMount(() => {
	addPanel()
})
</script>

<svelte:head><title>Declarative — dockview-svelte demos</title></svelte:head>

<h1>Declarative widgets (<code>&lt;DvWidget&gt;</code>)</h1>
<p>
	Same panel, no <code>widgets</code> prop — the body snippet receives the shared
	<code>state</code> object, exactly like a registry component's
	<code>{'{ state }'}</code> prop.
</p>
<div class="row">
	<button onclick={addPanel}>add panel</button>
</div>
<div class="demo">
	<Dockview bind:handle options={{ theme: themeAbyss }}>
		<DvWidget name="basic" title="Basic">
			{#snippet children(state: PanelState<{ n?: number }>)}
				<div class="basic">
					<p>panel #{state.params.n ?? '—'}</p>
					<p class="meta">size: {state.size.width} × {state.size.height}</p>
				</div>
			{/snippet}
		</DvWidget>
	</Dockview>
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
	.basic {
		padding: 1rem;
		height: 100%;
		box-sizing: border-box;
		color: var(--dv-activegroup-visiblepanel-tab-color);
	}
	.meta {
		opacity: 0.7;
		font-size: 0.85rem;
	}
</style>
