import { cleanup, render } from '@testing-library/svelte'
import type { DockviewApi, SerializedDockview } from 'dockview'
import { tick } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DockviewHost from './DockviewHost.test.svelte'
import LayoutWidget from './LayoutWidget.test.svelte'

// jsdom has no ResizeObserver; dockview's `Resizable` needs one to build.
if (!('ResizeObserver' in globalThis)) {
	;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	}
}

/**
 * Integration test for `bind:layout` against the REAL `DockviewComponent`
 * (no mock): the binding must both **read** (dockview mutations push a new
 * layout up to the parent) and **write** (a parent assignment applies via
 * `fromJSON`). This is the "save then restore" flow the docs/playground demo
 * uses — re-entrancy included, since `fromJSON` itself emits a layout.
 */

async function flush(rounds = 5): Promise<void> {
	for (let i = 0; i < rounds; i++) await tick()
}

function panelCount(json: SerializedDockview | undefined): number {
	return json ? Object.keys(json.panels).length : 0
}

function snapshot(view: { container: HTMLElement }): SerializedDockview | undefined {
	const raw = view.container.querySelector('[data-testid="layout-snapshot"]')?.textContent ?? 'none'
	return raw === 'none' ? undefined : (JSON.parse(raw) as SerializedDockview)
}

/** Rendered widget bodies (not dockview's own count) — catches stale states. */
function rendered(view: { container: HTMLElement }): number {
	return view.container.querySelectorAll('[data-testid="widget"]').length
}

const widgets = { a: { component: LayoutWidget, title: 'A' } }

describe('bind:layout round trip (real DockviewComponent)', () => {
	afterEach(() => {
		cleanup()
	})

	it('reads dockview mutations back into the bound layout', async () => {
		let handle: { api: DockviewApi; openPanel: (k: string) => unknown } | undefined
		const view = render(DockviewHost, {
			props: {
				widgets,
				onReady: (e: { handle: typeof handle }) => {
					handle = e.handle
				},
			} as never,
		})
		await flush()

		expect(snapshot(view)).toBeUndefined()

		handle!.openPanel('a')
		handle!.openPanel('a')
		await flush()

		expect(panelCount(snapshot(view))).toBe(2)
		expect(handle!.api.panels.length).toBe(2)
		view.unmount()
	})

	it('writes a parent layout back into dockview (save → mutate → restore)', async () => {
		let handle: { api: DockviewApi; openPanel: (k: string) => unknown } | undefined
		const view = render(DockviewHost, {
			props: {
				widgets,
				onReady: (e: { handle: typeof handle }) => {
					handle = e.handle
				},
			} as never,
		})
		await flush()

		handle!.openPanel('a')
		handle!.openPanel('a')
		await flush()

		// Save — exactly what the playground button does.
		const saved = JSON.parse(JSON.stringify(snapshot(view))) as SerializedDockview
		expect(panelCount(saved)).toBe(2)
		const renderedBefore = rendered(view)

		// Mutate after saving: a third panel.
		handle!.openPanel('a')
		await flush()
		expect(handle!.api.panels.length).toBe(3)

		// Restore — parent assigns the saved layout back.
		await view.rerender({ layout: saved } as never)
		await flush()

		expect(handle!.api.panels.length).toBe(2)
		expect(panelCount(snapshot(view))).toBe(2)
		// The restored panels must actually render their widget content — a
		// reused/disposed PanelState would leave the bodies empty.
		expect(rendered(view)).toBe(renderedBefore)
		// Binding contract: the emitted `layout` tracks dockview's real JSON
		// (compared serialized — `toJSON()` emits `undefined`-valued keys that
		// the snapshot mirror's JSON round-trip drops).
		expect(JSON.stringify(snapshot(view))).toBe(JSON.stringify(handle!.api.toJSON()))
		view.unmount()
	})

	it('applies an externally assigned layout and does not loop', async () => {
		let handle: { api: DockviewApi; openPanel: (k: string) => unknown } | undefined
		const view = render(DockviewHost, {
			props: {
				widgets,
				onReady: (e: { handle: typeof handle }) => {
					handle = e.handle
				},
			} as never,
		})
		await flush()

		handle!.openPanel('a')
		await flush()
		const one = JSON.parse(JSON.stringify(snapshot(view))) as SerializedDockview

		handle!.openPanel('a')
		handle!.openPanel('a')
		await flush()
		expect(handle!.api.panels.length).toBe(3)

		// Restore the one-panel layout; the effect must settle (a loop would
		// hang the tick flush / blow the test timeout).
		await view.rerender({ layout: one } as never)
		await flush()

		expect(handle!.api.panels.length).toBe(1)
		view.unmount()
	})

	it('round-trips without spurious re-emits (layout identity is not rewritten)', async () => {
		let handle: { api: DockviewApi; openPanel: (k: string) => unknown } | undefined
		const view = render(DockviewHost, {
			props: {
				widgets,
				onReady: (e: { handle: typeof handle }) => {
					handle = e.handle
				},
			} as never,
		})
		await flush()

		handle!.openPanel('a')
		await flush()
		const saved = snapshot(view)!

		// Assigning a copy of the current layout must be a no-op, and must not
		// be rewritten to a different value.
		await view.rerender({ layout: JSON.parse(JSON.stringify(saved)) } as never)
		await flush()
		await flush()

		expect(handle!.api.panels.length).toBe(1)
		expect(panelCount(snapshot(view))).toBe(1)
		view.unmount()
	})

	it('re-applying the same saved layout does not rebuild the dock', async () => {
		// Regression: a save/restore round-trip goes through `JSON.stringify`/
		// `JSON.parse`, which drops the `undefined`-valued keys `toJSON()`
		// emits. The old guard compared the canonical object with `deepEqual`,
		// which distinguishes `{ k: undefined }` from `{}` — so re-applying the
		// *current* layout never matched and ran `fromJSON` again, tearing down
		// and rebuilding every panel (losing per-panel state).
		let handle: { api: DockviewApi; openPanel: (k: string) => unknown } | undefined
		const view = render(DockviewHost, {
			props: {
				widgets,
				onReady: (e: { handle: typeof handle }) => {
					handle = e.handle
				},
			} as never,
		})
		await flush()

		handle!.openPanel('a')
		handle!.openPanel('a')
		await flush()
		const saved = snapshot(view)!

		// The premise of the bug: dockview's canonical JSON carries
		// `undefined`-valued keys that a JSON round-trip strips, and
		// `deepEqual` treats the two shapes as different.
		const canonical = handle!.api.toJSON()
		expect(JSON.stringify(canonical)).not.toBe(String(canonical))
		expect(JSON.parse(JSON.stringify(canonical))).not.toStrictEqual(canonical)

		const fromJSON = vi.spyOn(handle!.api, 'fromJSON')

		// Restore the just-saved layout: dockview is already in that state.
		await view.rerender({ layout: JSON.parse(JSON.stringify(saved)) } as never)
		await flush()

		expect(fromJSON).not.toHaveBeenCalled()

		// And the binding stays canonical (serialized-equal to dockview's JSON).
		expect(JSON.stringify(snapshot(view))).toBe(JSON.stringify(handle!.api.toJSON()))
		view.unmount()
	})
})
