<script lang="ts">
import { Orientation, type SerializedDockview, themeAbyss } from 'dockview'
import { Dockview, type DockviewHandle, defineWidgets } from '$lib/index.js'
import BasicPanel from '../_widgets/BasicPanel.svelte'

const widgets = defineWidgets({
	a: { component: BasicPanel, title: 'A' },
	b: { component: BasicPanel, title: 'B' },
})

/** Hard-coded initial layout: two panels side by side. */
const stored =
	typeof localStorage === 'undefined'
		? undefined
		: (() => {
				try {
					const raw = localStorage.getItem('dockview-svelte:layout-demo')
					return raw ? (JSON.parse(raw) as SerializedDockview) : undefined
				} catch {
					return undefined
				}
			})()
const initialLayout: SerializedDockview = stored ?? {
	grid: {
		root: {
			type: 'branch',
			data: [
				{
					type: 'leaf',
					data: { views: ['panel-a'], activeView: 'panel-a', id: 'group-left' },
					size: 50,
				},
				{
					type: 'leaf',
					data: { views: ['panel-b'], activeView: 'panel-b', id: 'group-right' },
					size: 50,
				},
			],
			size: 100,
		},
		width: 800,
		height: 600,
		orientation: Orientation.HORIZONTAL,
	},
	panels: {
		'panel-a': {
			id: 'panel-a',
			contentComponent: 'a',
			tabComponent: 'a',
			title: 'Panel A',
			params: { text: 'Panel A (from layout)' },
		},
		'panel-b': {
			id: 'panel-b',
			contentComponent: 'b',
			tabComponent: 'b',
			title: 'Panel B',
			params: { text: 'Panel B (from layout)' },
		},
	},
	activeGroup: 'group-left',
}

let handle = $state<DockviewHandle<typeof widgets> | undefined>(undefined)
let layout = $state<SerializedDockview | undefined>(initialLayout)
let saved = $state<string | undefined>(undefined)

// Persist `bind:layout` across page reloads so the layout demo doubles as the
// persistence test (close a panel → reload → it stays closed).
$effect(() => {
	if (typeof localStorage === 'undefined' || !layout) return
	try {
		localStorage.setItem('dockview-svelte:layout-demo', JSON.stringify(layout))
	} catch {
		// Storage full or unavailable — the demo still works in-memory.
	}
})

function save() {
	saved = JSON.stringify(layout)
}

function restore() {
	if (saved) layout = JSON.parse(saved)
}
</script>

<svelte:head><title>Layout — dockview-svelte demos</title></svelte:head>

<h1>Save / restore <code>bind:layout</code></h1>
<div class="row">
	<button onclick={save}>save layout</button>
	<button onclick={restore} disabled={!saved}>restore layout</button>
	<button onclick={() => handle?.openPanel('a', { params: { text: 'Another A' } })}
		>add panel</button
	>
</div>
<div class="demo">
	<Dockview bind:handle bind:layout {widgets} options={{ theme: themeAbyss }} />
</div>

<style>
	.demo {
		height: 40vh;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
</style>
