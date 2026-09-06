<script lang="ts">
import type { GridviewState } from '$lib/index.js'

let { state }: { state: GridviewState<{ text?: string }> } = $props()
</script>

<div class="grid">
	<p>{state.params.text ?? 'Grid cell'}</p>
	<p class="meta">size: {state.size.width} × {state.size.height}</p>
	<div class="row">
		<button type="button" onclick={() => (state.visible = !state.visible)}>
			{state.visible ? 'hide' : 'show'}
		</button>
		<button type="button" onclick={() => (state.active = true)}>activate</button>
	</div>
	<p class="meta">active: {String(state.active)} · visible: {String(state.visible)}</p>
</div>

<style>
	.grid {
		padding: 1rem;
		height: 100%;
		box-sizing: border-box;
		overflow: auto;
	}
	.meta {
		opacity: 0.7;
		font-size: 0.85rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
</style>
