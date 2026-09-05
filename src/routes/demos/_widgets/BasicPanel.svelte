<script lang="ts">
import type { PanelState } from '$lib/index.js'

let { state }: { state: PanelState<{ text?: string }> } = $props()
</script>

<div class="basic">
	<p>{state.params.text ?? 'Hello from a widget'}</p>
	<p class="meta">size: {state.size.width} × {state.size.height}</p>
</div>

<style>
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
