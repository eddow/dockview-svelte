import { cleanup, render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DockviewHost from './DockviewHost.test.svelte'
import Watermark from './Watermark.test.svelte'

/**
 * Dockview component logic: `bind:layout` loop-break, `bind:active` /
 * `bind:floating` / `bind:popout` seeding + refresh, `options` →
 * `updateOptions`, watermark overlay conditional render, `nextId` counter,
 * title resolution, and the `not mounted yet` / `unknown widget` throws for
 * `openPanel` / `float` / `popout` / `dockAll`.
 *
 * The real `DockviewComponent` is replaced with a controllable fake; the real
 * `createDockviewFactory` is kept so `openPanel` exercises the registry +
 * `nextId` path end to end.
 */
const { makeFakeDockview } = vi.hoisted(() => {
	const makeFakeDockview = () => {
		const listeners: Record<string, Array<(e: never) => void>> = {}
		const on = (key: string) => (cb: (e: never) => void) => {
			;(listeners[key] ??= []).push(cb)
			return { dispose: vi.fn() }
		}
		const panels: Array<{ id: string; api: Record<string, unknown> }> = []
		const groups: Array<{ id: string; api: { location: { type: string } } }> = [
			{ id: 'grid-1', api: { location: { type: 'grid' } } },
		]
		const api = {
			get panels() {
				return panels
			},
			get groups() {
				return groups
			},
			activePanel: undefined as { id: string } | undefined,
			activeGroup: undefined as { id: string } | undefined,
			addPanel: vi.fn((opts: { id: string; title?: string; component: string }) => {
				const panel = {
					id: opts.id,
					api: { id: opts.id, location: { type: 'grid' }, moveTo: vi.fn() },
				}
				panels.push(panel)
				return panel
			}),
			getPanel: vi.fn((id: string) => panels.find((p) => p.id === id)),
			getPopouts: vi.fn(() => [] as unknown[]),
			addFloatingGroup: vi.fn(),
			addPopoutGroup: vi.fn((_item: unknown, _opts: unknown) => Promise.resolve(true)),
			fromJSON: vi.fn((_json: unknown) => {
				listeners.layoutFromJSON?.forEach((cb) => cb({} as never))
			}),
			toJSON: vi.fn(() => ({ kind: 'dockview', views: panels.map((p) => p.id) })),
			dispose: vi.fn(),
			updateOptions: vi.fn(),
			onDidLayoutChange: vi.fn(on('layoutChange')),
			onDidLayoutFromJSON: vi.fn(on('layoutFromJSON')),
			onDidAddPanel: vi.fn(on('addPanel')),
			onDidRemovePanel: vi.fn(on('removePanel')),
			onDidAddGroup: vi.fn(on('addGroup')),
			onDidRemoveGroup: vi.fn(on('removeGroup')),
			onDidActivePanelChange: vi.fn(on('activePanel')),
			onDidActiveGroupChange: vi.fn(on('activeGroup')),
			onDidMovePanel: vi.fn(on('movePanel')),
			onWillDrop: vi.fn(on('willDrop')),
			onDidDrop: vi.fn(on('didDrop')),
			onWillDragPanel: vi.fn(on('willDragPanel')),
			onWillDragGroup: vi.fn(on('willDragGroup')),
			onWillMutateLayout: vi.fn(on('willMutate')),
			onDidMutateLayout: vi.fn(on('didMutate')),
			onWillShowOverlay: vi.fn(on('willShowOverlay')),
			onUnhandledDragOver: vi.fn(on('unhandledDragOver')),
			onDidAddPopoutGroup: vi.fn(on('addPopout')),
			onDidRemovePopoutGroup: vi.fn(on('removePopout')),
			onDidPopoutGroupSizeChange: vi.fn(on('popoutSize')),
			onDidPopoutGroupPositionChange: vi.fn(on('popoutPosition')),
			onDidOpenPopoutWindowFail: vi.fn(on('popoutFail')),
			onDidCreateTabGroup: vi.fn(on('createTabGroup')),
			onDidDestroyTabGroup: vi.fn(on('destroyTabGroup')),
			onDidAddPanelToTabGroup: vi.fn(on('addPanelToTabGroup')),
			onDidRemovePanelFromTabGroup: vi.fn(on('removePanelFromTabGroup')),
			onDidTabGroupChange: vi.fn(on('tabGroupChange')),
			onDidTabGroupCollapsedChange: vi.fn(on('tabGroupCollapsed')),
			onDidPanelPinnedChange: vi.fn(on('panelPinned')),
			onDidMaximizedGroupChange: vi.fn(on('maximizedGroup')),
			onDidChangeHistory: vi.fn(on('changeHistory')),
			onDidSnapFloat: vi.fn(on('snapFloat')),
			onDidSnapTogether: vi.fn(on('snapTogether')),
			emitLayoutChange: () => listeners.layoutChange?.forEach((cb) => cb({} as never)),
			emitActivePanel: (panel: unknown, group?: unknown) =>
				listeners.activePanel?.forEach((cb) => cb({ panel, group } as never)),
			emitActiveGroup: (group: unknown) =>
				listeners.activeGroup?.forEach((cb) => cb(group as never)),
			emitAddPanel: (panel: unknown) => listeners.addPanel?.forEach((cb) => cb(panel as never)),
		}
		return { api, panels, groups }
	}
	return { makeFakeDockview }
})

vi.mock('dockview', async (importOriginal) => {
	const actual = await importOriginal<typeof import('dockview')>()
	return {
		...actual,
		DockviewComponent: vi.fn(function (this: unknown) {
			const { api } = makeFakeDockview()
			;(this as { api: unknown }).api = api
			;(this as { updateOptions: unknown }).updateOptions = api.updateOptions
			;(this as { dispose: unknown }).dispose = api.dispose
			return this
		}),
	}
})

const { DockviewComponent } = await import('dockview')

async function flush(rounds = 3): Promise<void> {
	for (let i = 0; i < rounds; i++) await tick()
}

describe('Dockview component logic', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		cleanup()
	})

	function text(view: { container: HTMLElement }, testid: string): string {
		return view.container.querySelector(`[data-testid="${testid}"]`)?.textContent ?? ''
	}

	it('exposes a handle and seeds active/floating/popout on mount', async () => {
		let captured: { api: unknown; handle: unknown } | undefined
		const view = render(DockviewHost, {
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
		expect(text(view, 'active-panel')).toBe('none')
		expect(text(view, 'floating-count')).toBe('0')
		expect(text(view, 'popout-count')).toBe('0')
		view.unmount()
	})

	it('openPanel assigns sequential ids, resolves titles, and emits layout', async () => {
		let handle:
			| {
					openPanel: (key: string, opts?: Record<string, unknown>) => { id: string }
			  }
			| undefined
		let apiRef: { panels: Array<{ id: string }>; addPanel: ReturnType<typeof vi.fn> } | undefined
		const view = render(DockviewHost, {
			props: {
				widgets: { a: { component: { name: 'A' }, title: 'Widget Title' } },
				onReady: (e: { api: typeof apiRef; handle: typeof handle }) => {
					handle = e.handle
					apiRef = e.api
				},
			} as never,
		})
		await flush()

		const h1 = handle!.openPanel('a')
		const h2 = handle!.openPanel('a', { title: 'Explicit' })
		await flush()

		expect(h1.id).toBe('a-1')
		expect(h2.id).toBe('a-2')
		expect(apiRef!.panels.map((p) => p.id)).toEqual(['a-1', 'a-2'])
		expect(apiRef!.addPanel.mock.calls[0][0].title).toBe('Widget Title')
		expect(apiRef!.addPanel.mock.calls[1][0].title).toBe('Explicit')
		expect(text(view, 'layout-snapshot')).not.toBe('none')
		view.unmount()
	})

	it('throws for unknown widgets', async () => {
		let handle: { openPanel: (key: string) => unknown } | undefined
		const view = render(DockviewHost, {
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

	it('float / popout / dockAll throw when the target is unknown', async () => {
		let handle:
			| {
					float: (t: string) => unknown
					popout: (t: string) => unknown
					dockAll: () => unknown
			  }
			| undefined
		const view = render(DockviewHost, {
			props: {
				widgets: {},
				onReady: (e: { handle: typeof handle }) => {
					handle = e.handle
				},
			} as never,
		})
		await flush()

		expect(() => handle!.float('nope')).toThrow('unknown panel or group "nope"')
		expect(() => handle!.popout('nope')).toThrow('unknown panel or group "nope"')
		// dockAll with no grid groups is a no-op, not a throw — but it must not crash.
		expect(() => handle!.dockAll()).not.toThrow()
		view.unmount()
	})

	it('active panel/group events refresh bind:active', async () => {
		let captured:
			| {
					api: {
						emitActivePanel: (p: unknown) => void
						emitActiveGroup: (g: unknown) => void
						activePanel: unknown
						activeGroup: unknown
					}
			  }
			| undefined
		const view = render(DockviewHost, {
			props: {
				widgets: {},
				onReady: (e: typeof captured) => {
					captured = e
				},
			} as never,
		})
		await flush()
		expect(text(view, 'active-panel')).toBe('none')

		captured!.api.activePanel = { id: 'a-1' }
		captured!.api.emitActivePanel({ id: 'a-1' })
		await flush()
		expect(text(view, 'active-panel')).toBe('a-1')
		view.unmount()
	})

	it('options changes flow to updateOptions', async () => {
		const instances: Array<{ updateOptions: ReturnType<typeof vi.fn> }> = []
		vi.mocked(DockviewComponent).mockImplementation(function (this: unknown) {
			const { api } = makeFakeDockview()
			;(this as { api: unknown }).api = api
			const updateOptions = api.updateOptions
			;(this as { updateOptions: unknown }).updateOptions = updateOptions
			;(this as { dispose: unknown }).dispose = api.dispose
			instances.push({ updateOptions })
			return this
		})
		const view = render(DockviewHost, {
			props: {
				widgets: {},
				options: { theme: 'abyss' },
			} as never,
		})
		await flush()
		const updateOptions = instances.at(-1)!.updateOptions
		expect(updateOptions).not.toHaveBeenCalled()

		await view.rerender({ options: { theme: 'light' } } as never)
		await flush()
		expect(updateOptions).toHaveBeenCalled()
		view.unmount()
	})

	it('watermark renders when empty and hides after openPanel', async () => {
		let handle:
			| {
					openPanel: (key: string, opts?: Record<string, unknown>) => { id: string }
			  }
			| undefined
		const view = render(DockviewHost, {
			props: {
				widgets: { a: { component: { name: 'A' } } },
				watermark: Watermark,
				onReady: (e: { handle: typeof handle }) => {
					handle = e.handle
				},
			} as never,
		})
		await flush()

		expect(view.container.querySelector('[data-testid="watermark-overlay"]')).not.toBeNull()

		handle!.openPanel('a')
		await flush()
		expect(view.container.querySelector('[data-testid="watermark-overlay"]')).toBeNull()
		view.unmount()
	})

	it('external layout changes call fromJSON; emitted layout does not loop back', async () => {
		let captured:
			| {
					api: { emitLayoutChange: () => void; fromJSON: ReturnType<typeof vi.fn> }
			  }
			| undefined
		const view = render(DockviewHost, {
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

	it('DockviewComponent receives the Svelte factories', async () => {
		const view = render(DockviewHost, { props: { widgets: {} } as never })
		await flush()
		expect(vi.mocked(DockviewComponent)).toHaveBeenCalled()
		const opts = vi.mocked(DockviewComponent).mock.calls[0][1] as unknown as Record<string, unknown>
		expect(typeof opts.createComponent).toBe('function')
		expect(typeof opts.createTabComponent).toBe('function')
		view.unmount()
	})
})
