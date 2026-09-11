import { render } from '@testing-library/svelte'
import type { DockviewApi, SerializedDockview } from 'dockview'
import { tick } from 'svelte'
import { describe, it, vi } from 'vitest'
import DockviewHost from './DockviewHost.test.svelte'
import LayoutWidget from './LayoutWidget.test.svelte'

if (!('ResizeObserver' in globalThis)) {
	;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	}
}

async function flush(rounds = 5): Promise<void> {
	for (let i = 0; i < rounds; i++) await tick()
}

describe('probe: does fromJSON fire onDidLayoutChange?', () => {
	it('probes', async () => {
		let handle: { api: DockviewApi; openPanel: (k: string) => unknown } | undefined
		const view = render(DockviewHost, {
			props: {
				widgets: { a: { component: LayoutWidget, title: 'A' } },
				onReady: (e: { handle: typeof handle }) => {
					handle = e.handle
				},
			} as never,
		})
		await flush()

		handle!.openPanel('a')
		await flush()
		const raw = view.container.querySelector('[data-testid="layout-snapshot"]')?.textContent ?? ''
		const saved = JSON.parse(raw) as SerializedDockview

		// Mutate to 2 panels, then restore the 1-panel layout (a real change,
		// so the guard cannot skip `fromJSON`).
		handle!.openPanel('a')
		await flush()

		const layoutChange = vi.fn()
		handle!.api.onDidLayoutChange(layoutChange)
		const toJSON = vi.spyOn(handle!.api, 'toJSON')

		await view.rerender({ layout: JSON.parse(JSON.stringify(saved)) } as never)
		await flush()

		throw new Error(
			`PROBE panels=${handle!.api.panels.length} onDidLayoutChange=${layoutChange.mock.calls.length} toJSON=${toJSON.mock.calls.length}`
		)
	})
})
