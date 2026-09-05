<script lang="ts">
	import type { PanelState } from '$lib/core/types.js'

	interface ExampleParams {
		message?: string
		count?: number
	}

	let { state }: { state: PanelState<ExampleParams> } = $props()
</script>

<div class="panel">
	<h2>{state.title}</h2>

	<p>message: <strong>{state.params.message ?? '(none)'}</strong></p>
	<p>count: <strong>{state.params.count ?? 0}</strong></p>
	<p>size: {state.size.width} × {state.size.height}</p>
	<p>custom.unread: <strong>{String(state.custom.unread ?? 0)}</strong></p>

	<div class="actions">
		<button onclick={() => (state.params.count = (state.params.count ?? 0) + 1)}> count++ </button>
		<button
			onclick={() => {
				state.custom.unread = Number(state.custom.unread ?? 0) + 1
			}}
		>
			unread++
		</button>
		<button onclick={() => state.api.setTitle(`Renamed ${Date.now() % 1000}`)}> rename </button>
		<button onclick={() => state.api.close()}>close</button>
	</div>
</div>

<style>
	.panel {
		height: 100%;
		padding: 1rem;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		/* dockview themes set the content background but NOT the foreground —
		   widgets own their text color. This theme-adaptive variable is white on
		   dark themes (abyss) and dark on light themes. */
		color: var(--dv-activegroup-visiblepanel-tab-color);
	}
	h2 {
		margin: 0;
	}
	p {
		margin: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.actions button {
		color: #000;
		background: #f0f0f0;
		border: 1px solid #b0b0b0;
		border-radius: 4px;
		padding: 0.25rem 0.75rem;
		cursor: pointer;
	}
	.actions button:hover {
		background: #e0e0e0;
	}
</style>
