<script lang="ts">
import type { PanelState } from '$lib/core/types.js'

let { state }: { state: PanelState } = $props()
</script>

<div class="tab">
	<span class="tab__title">{state.title}</span>
	{#if state.custom.unread}
		<span class="tab__badge">{String(state.custom.unread)}</span>
	{/if}
	<button type="button" class="tab__close" aria-label="Close" onclick={() => state.api.close()}>
		&times;
	</button>
</div>

<style>
	.tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 100%;
		padding: 0 0.25rem 0 0.75rem;
		overflow: hidden;
		white-space: nowrap;
	}
	.tab__title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tab__badge {
		background: var(--dv-tabs-and-actions-container-background-color, #d33);
		color: #fff;
		border-radius: 999px;
		padding: 0 0.4rem;
		font-size: 0.7rem;
		line-height: 1.2rem;
	}
	.tab__close {
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		padding: 0 0.25rem;
		border-radius: 0.25rem;
	}
	.tab__close:hover {
		background: var(--dv-hover-background-color, rgba(128, 128, 128, 0.2));
	}
</style>
