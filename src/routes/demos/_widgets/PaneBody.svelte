<script lang="ts">
import type { PaneviewState } from '$lib/index.js'

let { state }: { state: PaneviewState<{ text?: string }> } = $props()
</script>

<div class="pane">
	<p>{state.params.text ?? 'Pane body'}</p>
	<p class="meta">size: {state.size.width} × {state.size.height}</p>
	<div class="row">
		<button type="button" onclick={() => (state.expanded = !state.expanded)}>
			{state.expanded ? 'collapse' : 'expand'}
		</button>
	</div>
	<p class="meta">
		active: {String(state.active)} · expanded: {String(state.expanded)}
	</p>
</div>

<style>
	.pane {
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
