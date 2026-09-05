import type { DockviewApi, GridviewApi, PaneviewApi, SplitviewApi } from 'dockview'
import type { WidgetRegistry } from './registry.js'
import type {
	GridviewWidgetDefinition,
	PaneviewWidgetDefinition,
	SplitviewWidgetDefinition,
} from './types.js'

/**
 * Context provided by `<Dockview>` to descendant widgets.
 *
 * `api` is populated once the component mounts; read it reactively. The registry
 * and `registerWidget` are stable for the lifetime of the component.
 */
export interface DockviewContext {
	/** The parent {@link DockviewApi}, available after mount. */
	api: DockviewApi | undefined
	/** Register (or override) a widget type at runtime. */
	registerWidget: (key: string, def: Parameters<WidgetRegistry['register']>[1]) => void
}

/**
 * Context provided by `<Splitview>` to descendant widgets.
 * Same shape as {@link DockviewContext} but typed for the splitview api.
 */
export interface SplitviewContext {
	/** The parent {@link SplitviewApi}, available after mount. */
	api: SplitviewApi | undefined
	/** Register (or override) a widget type at runtime. */
	registerWidget: (key: string, def: SplitviewWidgetDefinition) => void
}

/**
 * Context provided by `<Gridview>` to descendant widgets.
 * Same shape as {@link DockviewContext} but typed for the gridview api.
 */
export interface GridviewContext {
	/** The parent {@link GridviewApi}, available after mount. */
	api: GridviewApi | undefined
	/** Register (or override) a widget type at runtime. */
	registerWidget: (key: string, def: GridviewWidgetDefinition) => void
}

/**
 * Context provided by `<Paneview>` to descendant widgets.
 * Same shape as {@link DockviewContext} but typed for the paneview api.
 */
export interface PaneviewContext {
	/** The parent {@link PaneviewApi}, available after mount. */
	api: PaneviewApi | undefined
	/** Register (or override) a widget type at runtime. */
	registerWidget: (key: string, def: PaneviewWidgetDefinition) => void
}

export const DOCKVIEW_CONTEXT_KEY = Symbol('dockview-svelte.context')
