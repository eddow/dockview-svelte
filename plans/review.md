# dockview-svelte — Outstanding issues

What remains from the plan review after the v1 implementation. Fixed items have
been removed; the active checklist lives in `plans/main.md` §11.

## 1. Tests

No unit tests exist yet; the demo E2E spec is minimal (three tests). The plan's
three overlapping browser tiers (unit + `vitest-browser-svelte` +
`@playwright/test`) are largely redundant; the "drag does not reset state"
assertion is the flakiest one.

## 2. Minor items

- **`options` passthrough**: `Dockview.svelte` excludes only `createComponent` /
  `createTabComponent`. The other framework factories
  (`createWatermarkComponent`, header-action factories,
  `createContextMenuItemComponent`, `defaultTabComponent`) pass through as raw
  dockview renderers — intentional, but should be documented as not Svelte-wrapped.
- **`onDidLayoutFromJSON` loop risk**: it is not wired into `lastEmitted`, so a
  `fromJSON` triggered by the `$effect` could in principle emit a layout that
  differs from its input and re-trigger. Latent (only `onDidLayoutChange` emits
  today), but tightening it removes the risk.
- **`tests/demo.spec.ts` "layout round-trips"** only asserts tab visibility, not
  the serialized `bind:layout` output — either assert the JSON or rename the test.