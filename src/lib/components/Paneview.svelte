<script lang="ts" generics="W extends PaneviewWidgets">
import type {
	IPaneviewPanel,
	PaneviewApi,
	PaneviewComponentOptions,
	PaneviewDidDropEvent,
	PaneviewDndOverlayEvent,
	SerializedPaneview,
} from 'dockview'
import { createPaneview } from 'dockview'
import { onMount, setContext } from 'svelte'
import { DOCKVIEW_CONTEXT_KEY, type PaneviewContext } from '$lib/core/context.js'
import { createPaneviewFactory } from '$lib/core/paneview.svelte.js'
import { PaneviewWidgetRegistry } from '$lib/core/registry.js'
import type {
	PaneviewHandle,
	PaneviewOpenPanelOptions,
	PaneviewPanelHandle,
	PaneviewParamsOf,
	PaneviewWidgetDefinition,
	PaneviewWidgets,
} from '$lib/core/types.js'
import { deepEqual } from '$lib/core/utils.js'

interface Props<W extends PaneviewWidgets> {
	/** Widget registry: `{ [key]: { component, header?, title? } }`. */
	widgets?: W
	/**
	 * `PaneviewComponentOptions` passthrough (disableDnd, …).
	 *
	 * `createComponent` / `createHeaderComponent` are owned by the library
	 * (Svelte `mount` factories backed by the `widgets` registry) and cannot
	 * be overridden.
	 */
	options?: Omit<PaneviewComponentOptions, 'createComponent' | 'createHeaderComponent'>
	/** `bind:layout` — paneview JSON (`toJSON`/`fromJSON` shape). */
	layout?: SerializedPaneview
	/** `bind:handle` — `{ api, openPanel, registerWidget, removePanel, movePanel, setVisible, setExpanded }`. */
	handle?: PaneviewHandle<W>
	/**
	 * `bind:panels` — reactive list of current panes (`api.panels` snapshot).
	 * Refreshed on layout/add/remove/FromJSON, so `panels.length` is the
	 * sveltish pane count — no manual `onDidAddView` counting needed.
	 */
	panels?: IPaneviewPanel[]
	/** Extra classes for the root container. */
	class?: string
	/** Fired once the component is mounted and `api` is ready. */
	onReady?: (event: { api: PaneviewApi; handle: PaneviewHandle<W> }) => void
	onDidLayoutChange?: () => void
	onDidLayoutFromJSON?: () => void
	onDidAddView?: (panel: IPaneviewPanel) => void
	onDidRemoveView?: (panel: IPaneviewPanel) => void
	onDidDrop?: (event: PaneviewDidDropEvent) => void
	onUnhandledDragOver?: (event: PaneviewDndOverlayEvent) => void
}

let {
	widgets = {} as W,
	options = {},
	layout = $bindable(),
	handle = $bindable(),
	panels = $bindable([]),
	class: className = '',
	onReady,
	onDidLayoutChange,
	onDidLayoutFromJSON,
	onDidAddView,
	onDidRemoveView,
	onDidDrop,
	onUnhandledDragOver,
}: Props<W> = $props()

let container: HTMLElement
let api = $state<PaneviewApi | undefined>(undefined)

const registry = new PaneviewWidgetRegistry()
const counters = new Map<string, number>()

// Stable `registerWidget`, shared by context and handle.
function registerWidget(key: string, def: PaneviewWidgetDefinition): void {
	registry.register(key, def)
}

// Context for descendant widgets (api is populated after mount).
const context = $state<PaneviewContext>({ api: undefined, registerWidget })
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
let lastEmitted: SerializedPaneview | undefined

/** Serialize the current layout and push it to the bound `layout`. */
function emitLayout(): void {
	if (!api) return
	const json = api.toJSON()
	lastEmitted = json
	layout = json
	refreshPanels()
}

/** Refresh `bind:panels` from the live panes. */
function refreshPanels(): void {
	if (!api) return
	panels = [...api.panels]
}

function getPanelOrThrow(id: string): import('dockview').PaneviewPanel {
	const panel = api!.getPanel(id)
	if (!panel) {
		throw new Error(`dockview-svelte: unknown panel "${id}"`)
	}
	return panel as import('dockview').PaneviewPanel
}

function openPanel<K extends keyof W & string>(
	key: K,
	opts?: PaneviewOpenPanelOptions<PaneviewParamsOf<W[K]['component']>>
): PaneviewPanelHandle<PaneviewParamsOf<W[K]['component']>> {
	if (!api) {
		throw new Error('dockview-svelte: Paneview is not mounted yet')
	}
	const def = registry.get(key)
	if (!def) {
		throw new Error(`dockview-svelte: unknown widget "${key}"`)
	}

	const id = opts?.id ?? nextId(key)
	// Title resolves through the same three-tier chain as Dockview
	// (explicit → per-widget → widget key), evaluated once at open time.
	// `headerComponent` reuses the widget key so `createHeaderComponent`
	// can resolve the header off the same registry entry; omit it when the
	// widget defines no header so dockview falls back to `DefaultHeader`.
	const panel = api.addPanel({
		...(opts ?? {}),
		id,
		component: key,
		headerComponent: def.header ? key : undefined,
		title: opts?.title ?? def.title ?? key,
		params: opts?.params ?? {},
	})

	const state = factory?.getState(id)
	// `state` is `PaneviewState<Record<string, unknown>>` at the factory
	// boundary; `PaneviewState<P>` is invariant in `P` (params is read/write),
	// so the runtime-known `P` requires an `unknown` bridge.
	return { id, panel, api: panel.api, state: state! } as unknown as PaneviewPanelHandle<
		PaneviewParamsOf<W[K]['component']>
	>
}

/** Remove a pane by panel id. */
function removePanel(id: string): void {
	if (!api) {
		throw new Error('dockview-svelte: Paneview is not mounted yet')
	}
	api.removePanel(getPanelOrThrow(id))
}

/** Move a pane from one index to another. */
function movePanel(from: number, to: number): void {
	if (!api) {
		throw new Error('dockview-svelte: Paneview is not mounted yet')
	}
	api.movePanel(from, to)
}

/** Show or hide a pane by id (via the panel api — `PaneviewApi` has no `setVisible`). */
function setVisible(id: string, visible: boolean): void {
	if (!api) {
		throw new Error('dockview-svelte: Paneview is not mounted yet')
	}
	getPanelOrThrow(id).setVisible(visible)
}

/** Expand or collapse a pane by id. */
function setExpanded(id: string, expanded: boolean): void {
	if (!api) {
		throw new Error('dockview-svelte: Paneview is not mounted yet')
	}
	getPanelOrThrow(id).setExpanded(expanded)
}

let factory: ReturnType<typeof createPaneviewFactory> | undefined

// External `layout` changes → apply via `fromJSON` (loop-break via `lastEmitted`).
$effect(() => {
	const current = api
	if (!current || !layout) return
	if (deepEqual(lastEmitted, layout)) return
	current.fromJSON(layout)
})

// Live `options` changes → apply via `updateOptions`.
// NOTE: `opts` must be read before the `api` guard — otherwise the
// initial run returns early without tracking `options`, and later changes
// never re-trigger the effect.
$effect(() => {
	const opts = options
	if (!api) return
	api.updateOptions(opts)
})

onMount(() => {
	factory = createPaneviewFactory(registry, context)
	const createdApi = createPaneview(container, {
		...options,
		createComponent: factory.createComponent,
		createHeaderComponent: factory.createHeaderComponent,
	})
	// Apply a pre-existing `bind:layout` before exposing the api.
	if (layout) {
		createdApi.fromJSON(layout)
		lastEmitted = createdApi.toJSON()
		layout = lastEmitted
	}
	api = createdApi
	context.api = createdApi

	const createdHandle: PaneviewHandle<W> = {
		api: createdApi,
		openPanel,
		registerWidget,
		removePanel,
		movePanel,
		setVisible,
		setExpanded,
	}
	handle = createdHandle

	// Bridge paneview events to callbacks, disposing on teardown.
	const subscriptions = [
		createdApi.onDidLayoutChange(() => {
			emitLayout()
			onDidLayoutChange?.()
		}),
		createdApi.onDidLayoutFromJSON(() => {
			refreshPanels()
			onDidLayoutFromJSON?.()
		}),
		createdApi.onDidAddView((panel: IPaneviewPanel) => {
			refreshPanels()
			onDidAddView?.(panel)
		}),
		createdApi.onDidRemoveView((panel: IPaneviewPanel) => {
			refreshPanels()
			onDidRemoveView?.(panel)
		}),
		createdApi.onDidDrop((event: PaneviewDidDropEvent) => {
			onDidDrop?.(event)
		}),
		createdApi.onUnhandledDragOver((event: PaneviewDndOverlayEvent) => {
			onUnhandledDragOver?.(event)
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

<div class="dv-svelte-paneview-root {className}" bind:this={container}></div>

<style>
	.dv-svelte-paneview-root {
		width: 100%;
		height: 100%;
		position: relative;
	}
</style>
