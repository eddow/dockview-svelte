import type {
	AddPanelOptions,
	DockviewApi,
	DockviewGroupLocation,
	DockviewGroupPanel,
	DockviewPanelApi,
	DockviewPopoutGroupOptions,
	FloatingGroupOptions,
	IDockviewPanel,
} from 'dockview'
import type { Component, ComponentProps } from 'svelte'

/**
 * The reactive state shared between a panel's tab header and its content.
 *
 * One instance exists per panel id. It is created as a `$state` object and
 * passed to both the tab and content widgets by reference, so both sides
 * observe and mutate the same reactive fields.
 *
 * Two visibility notions are exposed, deliberately named after their source:
 * - `shown`: the renderer's `onShow`/`onHide` — whether this panel's content
 *   DOM is currently mounted (it's the active tab of its group).
 * - `visible`: dockview's `api.isVisible` — the gridview-level visibility
 *   (false when the whole group is hidden/collapsed).
 */
export interface PanelState<P = Record<string, unknown>> {
	/** Double-bound with dockview: mutations propagate to `api.updateParameters` and back. */
	params: P
	/** Written by the renderer's `layout()` hook, rAF-throttled (only while `shown`). */
	size: { width: number; height: number }
	/** Renderer `onShow`/`onHide` — content mounted as the active tab. */
	shown: boolean
	/** dockview `api.isVisible` — gridview-level visibility. */
	visible: boolean
	/** dockview `api.isActive` — write `true` to activate (writing `false` is ignored). */
	active: boolean
	/** dockview `api.isFocused` — read-only mirror. */
	focused: boolean
	/** dockview `api.isPinned` — two-way (`setPinned`). */
	pinned: boolean
	/** dockview `api.isGroupActive` — read-only mirror. */
	groupActive: boolean
	/** The per-panel dockview api. */
	api: DockviewPanelApi
	/** Read-only mirror of dockview's title (rename via `api.setTitle`). */
	title: string
	/** App channel for arbitrary tab↔content data, e.g. `custom.unread = 3`. */
	custom: Record<string, unknown>
}

/**
 * The currently active panel + group, bound via `bind:active` on `<Dockview>`.
 * Reacts to `onDidActivePanelChange` / `onDidActiveGroupChange`.
 */
export interface ActiveState {
	panel: IDockviewPanel | undefined
	group: DockviewGroupPanel | undefined
}

/**
 * Reactive floating-window state, bound via `bind:floating` on `<Dockview>`.
 * Mirrors `api.groups` where `location.type === 'floating'` — refreshed on
 * layout/add/remove/move, so dragging, floating, or docking back all update it.
 */
export interface FloatingState {
	/** Number of floating windows currently open. */
	count: number
	/** True when at least one floating window is open. */
	hasFloating: boolean
}

/**
 * Reactive popout-window state, bound via `bind:popout` on `<Dockview>`.
 * Mirrors `api.getPopouts()` — refreshed on popout add/remove and layout changes.
 */
export interface PopoutState {
	/** Number of popout windows currently open. */
	count: number
	/** True when at least one popout window is open. */
	hasPopout: boolean
}

/**
 * Reactive group state, passed to a Svelte group-header action component via
 * `HeaderActionProps.state`. Mirrors the group api's collapsed/peek/location
 * (and their `onDid*` events) — the same idiom as {@link PanelState}.
 */
export interface GroupState {
	/** True while the group is collapsed to its header. */
	isCollapsed: boolean
	/** True while the group is peeking (edge/tool window). */
	isPeeking: boolean
	/** The group's current location: `'grid'`, `'floating'`, `'popout'`, or `'edge'`. */
	location: DockviewGroupLocation
}

/** A widget receives its whole {@link PanelState} as a single `state` prop. */
export type WidgetComponent<P = Record<string, unknown>> = Component<{
	state: PanelState<P>
}>

/**
 * Props passed to the Svelte `watermark` overlay component.
 * Rendered as a plain Svelte child when the dock is empty, so it reads the
 * parent `DockviewContext` (`api`, `registerWidget`) via `getContext` —
 * no dockview `IWatermarkRenderer` factory involved.
 */
export interface WatermarkProps<W extends Widgets = Widgets> {
	/** Open a panel by widget key — same as `handle.openPanel`. */
	openPanel: OpenPanelFn<W>
}

/**
 * A Svelte component rendered as the empty-state overlay.
 * `any` props: Svelte component variance can't express "accepts my W" —
 * the overlay always passes this dock's typed `openPanel` at runtime.
 */
export type WatermarkComponent = Component<any>

/**
 * Props passed to a Svelte group-header action component
 * (`leftHeaderActions` / `rightHeaderActions` / `prefixHeaderActions`).
 * Mirrors dockview's `IGroupHeaderProps`, plus a reactive {@link GroupState}.
 */
export interface HeaderActionProps {
	/** The parent {@link DockviewApi} (`addFloatingGroup`, `addPopoutGroup`, …). */
	containerApi: DockviewApi
	/** The concrete group these actions render for (`.api`, `.id`, `.panels`, …). */
	group: DockviewGroupPanel
	/** Reactive mirror of the group's collapsed/peek/location state. */
	state: GroupState
}

/**
 * A Svelte component rendered into a group header slot.
 * `any` props for the same variance reason as {@link WatermarkComponent}.
 */
export type HeaderActionComponent = Component<any>

/**
 * Extracts the params type of a widget component from its `state` prop.
 * Components that do not declare a `state: PanelState<...>` prop fall back to
 * an open record.
 */
export type ParamsOf<C extends Component<any>> = 'state' extends keyof ComponentProps<C>
	? ComponentProps<C>['state'] extends PanelState<infer P>
		? P
		: Record<string, unknown>
	: Record<string, unknown>

/**
 * A single registry entry: one panel *type*, keyed by its widget key
 * (e.g. `'chat'`). The header (`tab`) and default `title` live on the same
 * definition as the content so they can never drift.
 */
export interface WidgetDefinition<C extends WidgetComponent<any> = WidgetComponent> {
	/** Content component rendered inside the panel body. */
	component: C
	/** Header component for this widget. Omit to use the built-in default tab. */
	tab?: WidgetComponent
	/** Default title for this widget (tier 2 in the resolution chain). */
	title?: string
}

/** The widget registry: a map of widget key → definition. */
export type Widgets = Record<string, WidgetDefinition>

/** A handle returned by `openPanel`, bundling the panel and its shared state. */
export interface PanelHandle<P = Record<string, unknown>> {
	id: string
	/** Raw dockview panel for full escape-hatch access. */
	panel: IDockviewPanel
	/** Convenience alias of `panel.api`. */
	api: DockviewPanelApi
	/** Reactive state shared by tab + content. */
	state: PanelState<P>
}

/** Options accepted by `openPanel`. Owns `id`/`title`/`params`, passes the rest through. */
export type OpenPanelOptions<P> = {
	id?: string
	title?: string
	params?: P
} & Omit<AddPanelOptions, 'id' | 'title' | 'component' | 'tabComponent' | 'params'>

export type OpenPanelFn<W extends Widgets> = <K extends keyof W & string>(
	key: K,
	options?: OpenPanelOptions<ParamsOf<W[K]['component']>>
) => PanelHandle<ParamsOf<W[K]['component']>>

/** Bound via `bind:handle`; bundles raw api access with the typed ergonomic surface. */
export interface DockviewHandle<W extends Widgets = Widgets> {
	/** The raw dockview api — full escape hatch for anything `openPanel` can't do. */
	api: DockviewApi
	/** Open a panel by widget key with an optional title/params/position. */
	openPanel: OpenPanelFn<W>
	/** Register (or override) a widget type at runtime. */
	registerWidget: (key: string, def: WidgetDefinition) => void
	/**
	 * Float an existing panel or group into its own window.
	 * Accepts an `IDockviewPanel`, a `DockviewGroupPanel`, or a panel id string.
	 */
	float: (
		target: IDockviewPanel | DockviewGroupPanel | string,
		options?: FloatingGroupOptions
	) => void
	/**
	 * Pop an existing panel or group out into its own browser window.
	 * Accepts an `IDockviewPanel`, a `DockviewGroupPanel`, or a panel id string.
	 * Resolves `true` on success, `false` if the popout window failed to open.
	 */
	popout: (
		target: IDockviewPanel | DockviewGroupPanel | string,
		options?: DockviewPopoutGroupOptions
	) => Promise<boolean>
	/** Dock every floating window back into the main grid. */
	dockAll: () => void
}
