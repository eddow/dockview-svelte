<script lang="ts">
	import { onMount } from 'svelte'
	import { themeAbyss, type SerializedDockview } from 'dockview'
	import 'dockview/dist/styles/dockview.css'
	import { Dockview, DvWidget, type DockviewHandle, type PanelState } from 'dockview-svelte'

	type Params = { n: number }

	let handle = $state<DockviewHandle>()
	let layout = $state<SerializedDockview>()
	let saved = $state<string>()
	let seq = 1

	/** Open one more panel of a widget, numbered through `params`. */
	const open = (widget: 'files' | 'notes') =>
		handle?.openPanel(widget, { params: { n: seq++ } satisfies Params })

	onMount(() => {
		open('files')
		open('notes')
	})
</script>

<div class="bar">
	<button onclick={() => open('files')}>+ files</button>
	<button onclick={() => open('notes')}>+ notes</button>
	<button disabled={!layout} onclick={() => (saved = JSON.stringify(layout))}>save</button>
	<button disabled={!saved} onclick={() => handle?.api.fromJSON(JSON.parse(saved ?? '{}'))}>
		restore
	</button>
	<span class="grow"></span>
	<small>{handle?.api.panels.length ?? 0} panels — drag a tab to split or dock</small>
</div>

<div class="dock">
	<Dockview bind:handle bind:layout options={{ theme: themeAbyss }}>
		<!-- `children` is the body, `tab` the header — both get the SAME
		     reactive PanelState. `state.custom` is the tab↔content channel. -->
		<DvWidget name="files" title="Files">
			{#snippet children(state: PanelState<Params>)}
				<div class="body">
					<p>Files #{state.params.n}</p>
					<p class="dim">{state.size.width}×{state.size.height}px</p>
					<button onclick={() => (state.custom.unread = Number(state.custom.unread ?? 0) + 1)}>
						unread++ → tab badge
					</button>
				</div>
			{/snippet}
			{#snippet tab(state: PanelState)}
				<div class="tab">
					<span class="grow">{state.title}</span>
					{#if state.custom.unread}<span class="badge">{String(state.custom.unread)}</span>{/if}
					<button class="x" aria-label="Close" onclick={() => state.api.close()}>×</button>
				</div>
			{/snippet}
		</DvWidget>

		<!-- No `tab` snippet → the built-in default tab is used. -->
		<DvWidget name="notes" title="Notes">
			{#snippet children(state: PanelState<Params>)}
				<div class="body">
					<p>Notes #{state.params.n}</p>
					<p class="dim">params are two-way bound to dockview</p>
					<button onclick={() => (state.params.n += 1)}>param++ ({state.params.n})</button>
				</div>
			{/snippet}
		</DvWidget>
	</Dockview>
</div>

<style>
	/* App chrome only — panel look & feel is 100% dockview's stylesheet. */
	:global(body) {
		margin: 0;
		height: 100vh;
		display: flex;
		flex-direction: column;
		font:
			14px/1.4 system-ui,
			sans-serif;
	}
	.bar {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		padding: 0.5rem;
	}
	.dock {
		flex: 1;
		min-height: 0;
	}
	.grow {
		flex: 1;
	}
	.dim {
		opacity: 0.6;
		font-size: 0.85em;
	}
	.body {
		padding: 1rem;
		color: var(--dv-activegroup-visiblepanel-tab-color);
	}
	.tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 100%;
		padding-left: 0.75rem;
		white-space: nowrap;
	}
	.badge {
		background: #d33;
		color: #fff;
		border-radius: 999px;
		padding: 0 0.4rem;
		font-size: 0.7rem;
	}
	.x {
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
		font-size: 1rem;
	}
</style>
