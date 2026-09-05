import type { DockviewApi } from 'dockview'
import type { WidgetRegistry } from './registry.js'

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

export const DOCKVIEW_CONTEXT_KEY = Symbol('dockview-svelte.context')
