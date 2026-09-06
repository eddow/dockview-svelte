import type {
	AddGridviewComponentOptions,
	AddPanelOptions,
	AddPaneviewComponentOptions,
	AddSplitviewComponentOptions,
	Direction,
	DockviewApi,
	DockviewGroupLocation,
	DockviewGroupPanel,
	DockviewPanelApi,
	DockviewPopoutGroupOptions,
	FloatingGroupOptions,
	GridviewApi,
	GridviewPanelApi,
	IDockviewPanel,
	IGridviewPanel,
	IPaneviewPanel,
	ISplitviewPanel,
	PaneviewApi,
	PaneviewPanelApi,
	SplitviewApi,
	SplitviewPanelApi,
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

// ===== Splitview =====

/**
 * The reactive state shared by a splitview panel. Same shape as
 * {@link PanelState} minus the tab-only fields (`title`, `shown`, `pinned`,
 * `groupActive`) — splitview panes have no headers or tabs.
 */
export interface SplitviewState<P = Record<string, unknown>> {
	/** Double-bound with dockview: mutations propagate to `api.updateParameters` and back. */
	params: P
	/** Written by the renderer's `layout()` hook via `api.onDidDimensionsChange`. */
	size: { width: number; height: number }
	/** dockview `api.isVisible` — two-way (`setVisible`). */
	visible: boolean
	/** dockview `api.isActive` — write `true` to activate (writing `false` is ignored). */
	active: boolean
	/** dockview `api.isFocused` — read-only mirror. */
	focused: boolean
	/** The per-panel dockview api. */
	api: SplitviewPanelApi
	/** App channel for arbitrary widget data, e.g. `custom.unread = 3`. */
	custom: Record<string, unknown>
}

/** A splitview widget receives its whole {@link SplitviewState} as a `state` prop. */
export type SplitviewWidgetComponent<P = Record<string, unknown>> = Component<{
	state: SplitviewState<P>
}>

/** Extracts the params type of a splitview widget from its `state` prop. */
export type SplitviewParamsOf<C extends Component<any>> = 'state' extends keyof ComponentProps<C>
	? ComponentProps<C>['state'] extends SplitviewState<infer P>
		? P
		: Record<string, unknown>
	: Record<string, unknown>

/**
 * A single splitview registry entry. No `tab`/`title` — splitview panes have
 * no headers.
 */
export interface SplitviewWidgetDefinition<
	C extends SplitviewWidgetComponent<any> = SplitviewWidgetComponent,
> {
	/** Content component rendered inside the split pane. */
	component: C
}

/** The splitview widget registry: a map of widget key → definition. */
export type SplitviewWidgets = Record<string, SplitviewWidgetDefinition>

/** A handle returned by a splitview `openPanel`, bundling the pane and its state. */
export interface SplitviewPanelHandle<P = Record<string, unknown>> {
	id: string
	/** Raw dockview splitview panel. */
	panel: ISplitviewPanel
	/** Convenience alias of `panel.api`. */
	api: SplitviewPanelApi
	/** Reactive state. */
	state: SplitviewState<P>
}

/** Options accepted by a splitview `openPanel`. Owns `id`/`params`, passes the rest through. */
export type SplitviewOpenPanelOptions<P> = {
	id?: string
	params?: P
} & Omit<AddSplitviewComponentOptions, 'id' | 'component' | 'params'>

export type SplitviewOpenPanelFn<W extends SplitviewWidgets> = <K extends keyof W & string>(
	key: K,
	options?: SplitviewOpenPanelOptions<SplitviewParamsOf<W[K]['component']>>
) => SplitviewPanelHandle<SplitviewParamsOf<W[K]['component']>>

/** Bound via `bind:handle`; bundles raw api access with the typed ergonomic surface. */
export interface SplitviewHandle<W extends SplitviewWidgets = SplitviewWidgets> {
	/** The raw splitview api. */
	api: SplitviewApi
	/** Open a split pane by widget key with an optional params/position. */
	openPanel: SplitviewOpenPanelFn<W>
	/** Register (or override) a widget type at runtime. */
	registerWidget: (key: string, def: SplitviewWidgetDefinition) => void
	/** Remove a split pane by id. */
	removePanel: (id: string) => void
	/** Move a split pane from one index to another. */
	movePanel: (from: number, to: number) => void
	/** Show or hide a split pane by id. */
	setVisible: (id: string, visible: boolean) => void
	/** Activate a split pane by id. */
	setActive: (id: string) => void
}

// ===== Gridview =====

/**
 * The reactive state shared by a gridview panel. Same shape as
 * {@link SplitviewState} — grid cells have no headers or tabs.
 */
export interface GridviewState<P = Record<string, unknown>> {
	/** Double-bound with dockview: mutations propagate to `api.updateParameters` and back. */
	params: P
	/** Written by the renderer's `layout()` hook, rAF-throttled. */
	size: { width: number; height: number }
	/** dockview `api.isVisible` — two-way (`setVisible`). */
	visible: boolean
	/** dockview `api.isActive` — write `true` to activate (writing `false` is ignored). */
	active: boolean
	/** dockview `api.isFocused` — read-only mirror. */
	focused: boolean
	/** The per-panel dockview api. */
	api: GridviewPanelApi
	/** App channel for arbitrary widget data, e.g. `custom.unread = 3`. */
	custom: Record<string, unknown>
}

/** A gridview widget receives its whole {@link GridviewState} as a `state` prop. */
export type GridviewWidgetComponent<P = Record<string, unknown>> = Component<{
	state: GridviewState<P>
}>

/** Extracts the params type of a gridview widget from its `state` prop. */
export type GridviewParamsOf<C extends Component<any>> = 'state' extends keyof ComponentProps<C>
	? ComponentProps<C>['state'] extends GridviewState<infer P>
		? P
		: Record<string, unknown>
	: Record<string, unknown>

/**
 * A single gridview registry entry. No `tab`/`title` — grid cells have
 * no headers.
 */
export interface GridviewWidgetDefinition<
	C extends GridviewWidgetComponent<any> = GridviewWidgetComponent,
> {
	/** Content component rendered inside the grid cell. */
	component: C
}

/** The gridview widget registry: a map of widget key → definition. */
export type GridviewWidgets = Record<string, GridviewWidgetDefinition>

/** A handle returned by a gridview `openPanel`, bundling the cell and its state. */
export interface GridviewPanelHandle<P = Record<string, unknown>> {
	id: string
	/** Raw dockview gridview panel. */
	panel: IGridviewPanel
	/** Convenience alias of `panel.api`. */
	api: GridviewPanelApi
	/** Reactive state. */
	state: GridviewState<P>
}

/** Options accepted by a gridview `openPanel`. Owns `id`/`params`, passes the rest through. */
export type GridviewOpenPanelOptions<P> = {
	id?: string
	params?: P
} & Omit<AddGridviewComponentOptions, 'id' | 'component' | 'params'>

export type GridviewOpenPanelFn<W extends GridviewWidgets> = <K extends keyof W & string>(
	key: K,
	options?: GridviewOpenPanelOptions<GridviewParamsOf<W[K]['component']>>
) => GridviewPanelHandle<GridviewParamsOf<W[K]['component']>>

/** Options for `handle.movePanel`: a direction relative to a reference panel id. */
export interface GridviewMoveOptions {
	/** `'left' | 'right' | 'above' | 'below' | 'within'` — relative to `reference`. */
	direction: Direction
	/** Id of the panel to position relative to. */
	reference: string
	/** Optional size of the moved panel. */
	size?: number
}

/** Bound via `bind:handle`; bundles raw api access with the typed ergonomic surface. */
export interface GridviewHandle<W extends GridviewWidgets = GridviewWidgets> {
	/** The raw gridview api. */
	api: GridviewApi
	/** Open a grid cell by widget key with an optional params/position. */
	openPanel: GridviewOpenPanelFn<W>
	/** Register (or override) a widget type at runtime. */
	registerWidget: (key: string, def: GridviewWidgetDefinition) => void
	/** Remove a grid cell by id. */
	removePanel: (id: string) => void
	/** Move a grid cell relative to a reference panel. */
	movePanel: (id: string, options: GridviewMoveOptions) => void
	/** Show or hide a grid cell by id. */
	setVisible: (id: string, visible: boolean) => void
	/** Activate a grid cell by id. */
	setActive: (id: string) => void
}

// ===== Paneview =====

/**
 * The reactive state shared by a paneview pane's body and header. Same shape
 * as {@link SplitviewState} plus the pane-specific `title` (owned by dockview
 * at open time, mirrored read-only) and `expanded` (two-way via
 * `api.setExpanded`).
 */
export interface PaneviewState<P = Record<string, unknown>> {
	/** Double-bound with dockview: mutations propagate to `api.updateParameters` and back. */
	params: P
	/** Written by the renderer's `layout()` hook, rAF-throttled. */
	size: { width: number; height: number }
	/** dockview `api.isVisible` — two-way (`setVisible`). */
	visible: boolean
	/** dockview `api.isActive` — write `true` to activate (writing `false` is ignored). */
	active: boolean
	/** dockview `api.isFocused` — read-only mirror. */
	focused: boolean
	/** dockview `api.isExpanded` — two-way (`setExpanded`). */
	expanded: boolean
	/** The per-pane dockview api. */
	api: PaneviewPanelApi
	/** Read-only mirror of dockview's title (fixed at open time). */
	title: string
	/** App channel for arbitrary widget data, e.g. `custom.unread = 3`. */
	custom: Record<string, unknown>
}

/** A paneview body widget receives its whole {@link PaneviewState} as a `state` prop. */
export type PaneviewWidgetComponent<P = Record<string, unknown>> = Component<{
	state: PaneviewState<P>
}>

/** A paneview header widget receives the same {@link PaneviewState} as the body. */
export type PaneviewHeaderComponent = Component<{
	state: PaneviewState<any>
}>

/** Extracts the params type of a paneview widget from its `state` prop. */
export type PaneviewParamsOf<C extends Component<any>> = 'state' extends keyof ComponentProps<C>
	? ComponentProps<C>['state'] extends PaneviewState<infer P>
		? P
		: Record<string, unknown>
	: Record<string, unknown>

/**
 * A single paneview registry entry: one pane *type*, keyed by its widget key.
 * The header lives on the same definition as the body so they can never drift.
 * Omit `header` to use dockview's built-in default header (plain title text).
 */
export interface PaneviewWidgetDefinition<
	C extends PaneviewWidgetComponent<any> = PaneviewWidgetComponent,
> {
	/** Body component rendered inside the pane. */
	component: C
	/** Header component for this pane. Omit to use dockview's default header. */
	header?: PaneviewHeaderComponent
	/** Default title for this pane (tier 2 in the resolution chain). */
	title?: string
}

/** The paneview widget registry: a map of widget key → definition. */
export type PaneviewWidgets = Record<string, PaneviewWidgetDefinition>

/** A handle returned by a paneview `openPanel`, bundling the pane and its state. */
export interface PaneviewPanelHandle<P = Record<string, unknown>> {
	id: string
	/** Raw dockview paneview panel. */
	panel: IPaneviewPanel
	/** Convenience alias of `panel.api`. */
	api: PaneviewPanelApi
	/** Reactive state shared by header + body. */
	state: PaneviewState<P>
}

/** Options accepted by a paneview `openPanel`. Owns `id`/`title`/`params`, passes the rest through. */
export type PaneviewOpenPanelOptions<P> = {
	id?: string
	title?: string
	params?: P
} & Omit<AddPaneviewComponentOptions, 'id' | 'component' | 'headerComponent' | 'title' | 'params'>

export type PaneviewOpenPanelFn<W extends PaneviewWidgets> = <K extends keyof W & string>(
	key: K,
	options?: PaneviewOpenPanelOptions<PaneviewParamsOf<W[K]['component']>>
) => PaneviewPanelHandle<PaneviewParamsOf<W[K]['component']>>

/** Bound via `bind:handle`; bundles raw api access with the typed ergonomic surface. */
export interface PaneviewHandle<W extends PaneviewWidgets = PaneviewWidgets> {
	/** The raw paneview api. */
	api: PaneviewApi
	/** Open a pane by widget key with an optional title/params/position. */
	openPanel: PaneviewOpenPanelFn<W>
	/** Register (or override) a widget type at runtime. */
	registerWidget: (key: string, def: PaneviewWidgetDefinition) => void
	/** Remove a pane by id. */
	removePanel: (id: string) => void
	/** Move a pane from one index to another. */
	movePanel: (from: number, to: number) => void
	/** Show or hide a pane by id. */
	setVisible: (id: string, visible: boolean) => void
	/** Expand or collapse a pane by id. */
	setExpanded: (id: string, expanded: boolean) => void
}
