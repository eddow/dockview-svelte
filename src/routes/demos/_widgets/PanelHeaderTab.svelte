<script lang="ts">
import { getContext } from 'svelte'
import { DOCKVIEW_CONTEXT_KEY, type DockviewContext, type PanelState } from '$lib/index.js'

let { state }: { state: PanelState } = $props()

const context = getContext<DockviewContext>(DOCKVIEW_CONTEXT_KEY)

function floatPanel(): void {
	const api = context?.api
	if (!api) return
	const panel = api.getPanel(state.api.id)
	if (panel) api.addFloatingGroup(panel)
}

async function popoutPanel(): Promise<void> {
	const api = context?.api
	if (!api) return
	const panel = api.getPanel(state.api.id)
	if (panel) await api.addPopoutGroup(panel)
}
</script>

<div class="panel-tab">
	<span class="panel-tab__title">{state.title}</span>
	<button type="button" title="Float panel" aria-label="Float panel" onclick={floatPanel}>⧉</button>
	<button type="button" title="Popout panel" aria-label="Popout panel" onclick={popoutPanel}
		>↗</button
	>
	<button type="button" aria-label="Close" onclick={() => state.api.close()}>×</button>
</div>

<style>
	.panel-tab {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		height: 100%;
		padding: 0 0.25rem 0 0.75rem;
		white-space: nowrap;
	}
	.panel-tab__title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.panel-tab button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.15rem;
		border: none;
		background: transparent;
		border-radius: 0.25rem;
		cursor: pointer;
		color: inherit;
		font-size: 0.85rem;
		line-height: 1;
		opacity: 0.7;
	}
	.panel-tab button:hover {
		opacity: 1;
		background: var(--dv-hover-background-color, rgba(128, 128, 128, 0.2));
	}
</style>
