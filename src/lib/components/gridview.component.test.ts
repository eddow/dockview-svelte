import { cleanup, render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GridviewHost from './GridviewHost.test.svelte'

/**
 * Gridview component logic: `bind:layout` loop-break, `bind:panels` /
 * `bind:activePanel` seeding + refresh, `options` → `updateOptions`, `nextId`
 * counter, and the `not mounted yet` / `unknown widget` / `unknown panel`
 * error throws.
 *
 * The real `createGridview` is replaced with a controllable fake api; the
 * real `createGridviewFactory` is kept so `openPanel` exercises the registry
 * + `nextId` path end to end.
 */
const { makeFakeGridviewApi } = vi.hoisted(() => {
	const makeFakeGridviewApi = () => {
		const listeners: Record<string, Array<(e: never) => void>> = {}
		const on = (key: string) => (cb: (e: never) => void) => {
			;(listeners[key] ??= []).push(cb)
			return { dispose: vi.fn() }
		}
		const panels: Array<{
			id: string
			setVisible: ReturnType<typeof vi.fn>
			setActive: ReturnType<typeof vi.fn>
		}> = []
		const api = {
			get panels() {
				return panels
			},
			addPanel: vi.fn((opts: { id: string; component: string; params?: unknown }) => {
				const panel = { id: opts.id, setVisible: vi.fn(), setActive: vi.fn() }
				panels.push(panel)
				return panel
			}),
			getPanel: vi.fn((id: string) => panels.find((p) => p.id === id)),
			removePanel: vi.fn((panel: { id: string }) => {
				const i = panels.findIndex((p) => p.id === panel.id)
				if (i >= 0) panels.splice(i, 1)
				listeners.removePanel?.forEach((cb) => cb({} as never))
			}),
			movePanel: vi.fn(),
			fromJSON: vi.fn((_json: unknown) => {
				listeners.layoutFromJSON?.forEach((cb) => cb({} as never))
			}),
			toJSON: vi.fn(() => ({ kind: 'gridview', views: panels.map((p) => p.id) })),
			updateOptions: vi.fn(),
			dispose: vi.fn(),
			onDidLayoutChange: vi.fn(on('layoutChange')),
			onDidLayoutFromJSON: vi.fn(on('layoutFromJSON')),
			onDidAddPanel: vi.fn(on('addPanel')),
			onDidRemovePanel: vi.fn(on('removePanel')),
			onDidActivePanelChange: vi.fn(on('activePanel')),
			emitLayoutChange: () => listeners.layoutChange?.forEach((cb) => cb({} as never)),
			emitActivePanel: (panel: unknown) =>
				listeners.activePanel?.forEach((cb) => cb(panel as never)),
		}
		return api
	}
	return { makeFakeGridviewApi }
})

vi.mock('dockview', async (importOriginal) => {
	const actual = await importOriginal<typeof import('dockview')>()
	return {
		...actual,
		createGridview: vi.fn(() => makeFakeGridviewApi()),
	}
})

const { createGridview } = await import('dockview')

async function flush(rounds = 3): Promise<void> {
	for (let i = 0; i < rounds; i++) await tick()
}

describe('Gridview component logic', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		cleanup()
	})

	function text(view: { container: HTMLElement }, testid: string): string {
		return view.container.querySelector(`[data-testid="${testid}"]`)?.textContent ?? ''
	}

	it('exposes a handle and seeds empty panels on mount', async () => {
		let captured: { api: unknown; handle: unknown } | undefined
		const view = render(GridviewHost, {
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
		expect(text(view, 'panels-count')).toBe('0')
		view.unmount()
	})

	it('openPanel assigns sequential ids and refreshes bind:panels', async () => {
		let handle:
			| {
					openPanel: (key: string, opts?: Record<string, unknown>) => { id: string }
			  }
			| undefined
		let apiRef: ReturnType<typeof makeFakeGridviewApi> | undefined
		const view = render(GridviewHost, {
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
		expect(text(view, 'layout-snapshot')).not.toBe('none')
		expect(text(view, 'panels-count')).toBe('2')
		expect(text(view, 'panels-ids')).toBe('a-1,a-2')
		view.unmount()
	})

	it('throws for unknown widgets and unknown panels', async () => {
		let handle:
			| {
					openPanel: (key: string) => unknown
					removePanel: (id: string) => unknown
					movePanel: (id: string, move: unknown) => unknown
					setVisible: (id: string, v: boolean) => unknown
					setActive: (id: string) => unknown
			  }
			| undefined
		const view = render(GridviewHost, {
			props: {
				widgets: {},
				onReady: (e: { handle: typeof handle }) => {
					handle = e.handle
				},
			} as never,
		})
		await flush()

		expect(() => handle!.openPanel('missing')).toThrow('unknown widget "missing"')
		expect(() => handle!.removePanel('nope')).toThrow('unknown panel "nope"')
		expect(() => handle!.movePanel('nope', { direction: 'right', reference: 'x' })).toThrow(
			'unknown panel "nope"'
		)
		expect(() => handle!.setVisible('nope', true)).toThrow('unknown panel "nope"')
		expect(() => handle!.setActive('nope')).toThrow('unknown panel "nope"')
		view.unmount()
	})

	it('removePanel / movePanel / setVisible / setActive delegate to the api', async () => {
		let captured: { api: ReturnType<typeof makeFakeGridviewApi>; handle: never } | undefined
		const view = render(GridviewHost, {
			props: {
				widgets: { a: { component: { name: 'A' } } },
				onReady: (e: typeof captured) => {
					captured = e
				},
			} as never,
		})
		await flush()
		type H = {
			openPanel: (k: string) => { id: string }
			removePanel: (id: string) => void
			movePanel: (id: string, move: unknown) => void
			setVisible: (id: string, v: boolean) => void
			setActive: (id: string) => void
		}
		const h = (captured!.handle as unknown as H).openPanel('a')
		await flush()
		expect(text(view, 'panels-count')).toBe('1')

		;(captured!.handle as unknown as H).setVisible(h.id, false)
		expect(captured!.api.getPanel(h.id)?.setVisible).toHaveBeenCalledWith(false)
		;(captured!.handle as unknown as H).setActive(h.id)
		expect(captured!.api.getPanel(h.id)?.setActive).toHaveBeenCalledWith(true)
		;(captured!.handle as unknown as H).movePanel(h.id, {
			direction: 'right',
			reference: h.id,
		})
		expect(captured!.api.movePanel).toHaveBeenCalled()

		;(captured!.handle as unknown as H).removePanel(h.id)
		await flush()
		expect(text(view, 'panels-count')).toBe('0')
		view.unmount()
	})

	it('active panel events refresh bind:activePanel', async () => {
		let captured: { api: ReturnType<typeof makeFakeGridviewApi> } | undefined
		const view = render(GridviewHost, {
			props: {
				widgets: { a: { component: { name: 'A' } } },
				onReady: (e: typeof captured) => {
					captured = e
				},
			} as never,
		})
		await flush()
		expect(text(view, 'active-id')).toBe('none')

		captured!.api.emitActivePanel({ id: 'a-1' })
		await flush()
		expect(text(view, 'active-id')).toBe('a-1')
		view.unmount()
	})

	it('options changes flow to updateOptions', async () => {
		let captured: { api: ReturnType<typeof makeFakeGridviewApi> } | undefined
		const view = render(GridviewHost, {
			props: {
				widgets: {},
				options: { proportionalLayout: true },
				onReady: (e: typeof captured) => {
					captured = e
				},
			} as never,
		})
		await flush()
		expect(captured!.api.updateOptions).toHaveBeenCalledWith({ proportionalLayout: true })
		vi.mocked(captured!.api.updateOptions).mockClear()

		await view.rerender({ options: { proportionalLayout: false } } as never)
		await flush()
		expect(captured!.api.updateOptions).toHaveBeenCalledWith({ proportionalLayout: false })
		view.unmount()
	})

	it('external layout changes call fromJSON; emitted layout does not loop back', async () => {
		let captured: { api: ReturnType<typeof makeFakeGridviewApi> } | undefined
		const view = render(GridviewHost, {
			props: {
				widgets: { a: { component: { name: 'A' } } },
				onReady: (e: typeof captured) => {
					captured = e
				},
			} as never,
		})
		await flush()

		captured!.api.emitLayoutChange()
		await flush()
		expect(captured!.api.fromJSON).not.toHaveBeenCalled()

		await view.rerender({ layout: { kind: 'external' } } as never)
		await flush()
		expect(captured!.api.fromJSON).toHaveBeenCalledWith({ kind: 'external' })
		view.unmount()
	})

	it('createGridview defaults orientation to HORIZONTAL', async () => {
		const view = render(GridviewHost, { props: { widgets: {} } as never })
		await flush()
		expect(vi.mocked(createGridview)).toHaveBeenCalled()
		const opts = vi.mocked(createGridview).mock.calls[0][1] as unknown as Record<string, unknown>
		expect(opts.orientation).toBe('HORIZONTAL')
		expect(typeof opts.createComponent).toBe('function')
		view.unmount()
	})
})
