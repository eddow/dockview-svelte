<script lang="ts" generics="const W extends GridviewWidgets">
import type {
	GridviewApi,
	GridviewComponentOptions,
	IGridviewPanel,
	SerializedGridviewComponent,
} from 'dockview'
import { createGridview, Orientation } from 'dockview'
import { onMount, type Snippet, setContext } from 'svelte'
import { DOCKVIEW_CONTEXT_KEY, type GridviewContext } from '$lib/core/context.js'
import { createGridviewFactory } from '$lib/core/gridview.svelte.js'
import { GridviewWidgetRegistry } from '$lib/core/registry.js'
import type {
	GridviewHandle,
	GridviewMoveOptions,
	GridviewOpenPanelOptions,
	GridviewPanelHandle,
	GridviewParamsOf,
	GridviewWidgetDefinition,
	GridviewWidgets,
} from '$lib/core/types.js'
import { deepEqual } from '$lib/core/utils.js'

interface Props<W extends GridviewWidgets> {
	/** Widget registry: `{ [key]: { component } }` — no tabs or titles, grid cells have no headers. */
	widgets?: W
	/**
	 * `GridviewComponentOptions` passthrough (proportionalLayout, …).
	 * `orientation` defaults to `HORIZONTAL` (required by dockview).
	 *
	 * `createComponent` is owned by the library (Svelte `mount` factory
	 * backed by the `widgets` registry) and cannot be overridden.
	 */
	options?: Omit<GridviewComponentOptions, 'createComponent'> & { orientation?: Orientation }
	/** `bind:layout` — gridview JSON (`toJSON`/`fromJSON` shape). */
	layout?: SerializedGridviewComponent
	/** `bind:handle` — `{ api, openPanel, registerWidget, removePanel, movePanel, setVisible, setActive }`. */
	handle?: GridviewHandle<W>
	/**
	 * `bind:panels` — reactive list of current cells (`api.panels` snapshot).
	 * Refreshed on layout/add/remove/FromJSON, so `panels.length` is the
	 * sveltish cell count — no manual `onDidAddPanel` counting needed.
	 */
	panels?: IGridviewPanel[]
	/**
	 * `bind:activePanel` — the currently active cell. Derived from the
	 * per-panel `api.onDidActiveChange` (via the factory) plus explicit sync
	 * on the open/remove paths — `GridviewApi.onDidActivePanelChange` only
	 * fires on focus-driven activation, never on programmatic adds.
	 */
	activePanel?: IGridviewPanel | undefined
	/** Extra classes for the root container. */
	class?: string
	/** Declarative widgets (`<DvWidget>` children) — alternative to the `widgets` prop. */
	children?: Snippet
	/** Fired once the component is mounted and `api` is ready. */
	onReady?: (event: { api: GridviewApi; handle: GridviewHandle<W> }) => void
	onDidLayoutChange?: () => void
	onDidLayoutFromJSON?: () => void
	onDidAddPanel?: (panel: IGridviewPanel) => void
	onDidRemovePanel?: (panel: IGridviewPanel) => void
	onDidActivePanelChange?: (panel: IGridviewPanel | undefined) => void
}

let {
	widgets = {} as W,
	options = {} as Omit<GridviewComponentOptions, 'createComponent'> & {
		orientation?: Orientation
	},
	layout = $bindable(),
	handle = $bindable(),
	panels = $bindable([]),
	activePanel = $bindable(undefined),
	class: className = '',
	children,
	onReady,
	onDidLayoutChange,
	onDidLayoutFromJSON,
	onDidAddPanel,
	onDidRemovePanel,
	onDidActivePanelChange,
}: Props<W> = $props()

let container: HTMLElement
let api = $state<GridviewApi | undefined>(undefined)

const registry = new GridviewWidgetRegistry()
const counters = new Map<string, number>()

// Stable `registerWidget`, shared by context and handle.
function registerWidget(key: string, def: GridviewWidgetDefinition): void {
	registry.register(key, def)
}

function unregisterWidget(key: string): void {
	registry.unregister(key)
}

// Context for descendant widgets (api is populated after mount).
const context = $state<GridviewContext>({
	api: undefined,
	registerWidget,
	unregisterWidget,
	kind: 'gridview',
})
setContext(DOCKVIEW_CONTEXT_KEY, context)

// Seed the registry from the `widgets` prop (additive).
$effect(() => {
	registry.seed(widgets)
})

function nextId(key: string): string {
	const n = (counters.get(key) ?? 0) + 1
	counters.set(key, n)
	return `${key}-${n}`
}

/** `bind:layout` loop-break: the JSON we last emitted to the parent. */
let lastEmitted: SerializedGridviewComponent | undefined

/** Serialize the current layout and push it to the bound `layout`. */
function emitLayout(): void {
	if (!api) return
	const json = api.toJSON()
	lastEmitted = json
	layout = json
	refreshPanels()
}

/** Refresh `bind:panels` from the live cells. */
function refreshPanels(): void {
	if (!api) return
	panels = [...api.panels]
}

/**
 * Set `bind:activePanel` + fire `onDidActivePanelChange`, deduped on panel
 * id. Per-panel `onDidActiveChange` fires on both the deactivated and the
 * activated cell, so the guard keeps a single update per activation.
 */
function setActivePanel(panel: IGridviewPanel | undefined): void {
	if (activePanel?.id === panel?.id) return
	activePanel = panel
	onDidActivePanelChange?.(panel)
}

function getPanelOrThrow(id: string): import('dockview').GridviewPanel {
	const panel = api!.getPanel(id)
	if (!panel) {
		throw new Error(`dockview-svelte: unknown panel "${id}"`)
	}
	return panel as import('dockview').GridviewPanel
}

function openPanel<K extends keyof W & string>(
	key: K,
	opts?: GridviewOpenPanelOptions<GridviewParamsOf<W[K]['component']>>
): GridviewPanelHandle<GridviewParamsOf<W[K]['component']>> {
	if (!api) {
		throw new Error('dockview-svelte: Gridview is not mounted yet')
	}
	const def = registry.get(key)
	if (!def) {
		throw new Error(`dockview-svelte: unknown widget "${key}"`)
	}

	const id = opts?.id ?? nextId(key)
	const panel = api.addPanel({
		...(opts ?? {}),
		id,
		component: key,
		params: opts?.params ?? {},
	})
	// `addPanel` fires no event the component observes for the open path
	// itself (events cover external mutations) — refresh the bound
	// panels/layout directly so `bind:panels` reflects the new cell.
	// `doSetGroupActive` inside `addPanel` fires per-panel
	// `onDidActiveChange`, which the factory mirrors to `state.active`
	// but the component does not observe — so sync `bind:activePanel`
	// explicitly.
	emitLayout()
	setActivePanel(panel)

	const state = factory?.getState(id)
	// `state` is `GridviewState<Record<string, unknown>>` at the factory
	// boundary; `GridviewState<P>` is invariant in `P` (params is read/write),
	// so the runtime-known `P` requires an `unknown` bridge.
	return { id, panel, api: panel.api, state: state! } as unknown as GridviewPanelHandle<
		GridviewParamsOf<W[K]['component']>
	>
}

/** Remove a cell by panel id. */
function removePanel(id: string): void {
	if (!api) {
		throw new Error('dockview-svelte: Gridview is not mounted yet')
	}
	const removed = getPanelOrThrow(id)
	const wasActive = activePanel?.id === removed.id
	api.removePanel(removed)
	// Removal fires no active event either — fall back to the last
	// remaining cell when the active one was removed.
	if (wasActive) setActivePanel(api.panels.at(-1))
}

/** Move a cell relative to a reference panel. */
function movePanel(id: string, move: GridviewMoveOptions): void {
	if (!api) {
		throw new Error('dockview-svelte: Gridview is not mounted yet')
	}
	api.movePanel(getPanelOrThrow(id), {
		direction: move.direction,
		reference: move.reference,
		size: move.size,
	})
}

/** Show or hide a cell by id (via the panel api — `panel.setVisible` only fires `onDidVisibilityChange` without touching the layout). */
function setVisible(id: string, visible: boolean): void {
	if (!api) {
		throw new Error('dockview-svelte: Gridview is not mounted yet')
	}
	getPanelOrThrow(id).api.setVisible(visible)
}

/** Activate a cell by id (via the panel api — `panel.setActive` only fires `onDidActiveChange`). */
function setActive(id: string): void {
	if (!api) {
		throw new Error('dockview-svelte: Gridview is not mounted yet')
	}
	getPanelOrThrow(id).api.setActive()
}

let factory: ReturnType<typeof createGridviewFactory> | undefined

// External `layout` changes → apply via `fromJSON` (loop-break via `lastEmitted`).
$effect(() => {
	const current = api
	if (!current || !layout) return
	if (deepEqual(lastEmitted, layout)) return
	current.fromJSON(layout)
})

// Live `options` changes (orientation, etc.) → apply via `updateOptions`.
// NOTE: `opts` must be read before the `api` guard — otherwise the
// initial run returns early without tracking `options`, and later changes
// never re-trigger the effect.
$effect(() => {
	const opts = options
	if (!api) return
	api.updateOptions(opts)
})

onMount(() => {
	factory = createGridviewFactory(registry, context, {
		onDidActivePanelChange: (panel) => setActivePanel(panel as unknown as IGridviewPanel),
	})
	const createdApi = createGridview(container, {
		...options,
		orientation: options.orientation ?? Orientation.HORIZONTAL,
		createComponent: factory.createComponent,
	})
	// Apply a pre-existing `bind:layout` before exposing the api.
	if (layout) {
		createdApi.fromJSON(layout)
		lastEmitted = createdApi.toJSON()
		layout = lastEmitted
	}
	api = createdApi
	context.api = createdApi

	const createdHandle: GridviewHandle<W> = {
		api: createdApi,
		openPanel,
		registerWidget,
		removePanel,
		movePanel,
		setVisible,
		setActive,
	}
	handle = createdHandle

	// Bridge gridview events to callbacks, disposing on teardown.
	const subscriptions = [
		createdApi.onDidLayoutChange(() => {
			emitLayout()
			onDidLayoutChange?.()
		}),
		createdApi.onDidLayoutFromJSON(() => {
			refreshPanels()
			onDidLayoutFromJSON?.()
		}),
		createdApi.onDidAddPanel((panel: IGridviewPanel) => {
			refreshPanels()
			// External adds (e.g. `api.addPanel` escape hatch) activate the
			// new cell without a component-level event — same sync as the
			// `openPanel` path.
			setActivePanel(panel)
			onDidAddPanel?.(panel)
		}),
		createdApi.onDidRemovePanel((panel: IGridviewPanel) => {
			refreshPanels()
			if (activePanel?.id === panel.id) setActivePanel(createdApi.panels.at(-1))
			onDidRemovePanel?.(panel)
		}),
		createdApi.onDidActivePanelChange((panel: IGridviewPanel | undefined) => {
			// Focus-driven activation path (`registerPanel` wires
			// `onDidFocusChange` → `doSetGroupActive`). Programmatic
			// activation (`api.setActive`, `addPanel`) only fires the
			// per-panel event, handled via the factory hook below.
			setActivePanel(panel)
		}),
	]
	// Seed the initial panels before exposing the handle.
	refreshPanels()
	onReady?.({ api: createdApi, handle: createdHandle })

	return () => {
		for (const disposable of subscriptions) disposable.dispose()
		createdApi.dispose()
		api = undefined
		factory = undefined
		lastEmitted = undefined
	}
})
</script>

<div class="dv-svelte-gridview-root {className}" bind:this={container}>
	{#if children}
		{@render children()}
	{/if}
</div>

<style>
	.dv-svelte-gridview-root {
		width: 100%;
		height: 100%;
		position: relative;
	}
</style>
