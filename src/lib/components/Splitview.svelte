<script lang="ts" generics="W extends SplitviewWidgets">
	import type {
		ISplitviewPanel,
		IView,
		SerializedSplitview,
		SplitviewApi,
		SplitviewComponentOptions
	} from 'dockview'
	import { createSplitview } from 'dockview'
	import { onMount, type Snippet, setContext } from 'svelte'
	import { DOCKVIEW_CONTEXT_KEY, type SplitviewContext } from '$lib/core/context.js'
	import { SplitviewWidgetRegistry } from '$lib/core/registry.js'
	import { createSplitviewFactory } from '$lib/core/splitview.svelte.js'
	import type {
		SplitviewHandle,
		SplitviewOpenPanelOptions,
		SplitviewPanelHandle,
		SplitviewParamsOf,
		SplitviewWidgetDefinition,
		SplitviewWidgets
	} from '$lib/core/types.js'
	import { deepEqual } from '$lib/core/utils.js'

	interface Props<W extends SplitviewWidgets> {
		/** Widget registry: `{ [key]: { component } }` — no tabs or titles, splitviews have no headers. */
		widgets?: W
		/**
		 * `SplitviewComponentOptions` passthrough (orientation, proportionalLayout, …).
		 *
		 * `createComponent` is owned by the library (Svelte `mount` factory
		 * backed by the `widgets` registry) and cannot be overridden.
		 */
		options?: Omit<SplitviewComponentOptions, 'createComponent'>
		/** `bind:layout` — splitview JSON (`toJSON`/`fromJSON` shape). */
		layout?: SerializedSplitview
		/** `bind:handle` — `{ api, openPanel, registerWidget, removePanel, movePanel, setVisible, setActive }`. */
		handle?: SplitviewHandle<W>
		/**
		 * `bind:views` — reactive list of current views (`api.panels` snapshot).
		 * Refreshed on layout/add/remove/FromJSON, so `views.length` is the
		 * sveltish view count — no manual `onDidAddView` counting needed.
		 */
		views?: ISplitviewPanel[]
		/** Extra classes for the root container. */
		class?: string
		/** Declarative widgets (`<DvWidget>` children) — alternative to the `widgets` prop. */
		children?: Snippet
		/** Fired once the component is mounted and `api` is ready. */
		onReady?: (event: { api: SplitviewApi; handle: SplitviewHandle<W> }) => void
		onDidLayoutChange?: () => void
		onDidLayoutFromJSON?: () => void
		onDidAddView?: (view: IView) => void
		onDidRemoveView?: (view: IView) => void
	}

	let {
		widgets = {} as W,
		options = {},
		layout = $bindable(),
		handle = $bindable(),
		views = $bindable([]),
		class: className = '',
		children,
		onReady,
		onDidLayoutChange,
		onDidLayoutFromJSON,
		onDidAddView,
		onDidRemoveView
	}: Props<W> = $props()

	let container: HTMLElement
	let api = $state<SplitviewApi | undefined>(undefined)

	const registry = new SplitviewWidgetRegistry()
	const counters = new Map<string, number>()

	// Stable `registerWidget`, shared by context and handle.
	function registerWidget(key: string, def: SplitviewWidgetDefinition): void {
		registry.register(key, def)
	}

	function unregisterWidget(key: string): void {
		registry.unregister(key)
	}

	// Context for descendant widgets (api is populated after mount).
	const context = $state<SplitviewContext>({
		api: undefined,
		registerWidget,
		unregisterWidget,
		kind: 'splitview'
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
	let lastEmitted: SerializedSplitview | undefined

	/** Serialize the current layout and push it to the bound `layout`. */
	function emitLayout(): void {
		if (!api) return
		const json = api.toJSON()
		lastEmitted = json
		layout = json
		refreshViews()
	}

	/** Refresh `bind:views` from the live panels. */
	function refreshViews(): void {
		if (!api) return
		views = [...api.panels]
	}

	function openPanel<K extends keyof W & string>(
		key: K,
		opts?: SplitviewOpenPanelOptions<SplitviewParamsOf<W[K]['component']>>
	): SplitviewPanelHandle<SplitviewParamsOf<W[K]['component']>> {
		if (!api) {
			throw new Error('dockview-svelte: Splitview is not mounted yet')
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
			params: opts?.params ?? {}
		})
		// `addPanel` is synchronous but fires no event the component observes for
		// the open path itself (events cover external mutations) — refresh the
		// bound views/layout directly so `bind:views` reflects the new panel.
		emitLayout()

		const state = factory?.getState(id)
		// `state` is `SplitviewState<Record<string, unknown>>` at the factory
		// boundary; `SplitviewState<P>` is invariant in `P` (params is read/write),
		// so the runtime-known `P` requires an `unknown` bridge.
		return { id, panel, api: panel.api, state: state! } as unknown as SplitviewPanelHandle<
			SplitviewParamsOf<W[K]['component']>
		>
	}

	/** Remove a view by panel id. */
	function removePanel(id: string): void {
		if (!api) {
			throw new Error('dockview-svelte: Splitview is not mounted yet')
		}
		const panel = api.getPanel(id)
		if (!panel) {
			throw new Error(`dockview-svelte: unknown panel "${id}"`)
		}
		api.removePanel(panel)
	}

	/** Move a view from one index to another. */
	function movePanel(from: number, to: number): void {
		if (!api) {
			throw new Error('dockview-svelte: Splitview is not mounted yet')
		}
		api.movePanel(from, to)
	}

	function getPanelOrThrow(id: string): import('dockview').SplitviewPanel {
		const panel = api!.getPanel(id)
		if (!panel) {
			throw new Error(`dockview-svelte: unknown panel "${id}"`)
		}
		return panel as import('dockview').SplitviewPanel
	}

	/** Show or hide a split pane by id (via the panel view — `SplitviewApi` has no `setVisible`). */
	function setVisible(id: string, visible: boolean): void {
		if (!api) {
			throw new Error('dockview-svelte: Splitview is not mounted yet')
		}
		getPanelOrThrow(id).setVisible(visible)
	}

	/** Activate a split pane by id (via the panel view — `SplitviewApi` has no `setActive`). */
	function setActive(id: string): void {
		if (!api) {
			throw new Error('dockview-svelte: Splitview is not mounted yet')
		}
		getPanelOrThrow(id).setActive(true)
	}

	let factory: ReturnType<typeof createSplitviewFactory> | undefined

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
		factory = createSplitviewFactory(registry, context)
		const createdApi = createSplitview(container, {
			...options,
			createComponent: factory.createComponent
		})
		// Apply a pre-existing `bind:layout` before exposing the api.
		if (layout) {
			createdApi.fromJSON(layout)
			lastEmitted = createdApi.toJSON()
			layout = lastEmitted
		}
		api = createdApi
		context.api = createdApi

		const createdHandle: SplitviewHandle<W> = {
			api: createdApi,
			openPanel,
			registerWidget,
			removePanel,
			movePanel,
			setVisible,
			setActive
		}
		handle = createdHandle

		// Bridge splitview events to callbacks, disposing on teardown.
		const subscriptions = [
			createdApi.onDidLayoutChange(() => {
				emitLayout()
				onDidLayoutChange?.()
			}),
			createdApi.onDidLayoutFromJSON(() => {
				refreshViews()
				onDidLayoutFromJSON?.()
			}),
			createdApi.onDidAddView((view: IView) => {
				refreshViews()
				onDidAddView?.(view)
			}),
			createdApi.onDidRemoveView((view: IView) => {
				refreshViews()
				onDidRemoveView?.(view)
			})
		]
		// Seed the initial views before exposing the handle.
		refreshViews()
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

<div class="dv-svelte-splitview-root {className}" bind:this={container}>
	{#if children}
		{@render children()}
	{/if}
</div>

<style>
	.dv-svelte-splitview-root {
		width: 100%;
		height: 100%;
		position: relative;
	}
</style>
