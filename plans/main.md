# dockview-svelte — Remaining work

Everything else is done and documented in `/docs/` and `README.md`. This file
lists only what still has to be done.

## 2. `license` field in `package.json`

`publint` suggests adding a `"license"` field (a `LICENSE` file is already
present but the package metadata doesn't declare it).

## 3. Test coverage gaps

The suite covers registry/`utils`/factory *shape* and demo *smoke*, but not the
code most likely to break: the reactive double-bind and loop-break guards.

### 3.1 Widget → dockview double-bind (highest value)

The `$effect` pushes are untested — only dockview → widget is covered. Add to
each factory test:

- [ ] mutating `state.params` → `api.updateParameters(snapshot)`
- [ ] writing `state.active = true` → `api.setActive()`
- [ ] toggling `state.pinned` → `api.setPinned()` (Dockview)
- [ ] toggling `state.expanded` → `api.setExpanded()` (Paneview)

### 3.2 Loop-break guards

- [ ] assert a dockview-origin update does **not** re-trigger `updateParameters`
      (`lastParams`/`lastActive`/`lastPinned`/`lastExpanded` short-circuit)

### 3.3 rAF coalescing (currently defeated by sync stub)

- [ ] stub `requestAnimationFrame` to **queue**, flush manually, assert N rapid
      `emitDimensions` coalesce into **one** `state.size` write
- [ ] add the same for the Dockview factory's `layout()` rAF path (untested)

### 3.4 `.svelte` component logic (only smoke-tested via e2e)

- [ ] `bind:layout` loop-break (`lastEmitted`)
- [ ] `bind:active` / `bind:floating` / `bind:popout` / `bind:panels` seeding + refresh
- [ ] `options` → `updateOptions` `$effect`
- [ ] watermark overlay conditional render
- [ ] `nextId` counter
- [ ] error throws (`not mounted yet`, `unknown widget`) on `openPanel` /
      `float` / `popout` / `dockAll` / `removePanel` / `movePanel` /
      `setVisible` / `setActive` / `setExpanded`

### 3.5 E2E behavioral gaps

- [ ] `params` demo: click the two-way buttons (`step++ (param)`, `rename to
      count`), not the local-only `+ step (local)`
- [ ] `bind:layout` persistence across a **page reload**
- [ ] `bind:active` asserted on a **user** tab click (not just initial seed)

### 3.6 Minor unit gaps

- [ ] `mergeInto`: no-op merge does not reassign (the `deepEqual` short-circuit)
- [ ] `deepEqual`: `undefined`-in-object, `NaN`, nested arrays
- [ ] `context.test.ts` runtime `registerWidget` path for splitview / gridview /
      paneview (only Dockview covered)
