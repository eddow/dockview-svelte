// Components

export { default as DefaultTab } from './components/DefaultTab.svelte'
export { default as Dockview } from './components/Dockview.svelte'
// Context
export { DOCKVIEW_CONTEXT_KEY, type DockviewContext } from './core/context.js'
// Registry
export { defineWidgets, WidgetRegistry } from './core/registry.js'

// Types
export type {
	ActiveState,
	DockviewHandle,
	OpenPanelFn,
	OpenPanelOptions,
	PanelHandle,
	PanelState,
	ParamsOf,
	WatermarkComponent,
	WatermarkProps,
	WidgetComponent,
	WidgetDefinition,
	Widgets,
} from './core/types.js'
