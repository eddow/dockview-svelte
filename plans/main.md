# dockview-svelte — Remaining work

Everything else is done and documented in `/docs/` and `README.md`. This file
lists only what still has to be done.

## 1. `<DvWidgets>` declarative slot-forwarder

Deferred. The `registerWidget` context hook (and `getContext`) already exists and
is tested; only the component itself is missing:

```svelte
<DvWidgets>
  {#snippet chat(state)}<ChatWidget {...state} />{/snippet}
</DvWidgets>
```

Registers a thin wrapper component per slot and forwards slot params
(`params/api/size/title/custom`) as snippet scope.

## 2. `license` field in `package.json`

`publint` suggests adding a `"license"` field (a `LICENSE` file is already
present but the package metadata doesn't declare it).
