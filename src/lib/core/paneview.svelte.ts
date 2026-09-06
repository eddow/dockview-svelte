import type {
	CreateComponentOptions,
	DockviewIDisposable,
	IPanePart,
	PanelUpdateEvent,
	PanePanelComponentInitParameter,
	PaneviewPanelApi,
	Parameters,
} from 'dockview'
import { mount, unmount } from 'svelte'
import { DOCKVIEW_CONTEXT_KEY, type PaneviewContext } from './context.js'
import type { PaneviewWidgetRegistry } from './registry.js'
import type { PaneviewHeaderComponent, PaneviewState, PaneviewWidgetComponent } from './types.js'
import { deepEqual, mergeInto } from './utils.js'

/**
 * One entry per pane id. Body and header are separate `IPanePart`s, each with
 * its own `dispose()`; the entry tracks both so the last one out can release
 * `state` — the same idiom as the Dockview content/tab pair.
 */
interface PaneviewPanelEntry {
	state: PaneviewState
	bodyDisposed: boolean
	headerDisposed: boolean
}

/** The renderer factories returned by {@link createPaneviewFactory}. */
export interface PaneviewFactory {
	createComponent: (options: CreateComponentOptions) => IPanePart
	createHeaderComponent: (options: CreateComponentOptions) => IPanePart | undefined
	/** Access a pane's shared state by id (used by `openPanel` to build the handle). */
	getState: (id: string) => PaneviewState | undefined
}

/** Create a `$state`-wrapped paneview state. `$state` must be a declaration initializer. */
function createPaneviewState(
	api: PaneviewPanelApi,
	params: Parameters,
	title: string
): PaneviewState {
	const state = $state({
		params: params ?? {},
		size: { width: 0, height: 0 },
		visible: api.isVisible,
		active: api.isActive,
		focused: api.isFocused,
		expanded: api.isExpanded,
		api,
		title,
		custom: {},
	})
	return state
}

/** Shared mount helper: one `IPanePart` (body or header) bound to the shared state. */
function createPanePart(
	widget: PaneviewWidgetComponent | PaneviewHeaderComponent,
	context: PaneviewContext | undefined,
	getOrCreateState: (
		api: PaneviewPanelApi,
		params: Parameters,
		title: string
	) => PaneviewPanelEntry,
	releaseEntry: (id: string, side: 'body' | 'header') => void,
	side: 'body' | 'header'
): IPanePart {
	const element = document.createElement('div')
	element.className = side === 'body' ? 'dv-svelte-pane-body' : 'dv-svelte-pane-header'

	let instance: Record<string, unknown> | undefined
	let entry: PaneviewPanelEntry | undefined
	let state: PaneviewState | undefined
	let raf = 0
	let disposables: DockviewIDisposable[] = []
	let effectDestroy: (() => void) | undefined
	let lastParams: unknown
	let lastActive = false
	let lastVisible = true
	let lastExpanded = false

	return {
		element,

		init(parameters: PanePanelComponentInitParameter): void {
			entry = getOrCreateState(parameters.api, parameters.params, parameters.title)
			state = entry.state

			instance = mount(widget, {
				target: element,
				props: { state },
				...(context ? { context: new Map([[DOCKVIEW_CONTEXT_KEY, context]]) } : {}),
			}) as Record<string, unknown>

			lastParams = $state.snapshot(state.params)
			lastActive = state.active
			lastVisible = state.visible
			lastExpanded = state.expanded

			// The body owns the api mirrors + widget→dockview effects; the header
			// only mounts against the same state (it must not double-subscribe).
			if (side === 'body') {
				disposables.push(
					parameters.api.onDidActiveChange((event) => {
						state!.active = event.isActive
						lastActive = event.isActive
					}),
					parameters.api.onDidFocusChange((event) => {
						state!.focused = event.isFocused
					}),
					parameters.api.onDidVisibilityChange((event) => {
						state!.visible = event.isVisible
						lastVisible = event.isVisible
					}),
					parameters.api.onDidDimensionsChange((event) => {
						cancelAnimationFrame(raf)
						raf = requestAnimationFrame(() => {
							state!.size.width = event.width
							state!.size.height = event.height
						})
					}),
					parameters.api.onDidExpansionChange((event) => {
						state!.expanded = event.isExpanded
						lastExpanded = event.isExpanded
					})
				)

				// Widget → dockview (params double-bind, activation, expand toggle).
				effectDestroy = $effect.root(() => {
					$effect(() => {
						const snap = $state.snapshot(state!.params)
						if (deepEqual(snap, lastParams)) return
						lastParams = snap
						state!.api.updateParameters(snap)
					})

					$effect(() => {
						// Only activation is meaningful from the widget side.
						if (state!.active && !lastActive) {
							state!.api.setActive()
						}
					})

					$effect(() => {
						if (state!.visible !== lastVisible) {
							lastVisible = state!.visible
							state!.api.setVisible(state!.visible)
						}
					})

					$effect(() => {
						if (state!.expanded !== lastExpanded) {
							lastExpanded = state!.expanded
							state!.api.setExpanded(state!.expanded)
						}
					})
				})
			}
		},

		update(event: PanelUpdateEvent): void {
			// dockview → widget (body owns the merge; header shares the state).
			if (side !== 'body' || !state) return
			mergeInto(state.params, event.params)
			lastParams = $state.snapshot(state.params)
		},

		dispose(): void {
			cancelAnimationFrame(raf)
			effectDestroy?.()
			effectDestroy = undefined
			for (const disposable of disposables) disposable.dispose()
			disposables = []
			if (instance) {
				unmount(instance)
				instance = undefined
			}
			if (entry) {
				// Entries are keyed by `api.id` — read it back from the shared state.
				releaseEntry(entry.state.api.id, side)
			}
		},
	}
}

/**
 * Creates the paneview body/header renderer factories backed by a shared widget registry.
 *
 * dockview calls `createComponent({ id, name })` for the pane body and
 * `createHeaderComponent({ id, name })` for the pane header, where `name` is
 * the `component` / `headerComponent` string passed to `addPanel`. The body
 * owns the {@link PaneviewState} (created here as `$state`); the header only
 * mounts its component against the same state object. `getOrCreate` covers the
 * construction order either way.
 *
 * When a widget defines no `header`, `createHeaderComponent` returns
 * `undefined` so dockview falls back to its built-in `DefaultHeader` (plain
 * title text) — the same fallback as the Dockview `tab`.
 *
 * Both mounts forward the parent `PaneviewContext` via Svelte's `mount`
 * `context` option, so widgets can `getContext(DOCKVIEW_CONTEXT_KEY)`.
 */
export function createPaneviewFactory(
	registry: PaneviewWidgetRegistry,
	context?: PaneviewContext
): PaneviewFactory {
	const panes = new Map<string, PaneviewPanelEntry>()

	function getOrCreateState(
		api: PaneviewPanelApi,
		params: Parameters,
		title: string
	): PaneviewPanelEntry {
		let entry = panes.get(api.id)
		if (!entry) {
			entry = {
				state: createPaneviewState(api, params, title),
				bodyDisposed: false,
				headerDisposed: false,
			}
			panes.set(api.id, entry)
		}
		return entry
	}

	function releaseEntry(id: string, side: 'body' | 'header'): void {
		const entry = panes.get(id)
		if (!entry) return
		if (side === 'body') entry.bodyDisposed = true
		else entry.headerDisposed = true
		if (entry.bodyDisposed && entry.headerDisposed) panes.delete(id)
	}

	function createComponent(options: CreateComponentOptions): IPanePart {
		const def = registry.get(options.name)
		if (!def) {
			throw new Error(`dockview-svelte: unknown widget "${options.name}"`)
		}
		return createPanePart(def.component, context, getOrCreateState, releaseEntry, 'body')
	}

	function createHeaderComponent(options: CreateComponentOptions): IPanePart | undefined {
		const def = registry.get(options.name)
		if (!def) {
			throw new Error(`dockview-svelte: unknown widget "${options.name}"`)
		}
		if (!def.header) return undefined
		return createPanePart(def.header, context, getOrCreateState, releaseEntry, 'header')
	}

	return {
		createComponent,
		createHeaderComponent,
		getState: (id: string) => panes.get(id)?.state,
	}
}
