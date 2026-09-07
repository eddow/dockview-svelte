# install test (local-publish consumer)

Minimal consumer that installs `dockview-svelte` from a local publish
tarball and renders one basic `Dockview` with a single widget.

## Run

From the repo root:

```sh
npm run test:install
```

This rebuilds `dist` (`prepack`), packs the library
(`npm pack` → `tests/install/dockview-svelte-local.tgz`), installs this
project from that tarball, and runs the Playwright spec.

Do not run `npm install` in here directly — the tarball only exists after
packing from the repo root.
