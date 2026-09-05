# dockview-svelte — Panels, headers & titles

## 1. Decision summary

- **One registry**, not two parallel maps. A panel *type* is a single `WidgetDefinition` entry that optionally carries its content component, its header (`tab`) override, and its default title.
- **Headers are associated with panels per-widget** (`widgets[key].tab`). There is no "tab map" — the tab lives on the same definition as the content.
- **Titles resolve through a three-tier chain** (explicit → per-widget → widget key) evaluated **once at open time**, after which dockview owns the runtime title.
- **`bind:handle`** exposes a `DockviewHandle` that bundles the raw `DockviewApi`, a typed `openPanel`, and `registerWidget`.
- **Completely open**: raw `handle.api` is the escape hatch; `openPanel` passes through every `AddPanelOptions` field it doesn't own.

## 2. The registry

```ts
// core/types.ts
import type { Component, ComponentProps } from 'svelte';
import type {
  DockviewApi,
  DockviewPanelApi,
  IDockviewPanel,
  AddPanelOptions,
} from 'dockview';

/**
 * A widget receives its whole {@link PanelState} as a single `state` prop.
 */
export type WidgetComponent<P = Record<string, unknown>> = Component<{
  state: PanelState<P>;
}>;

/**
 * Extracts the params type of a widget component from its `state` prop.
 * Components that don't declare `state: PanelState<...>` fall back to an open
 * record.
 */
export type ParamsOf<C extends Component<any>> =
  'state' extends keyof ComponentProps<C>
    ? ComponentProps<C>['state'] extends PanelState<infer P>
      ? P
      : Record<string, unknown>
    : Record<string, unknown>;

export interface WidgetDefinition<C extends WidgetComponent<any> = WidgetComponent> {
  /** Content component rendered inside the panel body. */
  component: C;
  /** Header component for this widget. Omit to use the built-in default tab. */
  tab?: WidgetComponent;
  /** Default title for this widget (tier 2 in the resolution chain). */
  title?: string;
}

export type Widgets = Record<string, WidgetDefinition>;

/** Preserves literal keys and per-widget param types via a `const` type param. */
export function defineWidgets<const W extends Widgets>(w: W): W {
  return w;
}
```

Usage (a bare `satisfies Widgets` would widen param types to `any`; use
`defineWidgets` to keep full inference):

```ts
import ChatWidget from './ChatWidget.svelte';
import ChatTab from './ChatTab.svelte';

const widgets = defineWidgets({
  chat: { component: ChatWidget, tab: ChatTab, title: 'Chat' },
  help: { component: HelpWidget }, // no tab, no title → built-in tab + widget-key title
});
```

## 3. PanelState & PanelHandle

```ts
export interface PanelState<P = Record<string, unknown>> {
  params: P;                                // double-bound with dockview (see §7)
  size: { width: number; height: number };  // updated by renderer layout() (rAF-throttled, only while `shown`)
  shown: boolean;                           // renderer onShow/onHide — content mounted as the active tab
  visible: boolean;                         // dockview api.isVisible — gridview-level visibility
  active: boolean;                          // dockview api.isActive — write `true` to activate
  focused: boolean;                         // dockview api.isFocused (read-only)
  pinned: boolean;                          // dockview api.isPinned — two-way (setPinned)
  groupActive: boolean;                     // dockview api.isGroupActive (read-only)
  api: DockviewPanelApi;                    // per-panel api
  title: string;                            // read-only mirror of dockview's title
  custom: Record<string, unknown>;          // app channel (unread badge, etc.)
}

export interface PanelHandle<P = Record<string, unknown>> {
  id: string;
  panel: IDockviewPanel;   // raw dockview panel for full escape hatch
  api: DockviewPanelApi;   // convenience alias of panel.api
  state: PanelState<P>;    // reactive state shared by tab + content
}
```

`PanelState` is created **once** in `createComponent` (content factory) via
`getOrCreate`, with every writable field wrapped in `$state`:

```ts
function createPanelState(
  api: DockviewPanelApi,
  params: P,
  title: string,
): PanelState<P> {
  return $state({
    params,
    size: { width: 0, height: 0 },
    shown: true,
    visible: api.isVisible,
    active: api.isActive,
    focused: api.isFocused,
    pinned: api.isPinned,
    groupActive: api.isGroupActive,
    api,
    title,
    custom: {},
  });
}
```

Every field is `$state`-wrapped by the `$state({…})` call. Widgets receive the
**whole** `state` object as a single prop and read/mutate fields directly:
`state.custom.unread = 3` (tab) and `state.params.x = 1` (content) are both
reactive. `params` is additionally double-bound to dockview (§7); `title` is a
read-only mirror updated from `onDidTitleChange` (§4); `size` is written by the
renderer's `layout()` (§7).

The four booleans are mirrors of dockview's own per-panel state:
`shown` comes from the renderer's `onShow()`/`onHide()`, while `visible`,
`active`, `focused`, `pinned` and `groupActive` mirror `api.isVisible`,
`api.isActive`, `api.isFocused`, `api.isPinned` and `api.isGroupActive` (and
their `onDid*` events). `active` is writable (writing `true` calls `setActive`,
`false` is ignored) and `pinned` is two-way; the rest are read-only.

## 4. Title & header resolution

Both resolve against the same `widgets[key]` entry, once at open time.

**Title** (three-tier resolution, explicit → per-widget → widget key):

```
title = options.title ?? widgets[key].title ?? key
```

1. explicit `openPanel(key, { title })`
2. per-widget `widgets[key].title`
3. fallback: the widget key itself (`'chat'`, `'help'`, …)

**Header** (per-widget → global default):

```
tab = widgets[key].tab ?? DefaultTab
```

`DefaultTab.svelte` is the library's built-in header. If `widgets[key].tab`
is omitted, `createTabComponent` resolves `widgets[key].tab ?? DefaultTab` and
mounts it (never `undefined`), so every panel has a header with title + close
button. We do **not** rely on dockview's built-in tab — that way the header and
the content receive the *same* `PanelState` reference, which is the whole point
of §4 of the main plan.

**Runtime title ownership** (after open):

- dockview owns the title: the resolved value is passed as `addPanel({ title })`.
- `state.title` is a **read-only mirror**: the factory subscribes
  `panel.api.onDidTitleChange` (`Event<TitleEvent>`) and writes the new value
  into `state.title`.
- Widgets rename a panel by calling `state.api.setTitle(next)` — never by
  writing `state.title`. This keeps a single source of truth and avoids the
  two-way write loop.

The subscription is disposed when the renderer is disposed.

## 5. openPanel

```ts
export type OpenPanelOptions<P> = {
  id?: string;
  title?: string;
  params?: P;
} & Omit<AddPanelOptions, 'id' | 'title' | 'component' | 'tabComponent' | 'params'>;

export type OpenPanelFn<W extends Widgets> = <K extends keyof W & string>(
  key: K,
  options?: OpenPanelOptions<ParamsOf<W[K]['component']>>,
) => PanelHandle<ParamsOf<W[K]['component']>>;
```

- `component` and `tabComponent` are **not** accepted — they're derived from
  the registry via `key`. This is the whole "headers associate with panels"
  guarantee.
- `tabComponent` is set to `key` (not `${key}::tab`): dockview passes it back
  as the tab renderer's `name`, so `createTabComponent({ name })` resolves
  `widgets[name].tab ?? DefaultTab` directly.
- `id` is optional; default `${key}-${n}` with a per-widget counter, since
  dockview requires an id and never invents one.
- `params` is optional and typed to the widget's params type.
- Everything else (`position`, `referencePanel`, `direction`, `size`, `snap`,
  `inactive`, `renderer`, `initialWidth`, `initialHeight`, `minimumWidth`,
  `maximumWidth`, `minimumHeight`, `maximumHeight`, …) passes through
  untouched, because the `Omit` only removes the four owned fields + `id`.

`openPanel` is implemented once, on the component, where both the registry and
the live `DockviewApi` are in scope:

```ts
function openPanel<K extends keyof W & string>(key: K, options?: OpenPanelOptions<...>) {
  const def = registry.get(key);               // throws if unknown widget key
  const title = options?.title ?? def.title ?? key;
  const id = options?.id ?? nextId(key);
  const panel = api.addPanel({
    ...options,
    id,
    title,
    component: key,
    tabComponent: key,                         // header resolved by createTabComponent
    params: options?.params,
  } as AddPanelOptions);                       // cast: addPanel is a discriminated union
  return { id, panel, api: panel.api, state: factory.getState(id)! };
}
```

## 6. bind:handle

```ts
export interface DockviewHandle<W extends Widgets = Widgets> {
  /** The raw dockview api. Full escape hatch for anything openPanel can't do. */
  api: DockviewApi;
  /** Open a panel by type with an optional title/params/position. */
  openPanel: OpenPanelFn<W>;
  /** Register (or override) a widget type at runtime, without touching `widgets`. */
  registerWidget: (key: string, def: WidgetDefinition) => void;
}
```

Component surface (generic over the widgets registry, so `openPanel` is
per-key typed — the `W` type param is inferred from the `widgets` prop):

```svelte
<script lang="ts">
  import { Dockview } from '$lib';
  import 'dockview/dist/styles/dockview.css';

  let { handle = $bindable() } = $props();
</script>

<Dockview
  bind:handle
  bind:active
  {widgets}
  options={{ ...dockviewOptions }}
/>
```

The parent should annotate the bound handle so per-key param typing is preserved
(e.g. `let handle = $state<DockviewHandle<typeof widgets> | undefined>(undefined)`).
`bind:active` gives a reactive `{ panel, group }` of the current active
panel/group (see §9).

The raw `DockviewApi` is reachable as `handle.api`, so nothing from the
original `bind:api` plan is lost — it's renamed `handle.api`. `openPanel`
returns the `PanelHandle` so callers can immediately write
`state.custom.unread = 1` or `state.api.setTitle('…')`.

`onReady` also fires with `{ api, handle }`, so a parent can start opening
panels without relying on `bind:handle` timing (the child's `onMount` runs
before the parent's).

## 7. Reactivity: size throttling & params double-bind

### size — rAF-throttled (decision: yes)

`IContentRenderer.layout(w, h)` fires from dockview's `ResizeObserver` on
essentially every resize frame. Writing `state.size` directly would invalidate
every `size` consumer on every frame. The renderer coalesces via
`requestAnimationFrame`, so `state.size` updates at most once per frame:

```ts
let raf = 0;

layout(width: number, height: number) {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    if (!state.shown) return;   // covered panels don't get size updates
    state.size.width = width;
    state.size.height = height;
  });
}

onShow() { state.shown = true; }
onHide() { state.shown = false; }

dispose() {
  cancelAnimationFrame(raf);
}
```

`onShow`/`onHide` (panel covered/revealed behind another tab) toggle
`state.shown`. `layout()` writes to `state.size` only while `shown`, so hidden
widgets stop receiving reactive size churn. Note `shown` (renderer-level) is
distinct from `visible` (`api.isVisible`, gridview-level).

### params — complete double-bind (decision: yes, both directions)

The "svelte bonus point": `state.params` is fully two-way with dockview.

Verified flow (from `main.esm.mjs`): `DockviewPanelApi.updateParameters(p)`
fires `onDidParametersChange`, whose subscriber calls
`panel.update({ params: p })` — so **both** directions funnel through the
renderer's `update()`:

```text
dockview → widget : api.updateParameters(p) → panel.update({params:p}) → renderer.update() → merge into state.params
widget  → dockview: state.params mutation → $effect → api.updateParameters(snapshot)
```

```ts
let lastParams = $state.snapshot(state.params);  // what dockview last wrote

function update(event: PanelUpdateEvent) {        // dockview → widget
  mergeInto(state.params, event.params);          // deep merge, preserve nested identity
  lastParams = $state.snapshot(state.params);
}

$effect(() => {
  const snap = $state.snapshot(state.params);      // deep read → subscribes
  if (deepEqual(snap, lastParams)) return;         // dockview wrote it → stop
  lastParams = snap;
  api.updateParameters(snap);                      // widget → dockview
});
```

**Loop-break**: `api.updateParameters` re-enters `update()` synchronously, which
sets `lastParams` to the pushed snapshot. The deferred `$effect` then sees
`snap === lastParams` and returns. When dockview is the origin, `lastParams`
is already fresh before the effect runs, so there's no redundant round-trip.

Implementation notes:

- `mergeInto` is a **deep** merge, not `Object.assign`, so nested param objects
  keep their identity and the widget's deep-reactivity subscriptions survive.
- dockview sends `Partial<T>`, so `update()` can add/overwrite but never delete
  — the correct asymmetry for a two-way bind.
- The `$effect` runs via `$effect.root` in the factory module, and its teardown
  is called from `dispose()`. Because it hosts runes, the factory file must use
  the **`.svelte.ts`** extension (`core/factory.svelte.ts`), not plain `.ts`.

## 8. CSS

The library does **not** import the dockview stylesheet. It depends on `dockview`
(which re-exports `dockview-core` **and** ships the stylesheet). The demo app
imports it once in `src/routes/+layout.svelte`, alongside the demo nav:

```svelte
<script lang="ts">
	import 'dockview/dist/styles/dockview.css';
	import '../app.css';
</script>
```

Library consumers do the same in their own root layout (or entry file):

```ts
import 'dockview/dist/styles/dockview.css';
```

`dockview-core` on its own ships no CSS, which is why the dependency is
`dockview` rather than `dockview-core`. The library never forces the import, so
tree-shaking/SSR are unaffected.

## 9. bind:active

`bind:active` exposes the current active panel + group as a reactive object:

```ts
export interface ActiveState {
  panel: IDockviewPanel | undefined;
  group: DockviewGroupPanel | undefined;
}
```

```svelte
<script lang="ts">
  import type { ActiveState } from 'dockview-svelte';
  let active = $state<ActiveState>({ panel: undefined, group: undefined });
</script>

<Dockview bind:active {widgets} />
<!-- active.panel / active.group update reactively -->
```

It mirrors `onDidActivePanelChange` / `onDidActiveGroupChange`. For the common
case of a *widget* reacting to its own activation, prefer `state.active`
(writable: set to `true` to activate) — that is the primary interaction point.

## 10. What still counts as "completely open"

- `handle.api` → every dockview escape hatch (`addPanel` with arbitrary
  component strings, `fromJSON`, `addFloatingGroup`, `removePanel`, …).
- `openPanel` passes through all unowned `AddPanelOptions`.
- `registerWidget` adds types at runtime without touching the initial registry.
- The deferred `<DvWidgets>` snippet path slots into the same `registerWidget`
  hole — nothing here forecloses it.

## 9. Title fallback (resolved)

There is **no global `defaultTitle` prop** — a single shared fallback for all
widgets doesn't make sense. The widget key is the final fallback:

```
title = options.title ?? widgets[key].title ?? key
```

The widget key (`'chat'`, `'help'`) is the same string dockview uses as the
component name, so it doubles as a sensible default label — matching dockview's
own convention of defaulting a tab's title to its component id. Widgets that
want a friendlier label declare `title` on their `WidgetDefinition`.

## 11. Layout loop-break (bind:layout)

`bind:layout` serializes on `onDidLayoutChange` and applies external changes via
`fromJSON`, guarded by a `lastEmitted` deep-equal check to prevent the
`fromJSON → onDidLayoutChange → emit` feedback loop.

`onDidLayoutFromJSON` is **deliberately not** part of the loop-break. dockview
runs `fromJSON()` inside `mutation("load")`, which fires `onWillMutateLayout` /
`onDidMutateLayout` then `onDidLayoutFromJSON`, and the whole batch aggregates
into the buffered `onDidLayoutChange` — the single emitter that serializes into
`bind:layout` (stamping `lastEmitted`). So a `fromJSON` triggered by the
`$effect` always converges (the emitted JSON deep-equals `lastEmitted` on the
next pass), and `onDidLayoutFromJSON` stays a pure "restore finished"
notification rather than a second emit path — wiring it into `lastEmitted`
would double-emit, not harden.
