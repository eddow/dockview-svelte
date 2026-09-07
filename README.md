# dockview-svelte

Svelte 5 (runes) wrapper around the [Dockview](https://dockview.dev) layout engine — docking panels, tab groups, drag-and-drop, floating groups, popouts, and serialization, with a Svelte-native API.

- **Widgets, not portals**: register Svelte components in a `widgets` map; the library mounts them into Dockview's content and tab slots via `mount`/`unmount`.
- **Shared `PanelState`**: each panel gets one reactive object shared by reference between its tab header and its content — `params`, `size`, `shown`/`visible`, `active`, `pinned`, `title`, `api`, plus a `custom` channel for app data (e.g. unread badges).
- **Typed `openPanel`**: per-widget params inference via `defineWidgets`.
- **CSS from the dependency**: the stylesheet comes straight from `dockview` — `import 'dockview/dist/styles/dockview.css'`. Themes (`themeAbyss`, `themeDark`, …) come from the same package.
- **Client-only**: the `DockviewComponent` is created in `onMount`; SSR renders an empty container.

## Install

```sh
npm install dockview-svelte dockview svelte
```

`dockview` is a runtime dependency (it re-exports `dockview-core` and ships the stylesheet + themes). `svelte@^5` is a peer dependency.

## Quick start

```svelte
<script lang="ts">
	import { Dockview, type DockviewHandle } from 'dockview-svelte';
	import 'dockview/dist/styles/dockview.css';
	import { themeAbyss, type SerializedDockview } from 'dockview';
	import ChatPanel from './ChatPanel.svelte';
	import ChatTab from './ChatTab.svelte';

	const widgets = {
		chat: { component: ChatPanel, tab: ChatTab, title: 'Chat' },
		help: { component: HelpPanel }, // default tab, widget-key title fallback
	};

	let handle = $state<DockviewHandle<typeof widgets> | undefined>(undefined);
	let layout = $state<SerializedDockview | undefined>(undefined);
</script>

<Dockview bind:handle bind:layout {widgets} options={{ theme: themeAbyss }} />

<button onclick={() => handle?.openPanel('chat', { params: { room: 'general' } })}>
	New chat
</button>
```

Import the stylesheet once from `dockview` — the library does not force it.

## Widgets

A **widget** is a Svelte component definition; a **panel** is an instantiated widget (`widget + id + reactive params`).

```ts
const widgets = {
	chat: { component: ChatPanel, tab: ChatTab, title: 'Chat' },
	help: { component: HelpPanel },
};
```

| Field       | Required | Notes                                                        |
| ----------- | -------- | ------------------------------------------------------------ |
| `component` | yes      | Rendered in the panel body. Receives `{ state: PanelState }` |
| `tab`       | no       | Header override. Falls back to built-in `DefaultTab`         |
| `title`     | no       | Default title. Falls back to the widget key                  |

Per-widget param types are inferred automatically from the `widgets` object
(the view components declare `const W` generics), so `openPanel` stays typed
with a plain object literal.

Or declare widgets inline with `<DvWidget>` children — same registry, no `widgets` prop:

```svelte
<Dockview bind:handle>
	<DvWidget name="chat" title="Chat">
		{#snippet children(state)}
			<ChatPanel {state} />
		{/snippet}
		{#snippet tab(state)}
			<ChatTab {state} />
		{/snippet}
	</DvWidget>
	<DvWidget name="help">
		{#snippet children(state)}
			<HelpPanel {state} />
		{/snippet}
	</DvWidget>
</Dockview>
```

Each snippet receives the shared `state` object — the same object a registry
component gets as its `state` prop. `tab` is the Dockview tab override, `header`
the Paneview header override; the rest pass through. Works in all four layouts;
see `/demos/declarative`.

> **Type note:** snippet params default to `never` (Svelte can't infer them
> per-widget), so annotate them to get typed `state.params`:
> `{#snippet children(state: PanelState<{ id: number }>)}`.
>
> **Layout applicability:** `tab` only affects `<Dockview>`, `header` only
> `<Paneview>`, and `title` only `<Dockview>`/`<Paneview>`. Passing an
> inapplicable snippet warns in dev and is ignored.

## PanelState

One `$state` object per panel, created once and shared by reference between the tab and content mounts:

```ts
interface PanelState<P = Record<string, unknown>> {
	params: P; // double-bound with dockview (both directions)
	size: { width: number; height: number }; // rAF-throttled, only while `shown`
	shown: boolean; // renderer onShow/onHide — content mounted as the active tab
	visible: boolean; // dockview api.isVisible — gridview-level visibility
	active: boolean; // api.isActive — write `true` to activate
	focused: boolean; // api.isFocused (read-only)
	pinned: boolean; // api.isPinned — two-way (setPinned)
	groupActive: boolean; // api.isGroupActive (read-only)
	api: DockviewPanelApi; // per-panel api (setTitle, close, updateParameters…)
	title: string; // read-only mirror — rename via api.setTitle()
	custom: Record<string, unknown>; // app channel, e.g. custom.unread = 3
}
```

`shown` (renderer-level, from `onShow`/`onHide`) and `visible` (dockview's
`api.isVisible`) are two distinct notions — see the table above. `active`,
`focused`, `pinned` and `groupActive` mirror dockview's per-panel `api.is*`
(and their `onDid*` events).

Widgets receive the whole object as a single `state` prop:

```svelte
<script lang="ts">
	import type { PanelState } from 'dockview-svelte';
	let { state }: { state: PanelState<{ room: string }> } = $props();
</script>

<h2>{state.title}</h2>
<p>room: {state.params.room}</p>
<p>size: {state.size.width} × {state.size.height}</p>
<button onclick={() => (state.custom.unread = Number(state.custom.unread ?? 0) + 1)}>
	unread++
</button>
```

- `params` is two-way: mutating `state.params` calls `api.updateParameters`; dockview-side updates merge back in.
- `title` is owned by dockview — read `state.title`, write via `state.api.setTitle()`.
- `active` is writable (write `true` to activate; `false` is a no-op). `pinned` is two-way. The rest of the booleans are read-only.
- `custom` is the tab↔content channel: the content sets `state.custom.unread`, the tab badge reads it — same reference, no prop drilling.

## Opening panels

```ts
const panel = handle.openPanel('chat', {
	title: 'General', // default: widgets.chat.title ?? 'chat'
	params: { room: 'general' }, // typed per widget
	// id, position, direction, size… pass through to dockview's addPanel
});
panel.state.custom.unread = 3;
panel.api.setTitle('Renamed');
```

`handle` also exposes the escape hatches:

- `handle.api` — the raw `DockviewApi` (`fromJSON`, `addFloatingGroup`, `undo`, …).
- `handle.registerWidget(key, def)` — register/override a widget at runtime without touching the `widgets` prop.
- `handle.float(target, options?)` — float an existing panel or group (`IDockviewPanel`, `DockviewGroupPanel`, or panel id string).
- `handle.popout(target, options?)` — pop a panel or group into its own browser window; resolves `true`/`false`.
- `handle.dockAll()` — dock every floating window back into the main grid.
- `handle.openPanel` throws for unknown widget keys and before mount.

## Layout persistence

`layout` is Dockview's serialized JSON (`toJSON`/`fromJSON` shape) — use it for both defaults and save/restore:

```svelte
<Dockview bind:handle bind:layout {widgets} />
```

```ts
localStorage.setItem('layout', JSON.stringify(layout)); // save
layout = JSON.parse(saved); // restore — applied via fromJSON
```

A `lastEmitted` + deep-equal guard prevents the `fromJSON → onDidLayoutChange → emit` feedback loop.

## Events

All 33 `DockviewApi` events are forwarded as component props (subscribed on mount, disposed on teardown), plus our own `onReady`:

`onReady`, `onDidLayoutChange`, `onDidLayoutFromJSON`, `onDidAddPanel`, `onDidRemovePanel`, `onDidAddGroup`, `onDidRemoveGroup`, `onDidActivePanelChange`, `onDidActiveGroupChange`, `onDidMovePanel`, `onWillDrop`, `onDidDrop`, `onWillDragPanel`, `onWillDragGroup`, `onWillMutateLayout`, `onDidMutateLayout`, `onWillShowOverlay`, `onUnhandledDragOver`, `onDidAddPopoutGroup`, `onDidRemovePopoutGroup`, `onDidPopoutGroupSizeChange`, `onDidPopoutGroupPositionChange`, `onDidOpenPopoutWindowFail`, `onDidCreateTabGroup`, `onDidDestroyTabGroup`, `onDidAddPanelToTabGroup`, `onDidRemovePanelFromTabGroup`, `onDidTabGroupChange`, `onDidTabGroupCollapsedChange`, `onDidPanelPinnedChange`, `onDidMaximizedGroupChange`, `onDidChangeHistory`, `onDidSnapFloat`, `onDidSnapTogether`.

```svelte
<Dockview {widgets} onDidActivePanelChange={(e) => console.log(e.panel?.id)} />
```

## Empty state (watermark)

With no panels open, `Dockview` shows the `watermark` prop — a plain Svelte
component receiving `{ openPanel }`. No dockview `IWatermarkRenderer` factory
involved; it renders as a child overlay, so it gets context automatically:

```svelte
<script lang="ts">
	import type { WatermarkProps } from 'dockview-svelte';

	let { openPanel }: WatermarkProps = $props();
</script>

<button onclick={() => openPanel('chat', { params: { room: 'general' } })}>
	open panel
</button>
```

```svelte
<Dockview {widgets} watermark={EmptyWatermark} options={{ theme }} />
```

See `/demos/empty` for a live example (watermark button opens a panel).

> Tab context menus (`getTabContextMenuItems`) also pass through `options`, but
> need the `ContextMenu` module from `dockview-enterprise` — not covered here.

## Active panel / group

`bind:active` exposes the current active panel + group as a reactive object:

```ts
import type { ActiveState } from 'dockview-svelte';
let active = $state<ActiveState>({ panel: undefined, group: undefined });
```

```svelte
<Dockview bind:active {widgets} />
<!-- active.panel / active.group update reactively -->
```

For a widget reacting to its *own* activation, prefer `state.active` (writable).

## Floating windows

`bind:floating` mirrors the open floating windows reactively (`{ count, hasFloating }`) —
dragging, floating, or docking back all update it:

```ts
import type { FloatingState } from 'dockview-svelte';
let floating = $state<FloatingState>({ count: 0, hasFloating: false });
```

```svelte
<Dockview bind:floating {widgets} />
<!-- floating.count / floating.hasFloating update reactively -->
```

```ts
handle.float(panelId); // float an existing panel or group
handle.float(panel.api.group); // same via the group object
handle.dockAll(); // dock everything back
```

Popouts mirror floating, via `bind:popout` and `handle.popout()`:

```ts
import type { PopoutState } from 'dockview-svelte';
let popout = $state<PopoutState>({ count: 0, hasPopout: false });

handle.popout(panelId); // -> Promise<boolean>, resolves false if the window failed
```

```svelte
<Dockview bind:floating bind:popout {widgets} />
```

See `/demos/floating` for a live example — each group header (via
`rightHeaderActions`) and each panel tab carries ⧉ float / ↗ popout buttons.

## Group header actions

Svelte components rendered into dockview's group-header slots — left of tabs,
right of tabs, or before everything. Each receives `{ containerApi, group, state }`
per group (mirroring dockview's `IGroupHeaderProps`, plus a reactive `state`);
set props win over the raw `options` factories:

```svelte
<script lang="ts">
	import type { HeaderActionProps } from 'dockview-svelte';

	// `group` is the concrete DockviewGroupPanel — no interface re-resolution.
	let { containerApi, group, state }: HeaderActionProps = $props();
</script>

<button onclick={() => containerApi.addFloatingGroup(group)}>float</button>
{#if state.isCollapsed}
	<span>collapsed</span>
{/if}
```

```svelte
<Dockview {widgets} rightHeaderActions={GroupActions} options={{ theme }} />
```

`state` is a reactive `GroupState` mirror (`isCollapsed`, `isPeeking`, `location`),
kept in sync with the group api's `onDid*` events — the same idiom as `PanelState`.

Panel-header (per-tab) buttons need no new API — a custom `tab` component already
receives the shared `state` (with `state.api.id`), and reads the parent api via
`getContext(DOCKVIEW_CONTEXT_KEY)` to call `addFloatingGroup` / `addPopoutGroup`.
See `/demos/floating` (`GroupHeaderActions.svelte` + `PanelHeaderTab.svelte`).

## Themes

Themes are plain objects from the `dockview` package — already installed, no extra setup:

```ts
import { themeAbyss, themeDark, themeLight, themeDracula } from 'dockview';
```

```svelte
<Dockview {widgets} options={{ theme: themeAbyss }} />
```

## Context (for widgets)

Descendant widgets can access the parent api and register widget types at runtime:

```ts
import { getContext } from 'svelte';
import { DOCKVIEW_CONTEXT_KEY, type DockviewContext } from 'dockview-svelte';
const ctx = getContext<DockviewContext>(DOCKVIEW_CONTEXT_KEY);
ctx.registerWidget('extra', { component: ExtraPanel });
```

The factory forwards this context to every widget mount, so `getContext` works
inside panel content and tabs (covered by `core/context.test.ts`).
`<DvWidget>` builds on it: each child registers a snippet-backed wrapper
component under its `name` (with optional `tab`/`header`/`title`), unregistered
on destroy.

## Splitview

A `<Splitview>` component mirrors the `Dockview` idiom for plain resizable split
panes — no tabs or headers. Same `widgets` registry, typed `openPanel`, reactive
`state`, and `bind:layout`/`bind:views`:

```svelte
<script lang="ts">
	import { Splitview, defineSplitviewWidgets, type SplitviewHandle } from 'dockview-svelte';
	import { Orientation } from 'dockview';

	const widgets = defineSplitviewWidgets({
		a: { component: PaneA },
		b: { component: PaneB },
	});

	let handle = $state<SplitviewHandle<typeof widgets> | undefined>(undefined);
</script>

<Splitview bind:handle {widgets} options={{ orientation: Orientation.HORIZONTAL }} />
```

Widgets receive a `SplitviewState` (same shape as `PanelState` minus the
tab-only `title`/`shown`/`pinned`/`groupActive`), and `handle` exposes
`openPanel`, `removePanel(id)`, and `movePanel(from, to)`. See `/demos/splitview`.

## Gridview

A `<Gridview>` component mirrors the `Splitview` idiom for 2-D grid splits —
cells arranged in rows and columns, no tabs or headers. Same `widgets`
registry, typed `openPanel`, reactive `state`, and `bind:layout`/`bind:panels`:

```svelte
<script lang="ts">
	import { Gridview, defineGridviewWidgets, type GridviewHandle } from 'dockview-svelte';
	import { Orientation } from 'dockview';

	const widgets = defineGridviewWidgets({
		a: { component: CellA },
		b: { component: CellB },
	});

	let handle = $state<GridviewHandle<typeof widgets> | undefined>(undefined);
</script>

<Gridview bind:handle {widgets} options={{ orientation: Orientation.HORIZONTAL }} />
```

Widgets receive a `GridviewState` (same shape as `SplitviewState`), and `handle`
exposes `openPanel`, `removePanel(id)`, `movePanel(id, { direction, reference, size? })`,
`setVisible(id, visible)`, and `setActive(id)`. New cells are positioned with
`position: { direction, referencePanel }` (direction `'left' | 'right' | 'above' |
'below' | 'within'`). `bind:panels` mirrors `api.panels`; `bind:activePanel`
mirrors `onDidActivePanelChange`. `orientation` defaults to `HORIZONTAL`.
See `/demos/gridview`.

## Paneview

A `<Paneview>` component mirrors the `Dockview` idiom for collapsible VS Code-style
sidebars — a vertical stack of panes, each with a body plus an optional custom
header sharing one reactive `state`. Same `widgets` registry, typed `openPanel`,
and `bind:layout`/`bind:panels`:

```svelte
<script lang="ts">
	import { Paneview, definePaneviewWidgets, type PaneviewHandle } from 'dockview-svelte';

	const widgets = definePaneviewWidgets({
		a: { component: PaneA, header: PaneHeaderA, title: 'Pane A' },
		b: { component: PaneB }, // default header (plain title text)
	});

	let handle = $state<PaneviewHandle<typeof widgets> | undefined>(undefined);
</script>

<Paneview bind:handle {widgets} />
```

Widgets receive a `PaneviewState` (`SplitviewState` plus `title` and two-way
`expanded`). Titles resolve through the same three-tier chain as `Dockview`
(explicit → per-widget → widget key). Omit `header` to use dockview's built-in
`DefaultHeader`. `handle` exposes `openPanel`, `removePanel(id)`,
`movePanel(from, to)`, `setVisible(id, visible)`, and `setExpanded(id, expanded)`.
See `/demos/paneview`.

## SSR

The component renders an empty `<div>` on the server and instantiates `DockviewComponent` in `onMount`. No action needed.

## API reference

| Export | Kind | Notes |
| ------ | ---- | ----- |
| `Dockview` | Component | `widgets`, `options`, `bind:layout`, `bind:handle`, `bind:active`, `bind:floating`, `bind:popout`, `watermark`, `left/right/prefixHeaderActions`, `children` (`<DvWidget>`) |
| `Splitview` | Component | `widgets`, `options`, `bind:layout`, `bind:handle`, `bind:views`, `children` (`<DvWidget>`) — no tabs/headers |
| `DvWidget` | Component | Declarative widget: `name`, `children(state)`, `tab(state)?`, `header(state)?`, `title?` — registers into the parent layout's registry |
| `DefaultTab` | Component | Built-in header (title + close) |
| `defineWidgets` / `WidgetRegistry` | Function / class | Typed registry construction / mutable registry |
| `defineSplitviewWidgets` / `SplitviewWidgetRegistry` | Function / class | Splitview registry (no tabs/titles) |
| `defineGridviewWidgets` / `GridviewWidgetRegistry` | Function / class | Gridview registry (no tabs/titles) |
| `definePaneviewWidgets` / `PaneviewWidgetRegistry` | Function / class | Paneview registry (body + optional header + title) |
| `Gridview` | Component | `widgets`, `options`, `bind:layout`, `bind:handle`, `bind:panels`, `bind:activePanel`, `children` (`<DvWidget>`) — no tabs/headers |
| `Paneview` | Component | `widgets`, `options`, `bind:layout`, `bind:handle`, `bind:panels`, `children` (`<DvWidget>`) — collapsible panes with optional custom headers |
| `DOCKVIEW_CONTEXT_KEY` / `DockviewContext` / `SplitviewContext` / `GridviewContext` / `PaneviewContext` | const / types | `api` + `registerWidget` + `unregisterWidget` for descendants |
| `WatermarkComponent` / `WatermarkProps` | types | `watermark` prop: `{ openPanel }` |
| `HeaderActionComponent` / `HeaderActionProps` | types | header-action props: `{ containerApi, group, state }` |
| `PanelState`, `PanelHandle`, `DockviewHandle`, `ActiveState`, `FloatingState`, `PopoutState`, `GroupState` | Types | Shared state, open result, bound handle, active panel/group, floating/popout windows, group header state |
| `SplitviewState`, `SplitviewPanelHandle`, `SplitviewHandle`, `SplitviewWidgets`, `SplitviewWidgetDefinition`, `SplitviewWidgetComponent`, `SplitviewParamsOf`, `SplitviewOpenPanelOptions`, `SplitviewOpenPanelFn` | Types | Splitview state, handle, registry and open typings |
| `GridviewState`, `GridviewPanelHandle`, `GridviewHandle`, `GridviewMoveOptions`, `GridviewWidgets`, `GridviewWidgetDefinition`, `GridviewWidgetComponent`, `GridviewParamsOf`, `GridviewOpenPanelOptions`, `GridviewOpenPanelFn` | Types | Gridview state, handle, registry and open typings |
| `PaneviewState`, `PaneviewPanelHandle`, `PaneviewHandle`, `PaneviewWidgets`, `PaneviewWidgetDefinition`, `PaneviewWidgetComponent`, `PaneviewHeaderComponent`, `PaneviewParamsOf`, `PaneviewOpenPanelOptions`, `PaneviewOpenPanelFn` | Types | Paneview state, handle, registry and open typings |
| `WidgetDefinition`, `Widgets`, `WidgetComponent`, `ParamsOf`, `OpenPanelOptions`, `OpenPanelFn` | Types | Registry and open typings |

## Developing

```sh
npm run dev          # demo gallery (landing + /demos/*)
npm run check        # svelte-check
npm run biome        # lint + format check
npm run test:unit    # vitest (registry, utils, factory, context, splitview, gridview, paneview, dvwidget)
npm run test:e2e     # playwright (15 tests over the demo gallery)
npm run prepack      # svelte-package + publint
```

## Demos

Landing page + one route per concept, each with live `Dockview` and its
highlighted source (Shiki, display-only):

| Route | Concept |
| ----- | ------- |
| `/demos/basic` | `openPanel` a widget |
| `/demos/params` | two-way reactive `params` |
| `/demos/custom-tab` | custom tab + shared `PanelState.custom` badge |
| `/demos/layout` | save / restore `bind:layout` |
| `/demos/themes` | theme switching (`abyss`/`dark`/`light`/`dracula`) |
| `/demos/events` | `bind:active` + event log |
| `/demos/floating` | `bind:floating` / `bind:popout` + group header float/popout |
| `/demos/empty` | `watermark` empty-state overlay |
| `/demos/splitview` | resizable split panes (no tabs/headers) |
| `/demos/gridview` | 2-D grid splits (no tabs/headers) |
| `/demos/paneview` | collapsible panes with optional custom headers |
| `/demos/declarative` | `<DvWidget>` children instead of the `widgets` prop |

## License

MIT
