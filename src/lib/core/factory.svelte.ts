import type {
	CreateComponentOptions,
	DockviewIDisposable,
	DockviewPanelApi,
	GroupPanelPartInitParameters,
	IContentRenderer,
	ITabRenderer,
	PanelUpdateEvent,
	Parameters,
	TabPartInitParameters,
} from 'dockview'
import { mount, unmount } from 'svelte'
import DefaultTab from '../components/DefaultTab.svelte'
import type { WidgetRegistry } from './registry.js'
import type { PanelState } from './types.js'
import { deepEqual, mergeInto } from './utils.js'

/**
 * One entry per panel id. Content and tab are separate renderers, each with its
 * own `dispose()`; the entry tracks both so the last one out can release `state`.
 */
interface PanelEntry {
	state: PanelState
	contentDisposed: boolean
	tabDisposed: boolean
}

/** The renderer factories returned by {@link createDockviewFactory}. */
export interface DockviewFactory {
	createComponent: (options: CreateComponentOptions) => IContentRenderer
	createTabComponent: (options: CreateComponentOptions) => ITabRenderer
	/** Access a panel's shared state by id (used by `openPanel` to build the handle). */
	getState: (id: string) => PanelState | undefined
}

/**
 * Creates the content/tab renderer factories backed by a shared widget registry.
 *
 * The content renderer owns the {@link PanelState} (created here as `$state`) and
 * its reactivity wiring: the title mirror and the params double-bind. The tab
 * renderer only mounts its header component against the same state object.
 */
/** Create a `$state`-wrapped panel state. `$state` must be a declaration initializer. */
function createPanelState(api: DockviewPanelApi, params: Parameters, title: string): PanelState {
	const state = $state({
		params: params ?? {},
		size: { width: 0, height: 0 },
		shown: true,
		visible: api.isVisible,
		active: api.isActive,
		focused: api.isFocused,
		pinned: api.isPinned,
		groupActive: api.isGroupActive,
		api,
		title,
		custom: {},
	})
	return state
}

export function createDockviewFactory(registry: WidgetRegistry): DockviewFactory {
	const panels = new Map<string, PanelEntry>()

	function getOrCreateState(api: DockviewPanelApi, params: Parameters, title: string): PanelEntry {
		let entry = panels.get(api.id)
		if (!entry) {
			entry = {
				state: createPanelState(api, params, title),
				contentDisposed: false,
				tabDisposed: false,
			}
			panels.set(api.id, entry)
		}
		return entry
	}

	function createContentRenderer(options: CreateComponentOptions): IContentRenderer {
		const element = document.createElement('div')
		element.className = 'dv-svelte-content'

		let instance: Record<string, unknown> | undefined
		let entry: PanelEntry | undefined
		let state: PanelState | undefined
		let raf = 0
		let disposables: DockviewIDisposable[] = []
		let effectDestroy: (() => void) | undefined
		let lastParams: unknown
		let lastActive = false
		let lastPinned = false

		return {
			element,

			init(params: GroupPanelPartInitParameters): void {
				const def = registry.get(options.name)
				if (!def) {
					throw new Error(`dockview-svelte: unknown widget "${options.name}"`)
				}

				entry = getOrCreateState(params.api, params.params, params.title)
				state = entry.state

				instance = mount(def.component, {
					target: element,
					props: { state },
				}) as Record<string, unknown>

				lastParams = $state.snapshot(state.params)
				lastActive = state.active
				lastPinned = state.pinned

				// Title mirror: dockview owns the title; reflect changes into state.
				disposables.push(
					params.api.onDidTitleChange((event) => {
						state!.title = event.title
					})
				)

				// Read-only mirrors of dockview's per-panel booleans.
				disposables.push(
					params.api.onDidActiveChange((event) => {
						state!.active = event.isActive
						lastActive = event.isActive
					}),
					params.api.onDidFocusChange((event) => {
						state!.focused = event.isFocused
					}),
					params.api.onDidVisibilityChange((event) => {
						state!.visible = event.isVisible
					}),
					params.api.onDidChangePinned((event) => {
						state!.pinned = event.isPinned
						lastPinned = event.isPinned
					}),
					params.api.onDidActiveGroupChange((event) => {
						state!.groupActive = event.isActive
					})
				)

				// Widget → dockview (params double-bind, activation, pin toggle).
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
						if (state!.pinned !== lastPinned) {
							lastPinned = state!.pinned
							state!.api.setPinned(state!.pinned)
						}
					})
				})
			},

			update(event: PanelUpdateEvent): void {
				// dockview → widget
				if (!state) return
				mergeInto(state.params, event.params)
				lastParams = $state.snapshot(state.params)
			},

			layout(width: number, height: number): void {
				cancelAnimationFrame(raf)
				raf = requestAnimationFrame(() => {
					if (!state?.shown) return
					state.size.width = width
					state.size.height = height
				})
			},

			onShow(): void {
				if (state) state.shown = true
			},

			onHide(): void {
				if (state) state.shown = false
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
					entry.contentDisposed = true
					if (entry.tabDisposed) panels.delete(options.id)
				}
			},
		}
	}

	function createTabRenderer(options: CreateComponentOptions): ITabRenderer {
		const element = document.createElement('div')
		element.className = 'dv-svelte-tab'

		let instance: Record<string, unknown> | undefined
		let entry: PanelEntry | undefined
		let state: PanelState | undefined

		return {
			element,

			init(params: TabPartInitParameters): void {
				const def = registry.get(options.name)
				// Content owns the state; the tab just shares it. Use the default
				// header when the widget has no custom `tab`.
				const tabComponent = def?.tab ?? DefaultTab
				entry = getOrCreateState(params.api, params.params, params.title)
				state = entry.state

				instance = mount(tabComponent, {
					target: element,
					props: { state },
				}) as Record<string, unknown>
			},

			dispose(): void {
				if (instance) {
					unmount(instance)
					instance = undefined
				}
				if (entry) {
					entry.tabDisposed = true
					if (entry.contentDisposed) panels.delete(options.id)
				}
			},
		}
	}

	return {
		createComponent: createContentRenderer,
		createTabComponent: createTabRenderer,
		getState: (id: string) => panels.get(id)?.state,
	}
}
