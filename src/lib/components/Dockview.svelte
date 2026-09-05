<script lang="ts" generics="W extends Widgets">
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
		DockviewTabGroupChangeEvent,
		DockviewTabGroupCollapsedChangeEvent,
		DockviewTabGroupPanelChangeEvent,
		DockviewWillDropEvent,
		DockviewWillShowOverlayLocationEvent,
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
		TabDragEvent
	} from 'dockview'
	import { DockviewComponent } from 'dockview'
	import { onMount, setContext } from 'svelte'
	import { DOCKVIEW_CONTEXT_KEY } from '$lib/core/context.js'
	import { createDockviewFactory, type DockviewFactory } from '$lib/core/factory.svelte.js'
	import { WidgetRegistry } from '$lib/core/registry.js'
	import type {
		ActiveState,
		DockviewHandle,
		OpenPanelOptions,
		PanelHandle,
		ParamsOf,
		WidgetDefinition,
		Widgets
	} from '$lib/core/types.js'
	import { deepEqual } from '$lib/core/utils.js'

	interface Props<W extends Widgets> {
		/** Widget registry: `{ [key]: { component, tab?, title? } }`. */
		widgets?: W
		/** `DockviewComponentOptions` passthrough (theme, keyboard, history, …). */
		options?: Omit<DockviewComponentOptions, 'createComponent' | 'createTabComponent'>
		/** `bind:layout` — dockview JSON (`toJSON`/`fromJSON` shape). */
		layout?: SerializedDockview
		/** `bind:handle` — `{ api, openPanel, registerWidget }`. */
		handle?: DockviewHandle<W>
		/** `bind:active` — reactive `{ panel, group }` of the current active panel/group. */
		active?: ActiveState
		/** Extra classes for the root container. */
		class?: string
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
		layout = $bindable(),
		handle = $bindable(),
		active = $bindable({ panel: undefined, group: undefined }),
		class: className = '',
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
		onDidSnapTogether
	}: Props<W> = $props()

	let container: HTMLElement
	let component: DockviewComponent | undefined
	let factory: DockviewFactory | undefined
	let api = $state<DockviewApi | undefined>(undefined)

	const registry = new WidgetRegistry()
	const counters = new Map<string, number>()

	// Stable `registerWidget`, shared by context and handle.
	function registerWidget(key: string, def: WidgetDefinition): void {
		registry.register(key, def)
	}

	// Context for descendant widgets (api is populated after mount).
	const context = $state({ api: undefined as DockviewApi | undefined, registerWidget })
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
	let lastEmitted: SerializedDockview | undefined

	/** Serialize the current layout and push it to the bound `layout`. */
	function emitLayout(): void {
		if (!component) return
		const json = component.api.toJSON()
		lastEmitted = json
		layout = json
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
			params: opts?.params
		} as AddPanelOptions

		const panel = api.addPanel(addOptions)

		const state = factory.getState(id)
		return { id, panel, api: panel.api, state: state! } as PanelHandle<ParamsOf<W[K]['component']>>
	}

	// External `layout` changes → apply via `fromJSON` (loop-break via `lastEmitted`).
	$effect(() => {
		const current = api
		if (!current || !layout) return
		if (deepEqual(lastEmitted, layout)) return
		current.fromJSON(layout)
	})

	onMount(() => {
		factory = createDockviewFactory(registry)
		const created = new DockviewComponent(container, {
			...options,
			createComponent: factory.createComponent,
			createTabComponent: factory.createTabComponent
		})
		component = created
		api = created.api
		context.api = created.api

		const createdHandle: DockviewHandle<W> = {
			api: created.api,
			openPanel,
			registerWidget
		}
		handle = createdHandle

		// Seed the initial active panel/group (before any change event fires).
		active = { panel: created.api.activePanel, group: created.api.activeGroup }

		const apiHandle = created.api

		// Bridge dockview events to callbacks, disposing on teardown.
		const subscriptions = [
			apiHandle.onDidLayoutChange(() => {
				emitLayout()
				onDidLayoutChange?.()
			}),
			apiHandle.onDidLayoutFromJSON(() => {
				onDidLayoutFromJSON?.()
			}),
			apiHandle.onDidAddPanel((panel) => onDidAddPanel?.(panel)),
			apiHandle.onDidRemovePanel((panel) => onDidRemovePanel?.(panel)),
			apiHandle.onDidAddGroup((group) => onDidAddGroup?.(group)),
			apiHandle.onDidRemoveGroup((group) => onDidRemoveGroup?.(group)),
			apiHandle.onDidActivePanelChange((event) => {
				onDidActivePanelChange?.(event)
				active = { panel: event.panel, group: apiHandle.activeGroup }
			}),
			apiHandle.onDidActiveGroupChange((group) => {
				onDidActiveGroupChange?.(group)
				active = { panel: apiHandle.activePanel, group }
			}),
			apiHandle.onDidMovePanel((event) => onDidMovePanel?.(event)),
			apiHandle.onWillDrop((event) => onWillDrop?.(event)),
			apiHandle.onDidDrop((event) => onDidDrop?.(event)),
			apiHandle.onWillDragPanel((event) => onWillDragPanel?.(event)),
			apiHandle.onWillDragGroup((event) => onWillDragGroup?.(event)),
			apiHandle.onWillMutateLayout((event) => onWillMutateLayout?.(event)),
			apiHandle.onDidMutateLayout((event) => onDidMutateLayout?.(event)),
			apiHandle.onWillShowOverlay((event) => onWillShowOverlay?.(event)),
			apiHandle.onUnhandledDragOver((event) => onUnhandledDragOver?.(event)),
			apiHandle.onDidAddPopoutGroup((group) => onDidAddPopoutGroup?.(group)),
			apiHandle.onDidRemovePopoutGroup((group) => onDidRemovePopoutGroup?.(group)),
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
			apiHandle.onDidSnapTogether((event) => onDidSnapTogether?.(event))
		]
		onReady?.({ api: created.api, handle: createdHandle })

		return () => {
			for (const disposable of subscriptions) disposable.dispose()
			created.dispose()
			component = undefined
			api = undefined
			factory = undefined
			lastEmitted = undefined
		}
	})
</script>

<div class="dv-svelte-root {className}" bind:this={container}></div>

<style>
	.dv-svelte-root {
		width: 100%;
		height: 100%;
	}
</style>
