<script lang="ts">
import type { PanelState } from '$lib/index.js'

interface CounterParams {
	start?: number
	step?: number
}

let { state: panel }: { state: PanelState<CounterParams> } = $props()

let count = $state(0)

$effect(() => {
	count = panel.params.start ?? 0
})
</script>

<div class="counter">
	<p>
		count: <strong>{count}</strong> (params: start={panel.params.start}, step={panel.params.step})
	</p>
	<div class="row">
		<button onclick={() => (count += panel.params.step ?? 1)}>+ step (local)</button>
		<button onclick={() => (panel.params.step = (panel.params.step ?? 1) + 1)}
			>step++ (param)</button
		>
		<button onclick={() => panel.api.setTitle(`Count ${count}`)}>rename to count</button>
	</div>
</div>

<style>
	.counter {
		padding: 1rem;
		height: 100%;
		box-sizing: border-box;
		color: var(--dv-activegroup-visiblepanel-tab-color);
	}
	.row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
</style>
