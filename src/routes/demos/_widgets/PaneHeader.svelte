<script lang="ts">
import type { PaneviewState } from '$lib/index.js'

let { state }: { state: PaneviewState } = $props()
</script>

<span class="pane-header">
	<span>{state.title}</span>
	<button type="button" onclick={() => (state.expanded = !state.expanded)} aria-label="toggle">
		{state.expanded ? '▾' : '▸'}
	</button>
</span>

<style>
	.pane-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}
	.pane-header button {
		margin-left: auto;
	}
</style>
