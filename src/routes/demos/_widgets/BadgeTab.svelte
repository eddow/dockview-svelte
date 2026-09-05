<script lang="ts">
import type { PanelState } from '$lib/index.js'

let { state }: { state: PanelState } = $props()
</script>

<div class="badge-tab">
	<span>{state.title}</span>
	{#if state.custom.unread}
		<span class="badge">{String(state.custom.unread)}</span>
	{/if}
	<button type="button" aria-label="Close" onclick={() => state.api.close()}>×</button>
</div>

<style>
	.badge-tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 100%;
		padding: 0 0.25rem 0 0.75rem;
		white-space: nowrap;
	}
	.badge {
		background: #d33;
		color: #fff;
		border-radius: 999px;
		padding: 0 0.4rem;
		font-size: 0.7rem;
	}
</style>
