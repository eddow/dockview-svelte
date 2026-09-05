// Components

export { default as DefaultTab } from './components/DefaultTab.svelte'
export { default as Dockview } from './components/Dockview.svelte'
export { default as Gridview } from './components/Gridview.svelte'
export { default as Paneview } from './components/Paneview.svelte'
export { default as Splitview } from './components/Splitview.svelte'
// Context
export {
	DOCKVIEW_CONTEXT_KEY,
	type DockviewContext,
	type GridviewContext,
	type PaneviewContext,
	type SplitviewContext,
} from './core/context.js'
// Registry
export {
	defineGridviewWidgets,
	definePaneviewWidgets,
	defineSplitviewWidgets,
	defineWidgets,
	GridviewWidgetRegistry,
	PaneviewWidgetRegistry,
	SplitviewWidgetRegistry,
	WidgetRegistry,
} from './core/registry.js'

// Types
export type {
	ActiveState,
	DockviewHandle,
	FloatingState,
	GridviewHandle,
	GridviewMoveOptions,
	GridviewOpenPanelFn,
	GridviewOpenPanelOptions,
	GridviewPanelHandle,
	GridviewParamsOf,
	GridviewState,
	GridviewWidgetComponent,
	GridviewWidgetDefinition,
	GridviewWidgets,
	GroupState,
	HeaderActionComponent,
	HeaderActionProps,
	OpenPanelFn,
	OpenPanelOptions,
	PanelHandle,
	PanelState,
	PaneviewHandle,
	PaneviewHeaderComponent,
	PaneviewOpenPanelFn,
	PaneviewOpenPanelOptions,
	PaneviewPanelHandle,
	PaneviewParamsOf,
	PaneviewState,
	PaneviewWidgetComponent,
	PaneviewWidgetDefinition,
	PaneviewWidgets,
	ParamsOf,
	PopoutState,
	SplitviewHandle,
	SplitviewOpenPanelFn,
	SplitviewOpenPanelOptions,
	SplitviewPanelHandle,
	SplitviewParamsOf,
	SplitviewState,
	SplitviewWidgetComponent,
	SplitviewWidgetDefinition,
	SplitviewWidgets,
	WatermarkComponent,
	WatermarkProps,
	WidgetComponent,
	WidgetDefinition,
	Widgets,
} from './core/types.js'
