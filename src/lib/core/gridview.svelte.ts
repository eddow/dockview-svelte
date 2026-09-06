import type {
	CreateComponentOptions,
	DockviewIDisposable,
	GridviewInitParameters,
	GridviewPanelApi,
	GridviewPanel as GridviewPanelType,
	PanelUpdateEvent,
	Parameters,
} from 'dockview'
import { GridviewPanel as GridviewPanelBase } from 'dockview'
import { mount, unmount } from 'svelte'
import { DOCKVIEW_CONTEXT_KEY, type GridviewContext } from './context.js'
import type { GridviewWidgetRegistry } from './registry.js'
import type { GridviewState, GridviewWidgetComponent } from './types.js'
import { deepEqual, mergeInto } from './utils.js'

/**
 * One entry per panel id. Gridview has a single renderer per cell (no tab),
 * so the entry only tracks one mount.
 */
interface GridviewPanelEntry {
	state: GridviewState
	disposed: boolean
}

/** The renderer factory returned by {@link createGridviewFactory}. */
export interface GridviewFactory {
	createComponent: (options: CreateComponentOptions) => GridviewPanelType
	/** Access a cell's state by id (used by `openPanel` to build the handle). */
	getState: (id: string) => GridviewState | undefined
}

/** Create a `$state`-wrapped gridview state. `$state` must be a declaration initializer. */
function createGridviewState(api: GridviewPanelApi, params: Parameters): GridviewState {
	const state = $state({
		params: params ?? {},
		size: { width: 0, height: 0 },
		visible: api.isVisible,
		active: api.isActive,
		focused: api.isFocused,
		api,
		custom: {},
	})
	return state
}

/** Per-panel dependencies captured by {@link SvelteGridviewPanel} at construction. */
interface GridviewPanelDeps {
	widget: GridviewWidgetComponent
	context: GridviewContext | undefined
	getOrCreateState: (api: GridviewPanelApi, params: Parameters) => GridviewPanelEntry
	/** Remove this panel's entry from the shared registry map (on dispose). */
	releaseState: (id: string) => void
}

/**
 * A gridview cell that mounts a Svelte widget into `this.element` and wires
 * the reactive {@link GridviewState}.
 *
 * Same pattern as {@link SvelteSplitviewPanel}: `GridviewPanel` carries its
 * view through the abstract `getComponent(): IFrameworkPart`. The subclass
 * overrides `init()` to mount (once `this.api`/`this.element` exist and params
 * arrive) and `update()` for the dockview → widget params merge.
 *
 * `getComponent().update` is deliberately a no-op: params flow through the
 * `update(event)` override instead — a single, well-typed path.
 */
class SvelteGridviewPanel extends GridviewPanelBase {
	private readonly deps: GridviewPanelDeps
	private instance: Record<string, unknown> | undefined
	private entry: GridviewPanelEntry | undefined
	private state: GridviewState | undefined
	private disposables: DockviewIDisposable[] = []
	private effectDestroy: (() => void) | undefined
	private lastParams: unknown
	private lastActive = false
	private lastVisible = true
	private raf = 0

	constructor(id: string, name: string, deps: GridviewPanelDeps) {
		super(id, name)
		this.deps = deps
	}

	override init(parameters: GridviewInitParameters): void {
		super.init(parameters)

		const { widget, context, getOrCreateState } = this.deps
		this.entry = getOrCreateState(this.api, parameters.params)
		this.state = this.entry.state

		this.instance = mount(widget, {
			target: this.element,
			props: { state: this.state },
			...(context ? { context: new Map([[DOCKVIEW_CONTEXT_KEY, context]]) } : {}),
		}) as Record<string, unknown>

		this.lastParams = $state.snapshot(this.state.params)
		this.lastActive = this.state.active
		this.lastVisible = this.state.visible

		// Read-only mirrors of the api flags. `size` is rAF-throttled —
		// `onDidDimensionsChange` fires per-pixel on sash drags, exactly like the
		// Dockview `layout()` hook.
		this.disposables.push(
			this.api.onDidActiveChange((event) => {
				this.state!.active = event.isActive
				this.lastActive = event.isActive
			}),
			this.api.onDidFocusChange((event) => {
				this.state!.focused = event.isFocused
			}),
			this.api.onDidVisibilityChange((event) => {
				this.state!.visible = event.isVisible
				this.lastVisible = event.isVisible
			}),
			this.api.onDidDimensionsChange((event) => {
				cancelAnimationFrame(this.raf)
				this.raf = requestAnimationFrame(() => {
					this.state!.size.width = event.width
					this.state!.size.height = event.height
				})
			})
		)

		// Widget → dockview (params double-bind, activation).
		this.effectDestroy = $effect.root(() => {
			$effect(() => {
				const snap = $state.snapshot(this.state!.params)
				if (deepEqual(snap, this.lastParams)) return
				this.lastParams = snap
				this.state!.api.updateParameters(snap)
			})

			$effect(() => {
				// Only activation is meaningful from the widget side.
				if (this.state!.active && !this.lastActive) {
					this.state!.api.setActive()
				}
			})

			$effect(() => {
				if (this.state!.visible !== this.lastVisible) {
					this.lastVisible = this.state!.visible
					this.state!.api.setVisible(this.state!.visible)
				}
			})
		})
	}

	override update(event: PanelUpdateEvent): void {
		super.update(event)
		if (!this.state) return
		mergeInto(this.state.params as Record<string, unknown>, event.params as Record<string, unknown>)
		this.lastParams = $state.snapshot(this.state.params)
	}

	override getComponent() {
		return {
			update: (): void => {
				// Params flow through `update(event)` above, not here (see class doc).
			},
			dispose: (): void => {
				cancelAnimationFrame(this.raf)
				this.effectDestroy?.()
				this.effectDestroy = undefined
				for (const disposable of this.disposables) disposable.dispose()
				this.disposables = []
				if (this.instance) {
					unmount(this.instance)
					this.instance = undefined
				}
				if (this.entry && !this.entry.disposed) {
					this.entry.disposed = true
					this.deps.releaseState(this.id)
				}
			},
		}
	}
}

/**
 * Creates the gridview renderer factory backed by a shared widget registry.
 *
 * A gridview cell is a single `GridviewPanel` subclass instance: `getComponent()`
 * returns the `IFrameworkPart` (`{ update, dispose }`) that mounts the Svelte
 * widget into the panel element. `init()` runs before the cell is added to the
 * grid, so the mount happens there; `size` is written via the api's
 * `onDidDimensionsChange` mirror.
 *
 * The mount forwards the parent context via Svelte's `mount` `context` option,
 * so widgets can `getContext(DOCKVIEW_CONTEXT_KEY)`.
 */
export function createGridviewFactory(
	registry: GridviewWidgetRegistry,
	context?: GridviewContext
): GridviewFactory {
	const panels = new Map<string, GridviewPanelEntry>()

	function getOrCreateState(api: GridviewPanelApi, params: Parameters): GridviewPanelEntry {
		let entry = panels.get(api.id)
		if (!entry) {
			entry = { state: createGridviewState(api, params), disposed: false }
			panels.set(api.id, entry)
		}
		return entry
	}

	function createComponent(options: CreateComponentOptions): GridviewPanelType {
		const def = registry.get(options.name)
		if (!def) {
			throw new Error(`dockview-svelte: unknown widget "${options.name}"`)
		}
		return new SvelteGridviewPanel(options.id, options.name, {
			widget: def.component,
			context,
			getOrCreateState,
			releaseState: (id: string) => panels.delete(id),
		})
	}

	return {
		createComponent,
		getState: (id: string) => panels.get(id)?.state,
	}
}
