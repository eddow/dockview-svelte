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
	import { Dockview, defineWidgets, type DockviewHandle } from 'dockview-svelte';
	import 'dockview/dist/styles/dockview.css';
	import { themeAbyss, type SerializedDockview } from 'dockview';
	import ChatPanel from './ChatPanel.svelte';
	import ChatTab from './ChatTab.svelte';

	const widgets = defineWidgets({
		chat: { component: ChatPanel, tab: ChatTab, title: 'Chat' },
		help: { component: HelpPanel }, // default tab, widget-key title fallback
	});

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
const widgets = defineWidgets({
	chat: { component: ChatPanel, tab: ChatTab, title: 'Chat' },
	help: { component: HelpPanel },
});
```

| Field       | Required | Notes                                                        |
| ----------- | -------- | ------------------------------------------------------------ |
| `component` | yes      | Rendered in the panel body. Receives `{ state: PanelState }` |
| `tab`       | no       | Header override. Falls back to built-in `DefaultTab`         |
| `title`     | no       | Default title. Falls back to the widget key                  |

Use `defineWidgets` (not a bare object) so per-widget param types are preserved for `openPanel`.

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

This is the hook a future `<DvWidgets>` slot-forwarder will build on (deferred — see `plans/main.md`).

## SSR

The component renders an empty `<div>` on the server and instantiates `DockviewComponent` in `onMount`. No action needed.

## API reference

| Export | Kind | Notes |
| ------ | ---- | ----- |
| `Dockview` | Component | `widgets`, `options`, `bind:layout`, `bind:handle`, `bind:active` |
| `DefaultTab` | Component | Built-in header (title + close) |
| `defineWidgets` / `WidgetRegistry` | Function / class | Typed registry construction / mutable registry |
| `DOCKVIEW_CONTEXT_KEY` / `DockviewContext` | const / type | `api` + `registerWidget` for descendants |
| `PanelState`, `PanelHandle`, `DockviewHandle`, `ActiveState` | Types | Shared state, open result, bound handle, active panel/group |
| `WidgetDefinition`, `Widgets`, `WidgetComponent`, `ParamsOf`, `OpenPanelOptions`, `OpenPanelFn` | Types | Registry and open typings |

## Developing

```sh
npm run dev          # demo gallery (landing + /demos/*)
npm run check        # svelte-check
npm run biome        # lint + format check
npm run test:unit    # vitest (registry, utils, factory)
npm run test:e2e     # playwright (7 tests over the demo gallery)
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

## License

MIT
