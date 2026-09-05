<script lang="ts">
import type { PanelState } from '../core/types.js'

let { state }: { state: PanelState } = $props()
</script>

<div class="dv-svelte-default-tab">
	<span class="dv-svelte-default-tab__title">{state.title}</span>
	<button
		type="button"
		class="dv-svelte-default-tab__close"
		aria-label="Close panel"
		onclick={() => state.api.close()}
	>
		<span aria-hidden="true">&times;</span>
	</button>
</div>

<style>
	.dv-svelte-default-tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 100%;
		padding: 0 0.25rem 0 0.75rem;
		overflow: hidden;
		white-space: nowrap;
	}

	.dv-svelte-default-tab__title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dv-svelte-default-tab__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		padding: 0;
		border: none;
		background: transparent;
		border-radius: 0.25rem;
		cursor: pointer;
		color: inherit;
		font-size: 1rem;
		line-height: 1;
	}

	.dv-svelte-default-tab__close:hover {
		background: var(--dv-hover-background-color, rgba(128, 128, 128, 0.2));
	}
</style>
