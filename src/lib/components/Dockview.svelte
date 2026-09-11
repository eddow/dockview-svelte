<script lang="ts" generics="const W extends Widgets">
import type {
	AddPanelOptions,
	DockviewActivePanelChangeEvent,
	DockviewApi,
	DockviewComponentOptions,
	DockviewDidDropEvent,
	DockviewDndOverlayEvent,
	DockviewGroupPanel,
	DockviewLayoutMutationEvent,
	DockviewMaximizedGroupChangeEvent,
	DockviewPanelPinnedChangeEvent,
	DockviewPopoutGroupOptions,
	DockviewTabGroupChangeEvent,
	DockviewTabGroupCollapsedChangeEvent,
	DockviewTabGroupPanelChangeEvent,
	DockviewWillDropEvent,
	DockviewWillShowOverlayLocationEvent,
	FloatingGroupOptions,
	GroupDragEvent,
	IDockviewPanel,
	LayoutHistoryChangeEvent,
	MovePanelEvent,
	PopoutGroup,
	PopoutGroupChangePositionEvent,
	PopoutGroupChangeSizeEvent,
	SerializedDockview,
	SmartGuidesSnapEvent,
	SmartGuidesSnapTogetherEvent,
	TabDragEvent,
} from 'dockview'
import { DockviewComponent } from 'dockview'
import { onMount, type Snippet, setContext } from 'svelte'
import { DOCKVIEW_CONTEXT_KEY } from '$lib/core/context.js'
import { createDockviewFactory, type DockviewFactory } from '$lib/core/factory.svelte.js'
import { WidgetRegistry } from '$lib/core/registry.js'
import type {
	ActiveState,
	DockviewHandle,
	FloatingState,
	HeaderActionComponent,
	OpenPanelOptions,
	PanelHandle,
	ParamsOf,
	PopoutState,
	WatermarkComponent,
	WidgetDefinition,
	Widgets,
} from '$lib/core/types.js'

interface Props<W extends Widgets> {
	/** Widget registry: `{ [key]: { component, tab?, title? } }`. */
	widgets?: W
	/**
	 * `DockviewComponentOptions` passthrough (theme, keyboard, history, …).
	 *
	 * `createComponent` / `createTabComponent` are owned by the library (Svelte
	 * `mount` factories backed by the `widgets` registry) and cannot be
	 * overridden. The header-action factories are likewise owned when the
	 * `leftHeaderActions` / `rightHeaderActions` / `prefixHeaderActions` props
	 * are set (Svelte components win over the raw options). The remaining
	 * raw-dockview factories pass through untouched and are NOT Svelte-wrapped
	 * — use them only if you want to render those slots imperatively yourself:
	 * `createWatermarkComponent`, `createTabGroupChipComponent`,
	 * `createGroupDragGhostComponent`, `createContextMenuItemComponent`.
	 * (`defaultTabComponent` is a plain string key and works with the registry
	 * as-is.)
	 */
	options?: Omit<
		DockviewComponentOptions,
		| 'createComponent'
		| 'createTabComponent'
		| 'createLeftHeaderActionComponent'
		| 'createRightHeaderActionComponent'
		| 'createPrefixHeaderActionComponent'
	>
	/**
	 * Svelte components rendered into the group header slots (left of tabs,
	 * right of tabs, before everything). Each receives { api, containerApi,
	 * group } per group. Set props win over the raw options factories.
	 */
	leftHeaderActions?: HeaderActionComponent
	rightHeaderActions?: HeaderActionComponent
	prefixHeaderActions?: HeaderActionComponent
	/**
	 * Svelte empty-state overlay, rendered as a plain child when the dock has
	 * no panels. Receives `{ openPanel }` — no `IWatermarkRenderer` factory
	 * involved, so it gets context automatically like any Svelte child.
	 */
	watermark?: WatermarkComponent
	/** `bind:layout` — dockview JSON (`toJSON`/`fromJSON` shape). */
	layout?: SerializedDockview
	/** `bind:handle` — `{ api, openPanel, registerWidget }`. */
	handle?: DockviewHandle<W>
	/** `bind:active` — reactive `{ panel, group }` of the current active panel/group. */
	active?: ActiveState
	/** `bind:floating` — reactive `{ count, hasFloating }` of open floating windows. */
	floating?: FloatingState
	/** `bind:popout` — reactive `{ count, hasPopout }` of open popout windows. */
	popout?: PopoutState
	/** Extra classes for the root container. */
	class?: string
	/** Declarative widgets (`<DvWidget>` children) — alternative to the `widgets` prop. */
	children?: Snippet
	/** Fired once the component is mounted and `api` is ready. */
	onReady?: (event: { api: DockviewApi; handle: DockviewHandle<W> }) => void
	onDidLayoutChange?: () => void
	onDidLayoutFromJSON?: () => void
	onDidAddPanel?: (panel: IDockviewPanel) => void
	onDidRemovePanel?: (panel: IDockviewPanel) => void
	onDidAddGroup?: (group: DockviewGroupPanel) => void
	onDidRemoveGroup?: (group: DockviewGroupPanel) => void
	onDidActivePanelChange?: (event: DockviewActivePanelChangeEvent) => void
	onDidActiveGroupChange?: (group: DockviewGroupPanel | undefined) => void
	onDidMovePanel?: (event: MovePanelEvent) => void
	onWillDrop?: (event: DockviewWillDropEvent) => void
	onDidDrop?: (event: DockviewDidDropEvent) => void
	onWillDragPanel?: (event: TabDragEvent) => void
	onWillDragGroup?: (event: GroupDragEvent) => void
	onWillMutateLayout?: (event: DockviewLayoutMutationEvent) => void
	onDidMutateLayout?: (event: DockviewLayoutMutationEvent) => void
	onWillShowOverlay?: (event: DockviewWillShowOverlayLocationEvent) => void
	onUnhandledDragOver?: (event: DockviewDndOverlayEvent) => void
	onDidAddPopoutGroup?: (group: PopoutGroup) => void
	onDidRemovePopoutGroup?: (group: PopoutGroup) => void
	onDidPopoutGroupSizeChange?: (event: PopoutGroupChangeSizeEvent) => void
	onDidPopoutGroupPositionChange?: (event: PopoutGroupChangePositionEvent) => void
	onDidOpenPopoutWindowFail?: () => void
	onDidCreateTabGroup?: (event: DockviewTabGroupChangeEvent) => void
	onDidDestroyTabGroup?: (event: DockviewTabGroupChangeEvent) => void
	onDidAddPanelToTabGroup?: (event: DockviewTabGroupPanelChangeEvent) => void
	onDidRemovePanelFromTabGroup?: (event: DockviewTabGroupPanelChangeEvent) => void
	onDidTabGroupChange?: (event: DockviewTabGroupChangeEvent) => void
	onDidTabGroupCollapsedChange?: (event: DockviewTabGroupCollapsedChangeEvent) => void
	onDidPanelPinnedChange?: (event: DockviewPanelPinnedChangeEvent) => void
	onDidMaximizedGroupChange?: (event: DockviewMaximizedGroupChangeEvent) => void
	onDidChangeHistory?: (event: LayoutHistoryChangeEvent) => void
	onDidSnapFloat?: (event: SmartGuidesSnapEvent) => void
	onDidSnapTogether?: (event: SmartGuidesSnapTogetherEvent) => void
}

let {
	widgets = {} as W,
	options = {},
	watermark,
	leftHeaderActions,
	rightHeaderActions,
	prefixHeaderActions,
	layout = $bindable(),
	handle = $bindable(),
	active = $bindable({ panel: undefined, group: undefined }),
	floating = $bindable({ count: 0, hasFloating: false }),
	popout = $bindable({ count: 0, hasPopout: false }),
	class: className = '',
	children,
	onReady,
	onDidLayoutChange,
	onDidLayoutFromJSON,
	onDidAddPanel,
	onDidRemovePanel,
	onDidAddGroup,
	onDidRemoveGroup,
	onDidActivePanelChange,
	onDidActiveGroupChange,
	onDidMovePanel,
	onWillDrop,
	onDidDrop,
	onWillDragPanel,
	onWillDragGroup,
	onWillMutateLayout,
	onDidMutateLayout,
	onWillShowOverlay,
	onUnhandledDragOver,
	onDidAddPopoutGroup,
	onDidRemovePopoutGroup,
	onDidPopoutGroupSizeChange,
	onDidPopoutGroupPositionChange,
	onDidOpenPopoutWindowFail,
	onDidCreateTabGroup,
	onDidDestroyTabGroup,
	onDidAddPanelToTabGroup,
	onDidRemovePanelFromTabGroup,
	onDidTabGroupChange,
	onDidTabGroupCollapsedChange,
	onDidPanelPinnedChange,
	onDidMaximizedGroupChange,
	onDidChangeHistory,
	onDidSnapFloat,
	onDidSnapTogether,
}: Props<W> = $props()

let container: HTMLElement
let component: DockviewComponent | undefined
let factory: DockviewFactory | undefined
let api = $state<DockviewApi | undefined>(undefined)
/** Panel count mirror — drives the Svelte `watermark` overlay. */
let panelCount = $state(0)

/** Refresh `bind:floating` / `bind:popout` + `panelCount` from the live layout. */
function refreshCounts(): void {
	if (!component) return
	const floatCount = component.api.groups.filter((g) => g.api.location.type === 'floating').length
	const popoutCount = component.api.getPopouts().length
	floating = { count: floatCount, hasFloating: floatCount > 0 }
	popout = { count: popoutCount, hasPopout: popoutCount > 0 }
	panelCount = component.api.panels.length
}

const registry = new WidgetRegistry()
const counters = new Map<string, number>()

// Stable `registerWidget`, shared by context and handle.
function registerWidget(key: string, def: WidgetDefinition): void {
	registry.register(key, def)
}

function unregisterWidget(key: string): void {
	registry.unregister(key)
}

// Context for descendant widgets (api is populated after mount).
const context = $state({
	api: undefined as DockviewApi | undefined,
	registerWidget,
	unregisterWidget,
	kind: 'dockview' as const,
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

/**
 * `bind:layout` loop-break: the serialization of the last layout we
 * emitted or applied.
 *
 * Kept as a **string**, not the object, because the usual save/restore flow
 * round-trips through `JSON.stringify`/`JSON.parse` — which drops the
 * `undefined`-valued keys that `toJSON()` emits (`params`, `pinned`,
 * `renderer`, …). `deepEqual` treats `{ k: undefined }` and `{}` as
 * different, so comparing the canonical object with a round-tripped one
 * never matches: re-applying the *current* layout would run `fromJSON`
 * again, tearing down and rebuilding every panel (losing per-panel state).
 * Stringifying both sides drops `undefined` consistently, so an unchanged
 * layout is recognised as such.
 */
let lastEmittedJson: string | undefined

/** Serialize the current layout and push it to the bound `layout`. */
function emitLayout(): void {
	if (!component) return
	const json = component.api.toJSON()
	lastEmittedJson = JSON.stringify(json)
	layout = json
	refreshCounts()
}

function openPanel<K extends keyof W & string>(
	key: K,
	opts?: OpenPanelOptions<ParamsOf<W[K]['component']>>
): PanelHandle<ParamsOf<W[K]['component']>> {
	if (!api || !factory) {
		throw new Error('dockview-svelte: Dockview is not mounted yet')
	}
	const def = registry.get(key)
	if (!def) {
		throw new Error(`dockview-svelte: unknown widget "${key}"`)
	}

	const title = opts?.title ?? def.title ?? key
	const id = opts?.id ?? nextId(key)

	const addOptions = {
		...(opts ?? {}),
		id,
		title,
		component: key,
		tabComponent: key,
		params: opts?.params,
	} as AddPanelOptions

	const panel = api.addPanel(addOptions)
	// `addPanel` fires `onDidAddPanel` (which refreshes counts) but not a layout
	// event — emit the layout directly so `bind:layout` reflects the new panel.
	emitLayout()

	const state = factory.getState(id)
	return { id, panel, api: panel.api, state: state! } as PanelHandle<ParamsOf<W[K]['component']>>
}

/**
 * Float an existing panel or group into its own window.
 * Accepts an `IDockviewPanel`, a `DockviewGroupPanel`, or a panel id string.
 */
function float(
	target: IDockviewPanel | DockviewGroupPanel | string,
	options?: FloatingGroupOptions
): void {
	if (!api) {
		throw new Error('dockview-svelte: Dockview is not mounted yet')
	}
	const item =
		typeof target === 'string'
			? (api.getPanel(target) ?? api.groups.find((g) => g.id === target))
			: target
	if (!item) {
		throw new Error(`dockview-svelte: unknown panel or group "${target}"`)
	}
	api.addFloatingGroup(item, options)
}

/**
 * Pop an existing panel or group out into its own browser window.
 * Accepts an `IDockviewPanel`, a `DockviewGroupPanel`, or a panel id string.
 * Resolves `true` on success, `false` if the popout window failed to open.
 */
function popoutGroup(
	target: IDockviewPanel | DockviewGroupPanel | string,
	options?: DockviewPopoutGroupOptions
): Promise<boolean> {
	if (!api) {
		throw new Error('dockview-svelte: Dockview is not mounted yet')
	}
	const item =
		typeof target === 'string'
			? (api.getPanel(target) ?? api.groups.find((g) => g.id === target))
			: target
	if (!item) {
		throw new Error(`dockview-svelte: unknown panel or group "${target}"`)
	}
	return api.addPopoutGroup(item, options)
}

/** Dock every floating window back into the main grid. */
function dockAll(): void {
	if (!api) {
		throw new Error('dockview-svelte: Dockview is not mounted yet')
	}
	// `api.groups` includes floating groups — target the first grid group so
	// floating panels actually move back (moving into a floating group is a no-op).
	const grid = api.groups.find((g) => g.api.location.type === 'grid') ?? api.groups[0]
	if (!grid) return
	for (const panel of [...api.panels]) {
		if (panel.api.location.type !== 'grid') {
			panel.api.moveTo({ group: grid, position: 'center' })
		}
	}
}

// External `layout` changes → apply via `fromJSON` (loop-break via `lastEmittedJson`).
$effect(() => {
	const current = api
	if (!current || !layout) return
	// Compare the *serialized* form — a JSON-round-tripped save/restore must
	// be recognised as the current layout (see `lastEmittedJson`).
	const json = JSON.stringify(layout)
	if (json === lastEmittedJson) return
	// Record before applying: `fromJSON` re-enters this effect through the
	// buffered `onDidLayoutChange` → `emitLayout`.
	lastEmittedJson = json
	current.fromJSON(layout)
})

// Live `options` changes (theme, etc.) → apply via `updateOptions`.
// The constructor reads `options` once; without this, later prop changes
// (e.g. `options={{ theme: themes[name] }}`) are silently ignored.
// NOTE: `opts` must be read before the `component` guard — otherwise the
// initial run returns early without tracking `options`, and later theme
// changes never re-trigger the effect.
$effect(() => {
	const opts = options
	if (!component) return
	component.updateOptions(opts)
})

onMount(() => {
	factory = createDockviewFactory(registry, context, {
		left: leftHeaderActions,
		right: rightHeaderActions,
		prefix: prefixHeaderActions,
	})
	const headerFactories = factory.createHeaderActionFactories
	const created = new DockviewComponent(container, {
		...options,
		createComponent: factory.createComponent,
		createTabComponent: factory.createTabComponent,
		...(headerFactories.left ? { createLeftHeaderActionComponent: headerFactories.left } : {}),
		...(headerFactories.right ? { createRightHeaderActionComponent: headerFactories.right } : {}),
		...(headerFactories.prefix
			? { createPrefixHeaderActionComponent: headerFactories.prefix }
			: {}),
	})
	// Apply a pre-existing `bind:layout` (e.g. a hard-coded initial layout)
	// before exposing the api — the `$effect` above only reacts to changes.
	if (layout) {
		created.api.fromJSON(layout)
		const canonical = created.api.toJSON()
		lastEmittedJson = JSON.stringify(canonical)
		layout = canonical
	}
	component = created
	api = created.api
	context.api = created.api

	const createdHandle: DockviewHandle<W> = {
		api: created.api,
		openPanel,
		registerWidget,
		float,
		dockAll,
		popout: popoutGroup,
	}
	handle = createdHandle

	// Seed the initial active panel/group (before any change event fires).
	active = { panel: created.api.activePanel, group: created.api.activeGroup }
	refreshCounts()

	const apiHandle = created.api

	// Bridge dockview events to callbacks, disposing on teardown.
	const subscriptions = [
		apiHandle.onDidLayoutChange(() => {
			emitLayout()
			onDidLayoutChange?.()
		}),
		apiHandle.onDidLayoutFromJSON(() => {
			refreshCounts()
			onDidLayoutFromJSON?.()
		}),
		apiHandle.onDidAddPanel((panel) => {
			refreshCounts()
			onDidAddPanel?.(panel)
		}),
		apiHandle.onDidRemovePanel((panel) => {
			refreshCounts()
			onDidRemovePanel?.(panel)
		}),
		apiHandle.onDidAddGroup((group) => {
			refreshCounts()
			onDidAddGroup?.(group)
		}),
		apiHandle.onDidRemoveGroup((group) => {
			refreshCounts()
			onDidRemoveGroup?.(group)
		}),
		apiHandle.onDidActivePanelChange((event) => {
			onDidActivePanelChange?.(event)
			active = { panel: event.panel, group: apiHandle.activeGroup }
		}),
		apiHandle.onDidActiveGroupChange((group) => {
			onDidActiveGroupChange?.(group)
			active = { panel: apiHandle.activePanel, group }
		}),
		apiHandle.onDidMovePanel((event) => {
			refreshCounts()
			onDidMovePanel?.(event)
		}),
		apiHandle.onWillDrop((event) => onWillDrop?.(event)),
		apiHandle.onDidDrop((event) => onDidDrop?.(event)),
		apiHandle.onWillDragPanel((event) => onWillDragPanel?.(event)),
		apiHandle.onWillDragGroup((event) => onWillDragGroup?.(event)),
		apiHandle.onWillMutateLayout((event) => onWillMutateLayout?.(event)),
		apiHandle.onDidMutateLayout((event) => onDidMutateLayout?.(event)),
		apiHandle.onWillShowOverlay((event) => onWillShowOverlay?.(event)),
		apiHandle.onUnhandledDragOver((event) => onUnhandledDragOver?.(event)),
		apiHandle.onDidAddPopoutGroup((group) => {
			refreshCounts()
			onDidAddPopoutGroup?.(group)
		}),
		apiHandle.onDidRemovePopoutGroup((group) => {
			refreshCounts()
			onDidRemovePopoutGroup?.(group)
		}),
		apiHandle.onDidPopoutGroupSizeChange((event) => onDidPopoutGroupSizeChange?.(event)),
		apiHandle.onDidPopoutGroupPositionChange((event) => onDidPopoutGroupPositionChange?.(event)),
		apiHandle.onDidOpenPopoutWindowFail(() => onDidOpenPopoutWindowFail?.()),
		apiHandle.onDidCreateTabGroup((event) => onDidCreateTabGroup?.(event)),
		apiHandle.onDidDestroyTabGroup((event) => onDidDestroyTabGroup?.(event)),
		apiHandle.onDidAddPanelToTabGroup((event) => onDidAddPanelToTabGroup?.(event)),
		apiHandle.onDidRemovePanelFromTabGroup((event) => onDidRemovePanelFromTabGroup?.(event)),
		apiHandle.onDidTabGroupChange((event) => onDidTabGroupChange?.(event)),
		apiHandle.onDidTabGroupCollapsedChange((event) => onDidTabGroupCollapsedChange?.(event)),
		apiHandle.onDidPanelPinnedChange((event) => onDidPanelPinnedChange?.(event)),
		apiHandle.onDidMaximizedGroupChange((event) => onDidMaximizedGroupChange?.(event)),
		apiHandle.onDidChangeHistory((event) => onDidChangeHistory?.(event)),
		apiHandle.onDidSnapFloat((event) => onDidSnapFloat?.(event)),
		apiHandle.onDidSnapTogether((event) => onDidSnapTogether?.(event)),
	]
	onReady?.({ api: created.api, handle: createdHandle })

	return () => {
		for (const disposable of subscriptions) disposable.dispose()
		created.dispose()
		component = undefined
		api = undefined
		factory = undefined
		lastEmittedJson = undefined
	}
})
</script>

<div class="dv-svelte-root {className}" bind:this={container}>
	{#if watermark && panelCount === 0 && handle}
		{@const Watermark = watermark}
		<div class="dv-svelte-watermark-overlay">
			<Watermark openPanel={handle.openPanel} />
		</div>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</div>

<style>
	.dv-svelte-root {
		width: 100%;
		height: 100%;
		position: relative;
	}
	.dv-svelte-watermark-overlay {
		position: absolute;
		inset: 0;
		/* Above dockview's own `.dv-watermark-container` (z-index 1, later in
		DOM) — otherwise it paints over us and swallows overlay clicks. */
		z-index: 2;
	}
</style>
