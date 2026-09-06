import { cleanup, render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SplitviewHost from './SplitviewHost.test.svelte'

/**
 * Splitview component logic: `bind:layout` loop-break, `bind:views` seeding +
 * refresh, `options` → `updateOptions`, `nextId` counter, and the
 * `not mounted yet` / `unknown widget` error throws.
 *
 * The real `createSplitview` is replaced with a controllable fake api; the
 * real `createSplitviewFactory` is kept so `openPanel` exercises the registry
 * + `nextId` path end to end.
 */
const { makeFakeSplitviewApi } = vi.hoisted(() => {
	const makeFakeSplitviewApi = () => {
		const listeners: Record<string, Array<() => void>> = {}
		const on = (key: string) => (cb: () => void) => {
			;(listeners[key] ??= []).push(cb)
			return { dispose: vi.fn() }
		}
		const panels: Array<{ id: string; api: Record<string, unknown> }> = []
		const api = {
			get panels() {
				return panels
			},
			addPanel: vi.fn((opts: { id: string; component: string; params?: unknown }) => {
				const panel = { id: opts.id, api: { id: opts.id } }
				panels.push(panel)
				return panel
			}),
			getPanel: vi.fn((id: string) => panels.find((p) => p.id === id)),
			removePanel: vi.fn((panel: { id: string }) => {
				const i = panels.findIndex((p) => p.id === panel.id)
				if (i >= 0) panels.splice(i, 1)
				listeners.removeView?.forEach((cb) => cb())
			}),
			movePanel: vi.fn(),
			fromJSON: vi.fn(function (this: { panels: unknown[] }, _json: unknown) {
				listeners.layoutFromJSON?.forEach((cb) => cb())
			}),
			toJSON: vi.fn(() => ({ kind: 'splitview', views: panels.map((p) => p.id) })),
			updateOptions: vi.fn(),
			dispose: vi.fn(),
			onDidLayoutChange: vi.fn(on('layoutChange')),
			onDidLayoutFromJSON: vi.fn(on('layoutFromJSON')),
			onDidAddView: vi.fn(on('addView')),
			onDidRemoveView: vi.fn(on('removeView')),
			emitLayoutChange: () => listeners.layoutChange?.forEach((cb) => cb()),
		}
		return api
	}
	return { makeFakeSplitviewApi }
})

vi.mock('dockview', async (importOriginal) => {
	const actual = await importOriginal<typeof import('dockview')>()
	return {
		...actual,
		createSplitview: vi.fn(() => makeFakeSplitviewApi()),
	}
})

const { createSplitview } = await import('dockview')

async function flush(rounds = 3): Promise<void> {
	for (let i = 0; i < rounds; i++) await tick()
}

describe('Splitview component logic', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		cleanup()
	})

	/** Scoped text query — avoids cross-test `document.body` leakage. */
	function text(view: { container: HTMLElement }, testid: string): string {
		return view.container.querySelector(`[data-testid="${testid}"]`)?.textContent ?? ''
	}

	it('exposes a handle and seeds empty views on mount', async () => {
		let captured: { api: unknown; handle: unknown } | undefined
		const view = render(SplitviewHost, {
			props: {
				widgets: { a: { component: { name: 'A' } } },
				onReady: (e: { api: unknown; handle: unknown }) => {
					captured = e
				},
			} as never,
		})
		await flush()

		expect(captured).toBeDefined()
		expect(text(view, 'has-handle')).toBe('yes')
		expect(text(view, 'views-count')).toBe('0')
		view.unmount()
	})

	it('openPanel assigns sequential ids and refreshes bind:views', async () => {
		let handle:
			| {
					openPanel: (key: string, opts?: Record<string, unknown>) => { id: string }
			  }
			| undefined
		let apiRef: ReturnType<typeof makeFakeSplitviewApi> | undefined
		const view = render(SplitviewHost, {
			props: {
				widgets: { a: { component: { name: 'A' } } },
				onReady: (e: { api: typeof apiRef; handle: typeof handle }) => {
					handle = e.handle
					apiRef = e.api
				},
			} as never,
		})
		await flush()

		const h1 = handle!.openPanel('a')
		const h2 = handle!.openPanel('a')
		await flush()

		expect(h1.id).toBe('a-1')
		expect(h2.id).toBe('a-2')
		expect(apiRef!.panels.map((p) => p.id)).toEqual(['a-1', 'a-2'])
		expect(apiRef!.onDidAddView).toHaveBeenCalled()
		expect(text(view, 'layout-snapshot')).not.toBe('none')
		expect(text(view, 'views-count')).toBe('2')
		expect(text(view, 'views-ids')).toBe('a-1,a-2')
		view.unmount()
	})

	it('throws for unknown widgets', async () => {
		let handle: { openPanel: (key: string) => unknown } | undefined
		const view = render(SplitviewHost, {
			props: {
				widgets: {},
				onReady: (e: { handle: typeof handle }) => {
					handle = e.handle
				},
			} as never,
		})
		await flush()

		expect(() => handle!.openPanel('missing')).toThrow('unknown widget "missing"')
		view.unmount()
	})

	it('removePanel, movePanel, setVisible and setActive delegate to the api', async () => {
		let captured: { api: ReturnType<typeof makeFakeSplitviewApi>; handle: never } | undefined
		const view = render(SplitviewHost, {
			props: {
				widgets: { a: { component: { name: 'A' } } },
				onReady: (e: typeof captured) => {
					captured = e
				},
			} as never,
		})
		await flush()

		const h = (
			captured!.handle as {
				openPanel: (k: string) => { id: string }
				removePanel: (id: string) => void
				movePanel: (from: number, to: number) => void
				setVisible: (id: string, visible: boolean) => void
				setActive: (id: string) => void
			}
		).openPanel('a')
		await flush()
		expect(text(view, 'views-count')).toBe('1')

		captured!.handle
		;(
			captured!.handle as unknown as {
				removePanel: (id: string) => void
				movePanel: (from: number, to: number) => void
				setVisible: (id: string, visible: boolean) => void
				setActive: (id: string) => void
			}
		).removePanel(h.id)
		await flush()
		expect(text(view, 'views-count')).toBe('0')

		expect(() =>
			(captured!.handle as unknown as { removePanel: (id: string) => void }).removePanel('nope')
		).toThrow('unknown panel "nope"')

		;(captured!.handle as unknown as { movePanel: (from: number, to: number) => void }).movePanel(
			0,
			1
		)
		expect(captured!.api.movePanel).toHaveBeenCalledWith(0, 1)

		// `setVisible`/`setActive` delegate to the panel view (the fake api
		// has no `setVisible` — the panel object carries `setVisible`).
		const h2 = (
			captured!.handle as unknown as {
				openPanel: (k: string) => { id: string }
				setVisible: (id: string, visible: boolean) => void
				setActive: (id: string) => void
			}
		).openPanel('a')
		await flush()
		const panel = captured!.api.getPanel(h2.id) as unknown as {
			setVisible: ReturnType<typeof vi.fn>
			setActive: ReturnType<typeof vi.fn>
		}
		panel.setVisible = vi.fn()
		panel.setActive = vi.fn()
		;(
			captured!.handle as unknown as {
				setVisible: (id: string, visible: boolean) => void
				setActive: (id: string) => void
			}
		).setVisible(h2.id, false)
		expect(panel.setVisible).toHaveBeenCalledWith(false)
		;(
			captured!.handle as unknown as {
				setVisible: (id: string, visible: boolean) => void
				setActive: (id: string) => void
			}
		).setActive(h2.id)
		expect(panel.setActive).toHaveBeenCalledWith(true)
		expect(() =>
			(
				captured!.handle as unknown as {
					setVisible: (id: string, visible: boolean) => void
				}
			).setVisible('nope', true)
		).toThrow('unknown panel "nope"')
		view.unmount()
	})

	it('options changes flow to updateOptions', async () => {
		let captured: { api: ReturnType<typeof makeFakeSplitviewApi> } | undefined
		const view = render(SplitviewHost, {
			props: {
				widgets: {},
				options: { orientation: 'HORIZONTAL' },
				onReady: (e: typeof captured) => {
					captured = e
				},
			} as never,
		})
		await flush()
		// The mount effect applies the initial options once via updateOptions.
		expect(captured!.api.updateOptions).toHaveBeenCalledWith({ orientation: 'HORIZONTAL' })
		vi.mocked(captured!.api.updateOptions).mockClear()

		await view.rerender({ options: { orientation: 'VERTICAL' } } as never)
		await flush()
		expect(captured!.api.updateOptions).toHaveBeenCalledWith({ orientation: 'VERTICAL' })
		view.unmount()
	})

	it('external layout changes call fromJSON; emitted layout does not loop back', async () => {
		let captured: { api: ReturnType<typeof makeFakeSplitviewApi> } | undefined
		const view = render(SplitviewHost, {
			props: {
				widgets: { a: { component: { name: 'A' } } },
				onReady: (e: typeof captured) => {
					captured = e
				},
			} as never,
		})
		await flush()

		// Internal change emits layout (toJSON) — fromJSON must NOT be called back.
		captured!.api.emitLayoutChange()
		await flush()
		expect(captured!.api.fromJSON).not.toHaveBeenCalled()

		// External layout change applies via fromJSON.
		await view.rerender({ layout: { kind: 'external' } } as never)
		await flush()
		expect(captured!.api.fromJSON).toHaveBeenCalledWith({ kind: 'external' })
		view.unmount()
	})

	it('createSplitview receives the orientation option', async () => {
		const view = render(SplitviewHost, {
			props: { widgets: {}, options: { orientation: 'VERTICAL' } } as never,
		})
		await flush()
		expect(vi.mocked(createSplitview)).toHaveBeenCalled()
		const opts = vi.mocked(createSplitview).mock.calls[0][1] as unknown as Record<string, unknown>
		expect(opts.orientation).toBe('VERTICAL')
		expect(typeof opts.createComponent).toBe('function')
		view.unmount()
	})
})
