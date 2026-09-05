import type {
	CreateComponentOptions,
	DockviewIDisposable,
	PanelUpdateEvent,
	PanelViewInitParameters,
	Parameters,
	SplitviewPanel,
	SplitviewPanelApi,
} from 'dockview'
import { SplitviewPanel as SplitviewPanelBase } from 'dockview'
import { mount, unmount } from 'svelte'
import { DOCKVIEW_CONTEXT_KEY, type SplitviewContext } from './context.js'
import type { SplitviewWidgetRegistry } from './registry.js'
import type { SplitviewState, SplitviewWidgetComponent } from './types.js'
import { deepEqual, mergeInto } from './utils.js'

/**
 * One entry per view id. Splitview has a single renderer per view (no tab),
 * so the entry only tracks one mount.
 */
interface SplitviewPanelEntry {
	state: SplitviewState
	disposed: boolean
}

/** The renderer factory returned by {@link createSplitviewFactory}. */
export interface SplitviewFactory {
	createComponent: (options: CreateComponentOptions) => SplitviewPanel
	/** Access a view's state by id (used by `openPanel` to build the handle). */
	getState: (id: string) => SplitviewState | undefined
}

/** Create a `$state`-wrapped splitview state. `$state` must be a declaration initializer. */
function createSplitviewState(api: SplitviewPanelApi, params: Parameters): SplitviewState {
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

/** Per-panel dependencies captured by {@link SvelteSplitviewPanel} at construction. */
interface SplitviewPanelDeps {
	widget: SplitviewWidgetComponent
	context: SplitviewContext | undefined
	getOrCreateState: (api: SplitviewPanelApi, params: Parameters) => SplitviewPanelEntry
	/** Remove this panel's entry from the shared registry map (on dispose). */
	releaseState: (id: string) => void
}

/**
 * A splitview panel that mounts a Svelte widget into `this.element` and wires
 * the reactive {@link SplitviewState}.
 *
 * `SplitviewPanel` is abstract with a single abstract member
 * `getComponent(): IFrameworkPart`. The subclass overrides `init()` to mount
 * (once `this.api`/`this.element` exist and params arrive) and `update()` for
 * the dockview → widget params merge.
 *
 * `getComponent().update` is deliberately a no-op: dockview calls
 * `part.update(...)` with inconsistent shapes (raw `params` from `layout()`,
 * `{ params }` from `update()`), so params flow through the `update(event)`
 * override instead — a single, well-typed path.
 */
class SvelteSplitviewPanel extends SplitviewPanelBase {
	private readonly deps: SplitviewPanelDeps
	private instance: Record<string, unknown> | undefined
	private entry: SplitviewPanelEntry | undefined
	private state: SplitviewState | undefined
	private disposables: DockviewIDisposable[] = []
	private effectDestroy: (() => void) | undefined
	private lastParams: unknown
	private lastActive = false
	private raf = 0

	constructor(id: string, name: string, deps: SplitviewPanelDeps) {
		super(id, name)
		this.deps = deps
	}

	override init(parameters: PanelViewInitParameters): void {
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
 * Creates the splitview renderer factory backed by a shared widget registry.
 *
 * Unlike dockview's content/tab pair, a splitview view is a single
 * `SplitviewPanel` subclass instance: `getComponent()` returns the
 * `IFrameworkPart` (`{ update, dispose }`) that mounts the Svelte widget into
 * the panel element. `init()` runs before the panel is added to the splitview,
 * so the mount happens there; `layout()` writes `state.size` via the api's
 * `onDidDimensionsChange` mirror.
 *
 * The mount forwards the parent context via Svelte's `mount` `context` option,
 * so widgets can `getContext(DOCKVIEW_CONTEXT_KEY)`.
 */
export function createSplitviewFactory(
	registry: SplitviewWidgetRegistry,
	context?: SplitviewContext
): SplitviewFactory {
	const panels = new Map<string, SplitviewPanelEntry>()

	function getOrCreateState(api: SplitviewPanelApi, params: Parameters): SplitviewPanelEntry {
		let entry = panels.get(api.id)
		if (!entry) {
			entry = { state: createSplitviewState(api, params), disposed: false }
			panels.set(api.id, entry)
		}
		return entry
	}

	function createComponent(options: CreateComponentOptions): SplitviewPanel {
		const def = registry.get(options.name)
		if (!def) {
			throw new Error(`dockview-svelte: unknown widget "${options.name}"`)
		}
		return new SvelteSplitviewPanel(options.id, options.name, {
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
