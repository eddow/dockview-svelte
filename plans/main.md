# dockview-svelte — Plan

## 0. Goal

Svelte 5 (runes) wrapper around Dockview layout engine. SvelteKit project doubles as library (`src/lib`) and test/demo host (`src/routes`).

Terminology:

- `widget`: Svelte component definition.
- `panel`: instantiated widget (`widget + id + reactive params`).

## 1. Dependencies (installed)

- `svelte@5.57.0`, `@sveltejs/kit@2.x` (library template, runes forced in `vite.config.ts`).
- `dockview@8.2.0` (the only runtime dep — it re-exports `dockview-core` and ships the stylesheet). Import from `dockview`.
- CSS: imported directly from the dependency, `dockview/dist/styles/dockview.css` (no vendored copy; `dockview-core` alone ships no CSS).
- Tests: `vitest@5`, `vitest-browser-svelte`, `@vitest/browser`, `jsdom`, `@testing-library/svelte`, `@playwright/test` + `playwright`.

## 2. Scope

- v1: `Dockview` only (`DockviewComponent`, `DockviewApi`, `IContentRenderer`, `ITabRenderer`).
- v2: `Gridview`, `Splitview`, `Paneview` reuse same factory/state pattern.
- No `<DvPanel>` declarative children. No separate `panels` array.

## 3. Public API

```svelte
<script>
  import { Dockview, defineWidgets } from '$lib';
  import 'dockview/dist/styles/dockview.css';

  const widgets = defineWidgets({
    chat: { component: ChatWidget, tab: ChatTab, title: 'Chat' },
    help: { component: HelpWidget }, // no tab, no title → widget key fallback
  });

  let handle = $state();
  let layout = $state(savedJson ?? defaultLayout);
  let active = $state({ panel: undefined, group: undefined });
</script>

<Dockview
  bind:handle
  bind:layout
  bind:active
  {widgets}
  options={{ ...dockviewOptions }}
  onReady={(e) => ...}
  onDidLayoutChange={...}
  class="dv-theme-dark"
/>
```

| Prop | Type | Notes |
|---|---|---|
| `widgets` | `Widgets` (via `defineWidgets`) | registry `{ [key]: { component, tab?, title? } }` — single source of truth |
| `layout` | `Dockview JSON` (`toJSON`/`fromJSON` shape) | default + saved/reloaded config; `bind:` for persistence |
| `handle` | `DockviewHandle` | `bind:handle` → `{ api, openPanel, registerWidget }` |
| `active` | `ActiveState` | `bind:active` → reactive `{ panel, group }` of the active panel/group |
| `options` | `DockviewComponentOptions` passthrough | theme, keyboard, history, edge groups, etc. |
| events | `onReady`, `onDid*` passthrough | bridged without re-render loops |

Imperative control goes through the bound handle:

```ts
const panel = handle.openPanel('chat', { title: 'New chat', params: { id: 1 } });
panel.state.custom.unread = 3;
handle.api.fromJSON(savedLayout); // full escape hatch
```

## 4. Shared `PanelState` (tab ↔ content link)

One `$state` object per panel, created once in the content factory, shared by
reference between tab and content mounts. Full spec in `docs/panels.md`.

```ts
interface PanelState<P = Record<string, unknown>> {
  params: P;                               // double-bound with dockview (both directions)
  size: { width: number; height: number }; // written by renderer layout(); rAF-throttled
  shown: boolean;                          // renderer onShow/onHide — content mounted as active tab
  visible: boolean;                        // dockview api.isVisible — gridview-level
  active: boolean;                         // api.isActive — write `true` to activate
  focused: boolean;                        // api.isFocused (read-only)
  pinned: boolean;                         // api.isPinned — two-way
  groupActive: boolean;                    // api.isGroupActive (read-only)
  api: DockviewPanelApi;                   // per-panel api
  title: string;                           // read-only mirror of dockview's title
  custom: Record<string, unknown>;         // app channel, e.g. `custom.unread = 3`
}
```

- Created with `$state({ ... })` so every field is reactive.
- Widgets receive the whole `state` object as a single prop and mutate fields
  directly (`state.custom.unread = 3`, `state.params.x = 1`).
- `title` is owned by dockview; `state.title` mirrors `api.onDidTitleChange`.
  Rename via `state.api.setTitle(...)`.
- `params` is fully two-way; `size` is rAF-throttled (see `docs/panels.md` §7).
- `shown` comes from the renderer's `onShow`/`onHide`; `visible`, `active`,
  `focused`, `pinned`, `groupActive` mirror dockview's `api.is*` (and their
  `onDid*` events). `active` is writable (writing `true` activates); `pinned` is
  two-way; the rest are read-only.

## 5. Factories (core engine approach)

Use vanilla core, no React package. The factory module is
`core/factory.svelte.ts` (rune-hosting). For each `addPanel({ id, component })`:

- `createComponent({ id, name /* widget key */ }) → IContentRenderer`:
  - `element: HTMLElement` (container owned by dockview).
  - `init({ params, api, title, containerApi })`: get-or-create `PanelState`,
    `mount(widget, { target: element, props: state })`, store
    `{ state, unmountContent, unmountTab }` in `Map<id, …>`.
  - `update({ params })`: deep-merge into `state.params` (dockview → widget).
  - `layout(w, h)`: rAF-throttled write to `state.size` (skipped when `!shown`).
  - `onShow()`/`onHide()`: toggle `state.shown`.
  - subscribe `onDidActiveChange`/`onDidFocusChange`/`onDidVisibilityChange`/
    `onDidChangePinned`/`onDidActiveGroupChange` → mirror `active`/`focused`/
    `visible`/`pinned`/`groupActive`; `$effect`s drive `setActive`/`setPinned`.
  - `dispose()`: tear down this renderer only.
- `createTabComponent({ id, name })` — resolves `widgets[name].tab ?? DefaultTab`,
  receiving the **same** `PanelState` reference.
- `PanelState` is `getOrCreate`-shared between tab and content, because dockview's
  tab/content construction order is not guaranteed.

Two mounts per panel: tab and content are separate renderers, each with its own
`dispose()`. The registry maps `id → { state, unmountContent, unmountTab }`; each
`dispose()` clears its own handle and the last one out releases `state`.

State preservation: dockview moves DOM nodes on drag; mounts survive because
`dispose` is not called. No Svelte-side reconciliation.

## 6. Context (widget registration + api access)

`Dockview` provides via `setContext` (single `DOCKVIEW_CONTEXT_KEY`):

- `api`: parent `DockviewApi` (same as `handle.api`), populated on mount — read reactively.
- `registerWidget(key, def: WidgetDefinition)`: runtime registration path. Required so a future `<DvWidgets>` can register without touching the `widgets` prop:
  ```svelte
  <!-- future, not v1 -->
  <DvWidgets>
    {#snippet chat(state)}<ChatWidget {...state} />{/snippet}
  </DvWidgets>
  ```
  Forwarder registers a thin wrapper component per slot and forwards slot params (`params/api/size/title/custom`) as snippet scope. v1 only needs the context hook to exist and be tested; the component itself is deferred.

## 7. SSR / client-only

- `DockviewComponent` instantiates in `onMount` only, guarded by `browser` + `{#if}`; SSR renders empty container div. No dockview import side effects at module top-level beyond types.

## 8. Theming / CSS

- The library does **not** import CSS. The dependency is `dockview` (which
  re-exports `dockview-core` and ships the stylesheet); users import
  `dockview/dist/styles/dockview.css` once. `class`/`theme` props forwarded to
  container.

## 9. File layout

```text
src/lib/
  index.ts                     # re-exports
  components/Dockview.svelte
  components/DefaultTab.svelte
  core/factory.svelte.ts       # content/tab renderers + PanelState (rune-hosting)
  core/types.ts                # PanelState, WidgetDefinition, handle/openPanel types
  core/registry.ts             # WidgetRegistry, defineWidgets
  core/context.ts              # DOCKVIEW_CONTEXT_KEY + DockviewContext
  core/utils.ts                # deepEqual, mergeInto
src/routes/+page.svelte        # demo (client-only, manual CSS import from dockview)
```

## 10. Testing

- Unit (`vitest`, jsdom): registry/factory logic, `PanelState` creation, `update`/`layout` mutation, dispose→unmount mapping (mock `mount`/`unmount`).
- Browser component (`vitest-browser-svelte` + Playwright browser): real `Dockview` mount, add/remove panel, tab+content share same state, `custom.unread` round-trip, drag does not reset state.
- E2E (`@playwright/test`, `src/routes` demo): save/restore `bind:layout` round-trip, reload persistence.

Scripts to add: `test:unit`, `test:browser`, `test:e2e`, wired in `package.json` + `vitest.config` / `playwright.config`.

## 11. Checklist

### v1 core — done

- [x] `types.ts` — `PanelState`, `ActiveState`, `WidgetComponent`, `ParamsOf`, `WidgetDefinition`, `PanelHandle`, `OpenPanelOptions`, `OpenPanelFn`, `DockviewHandle`
- [x] `registry.ts` — `WidgetRegistry` + `defineWidgets`
- [x] `factory.svelte.ts` — content/tab renderers, `PanelState` (`$state`), params double-bind, title/active/focused/visible/pinned/groupActive mirrors, `shown` + `onShow`/`onHide`, rAF `layout`, two-mount teardown
- [x] `context.ts` — `DOCKVIEW_CONTEXT_KEY` + `DockviewContext`
- [x] `utils.ts` — `deepEqual`, `mergeInto`
- [x] `Dockview.svelte` — `bind:handle`, `bind:layout` (loop-break), `bind:active`, `widgets` seed, all ~33 events bridged, generic `<W extends Widgets>`, client-only
- [x] `DefaultTab.svelte` — title + close
- [x] `index.ts` re-exports

### Open issues

_(none — events, per-panel reactive state, and `bind:active` are all done.)_

### Tests & v2

- [ ] Unit tests (jsdom): registry, `PanelState`, `update`/`layout`/`onShow`/`onHide`, dispose→unmount
- [ ] Browser test (real mount): tab+content share state, `custom.unread` round-trip, `active`/`pinned`/visibility toggles
- [ ] Reconcile E2E tier (`@playwright/test`) — keep or fold into browser tests
- [ ] `registerWidget` context hook test (prep for `<DvWidgets>`, deferred)
- [ ] Gridview / Splitview / Paneview ports
