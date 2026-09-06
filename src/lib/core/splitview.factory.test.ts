import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOCKVIEW_CONTEXT_KEY } from './context.js'
import { SplitviewWidgetRegistry } from './registry.js'

// The fake splitview panel api is hoisted so the `dockview` mock can create it.
const { makeFakeApi } = vi.hoisted(() => {
	const makeFakeApi = (id: string) => {
		const listeners: Record<string, Array<(e: never) => void>> = {}
		const on = (key: string) => (cb: (e: never) => void) => {
			;(listeners[key] ??= []).push(cb)
			return { dispose: vi.fn() }
		}
		return {
			id,
			isVisible: true,
			isActive: false,
			isFocused: false,
			onDidActiveChange: vi.fn(on('active')),
			onDidFocusChange: vi.fn(on('focus')),
			onDidVisibilityChange: vi.fn(on('visibility')),
			onDidDimensionsChange: vi.fn(on('dimensions')),
			updateParameters: vi.fn(),
			setActive: vi.fn(),
			emitActive: (v: boolean) => listeners.active?.forEach((cb) => cb({ isActive: v } as never)),
			emitFocus: (v: boolean) => listeners.focus?.forEach((cb) => cb({ isFocused: v } as never)),
			emitVisibility: (v: boolean) =>
				listeners.visibility?.forEach((cb) => cb({ isVisible: v } as never)),
			emitDimensions: (width: number, height: number) =>
				listeners.dimensions?.forEach((cb) => cb({ width, height } as never)),
		}
	}
	return { makeFakeApi }
})

vi.mock('svelte', () => ({
	mount: vi.fn(() => ({})),
	unmount: vi.fn(),
}))

// Replace the abstract `SplitviewPanel` with a minimal subclassable stub whose
// constructor exposes `this.api` / `this.element` like the real BasePanelView.
vi.mock('dockview', async (importOriginal) => {
	const actual = await importOriginal<typeof import('dockview')>()
	return {
		...actual,
		SplitviewPanel: class {
			id: string
			api = makeFakeApi('unset')
			element = document.createElement('div')
			constructor(id: string) {
				this.id = id
				this.api = makeFakeApi(id)
			}
			init(_params: unknown) {}
			update(_event: unknown) {}
			getComponent() {
				return { update() {}, dispose() {} }
			}
		},
	}
})

const { mount, unmount } = await import('svelte')
const { createSplitviewFactory } = await import('./splitview.svelte.js')

type FakeApi = ReturnType<typeof makeFakeApi>

/** `createComponent` returns the real `SplitviewPanel` type; unwrap to the stub's shape. */
function apiOf(panel: { api: unknown }): FakeApi {
	return panel.api as FakeApi
}

describe('createSplitviewFactory', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Run rAF callbacks synchronously so size writes are deterministic.
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			cb(0)
			return 1
		})
		vi.stubGlobal('cancelAnimationFrame', vi.fn())
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('throws for unknown widgets', () => {
		const factory = createSplitviewFactory(new SplitviewWidgetRegistry())
		expect(() => factory.createComponent({ id: 'p1', name: 'missing' })).toThrow(
			'unknown widget "missing"'
		)
	})

	it('mounts the widget and exposes its state via getState', () => {
		const registry = new SplitviewWidgetRegistry()
		const component = { name: 'Pane' }
		registry.register('a', { component } as never)

		const factory = createSplitviewFactory(registry)
		const panel = factory.createComponent({ id: 'p1', name: 'a' })
		panel.init({ params: { text: 'hi' } } as never)

		const state = factory.getState('p1')
		expect(state).toBeDefined()
		expect(state?.params).toEqual({ text: 'hi' })

		// Mounted with the shared state as the single prop.
		expect(vi.mocked(mount).mock.calls[0][0]).toBe(component)
		expect(vi.mocked(mount).mock.calls[0][1].props).toEqual({ state })
	})

	it('mirrors active / focus / visible flags into state', () => {
		const registry = new SplitviewWidgetRegistry()
		registry.register('a', { component: { name: 'Pane' } } as never)

		const factory = createSplitviewFactory(registry)
		const panel = factory.createComponent({ id: 'p1', name: 'a' })
		panel.init({ params: {} } as never)
		const api = apiOf(panel)

		api.emitActive(true)
		api.emitFocus(true)
		api.emitVisibility(false)

		const state = factory.getState('p1')
		expect(state?.active).toBe(true)
		expect(state?.focused).toBe(true)
		expect(state?.visible).toBe(false)
	})

	it('writes size from dimensions (rAF-throttled)', () => {
		const registry = new SplitviewWidgetRegistry()
		registry.register('a', { component: { name: 'Pane' } } as never)

		const factory = createSplitviewFactory(registry)
		const panel = factory.createComponent({ id: 'p1', name: 'a' })
		panel.init({ params: {} } as never)
		const api = apiOf(panel)

		api.emitDimensions(100, 200)

		expect(factory.getState('p1')?.size).toEqual({ width: 100, height: 200 })
	})

	it('merges dockview params updates into state', () => {
		const registry = new SplitviewWidgetRegistry()
		registry.register('a', { component: { name: 'Pane' } } as never)

		const factory = createSplitviewFactory(registry)
		const panel = factory.createComponent({ id: 'p1', name: 'a' })
		panel.init({ params: { a: 1, nested: { x: 1 } } } as never)
		panel.update({ params: { nested: { y: 2 } } } as never)

		expect(factory.getState('p1')?.params).toEqual({ a: 1, nested: { x: 1, y: 2 } })
	})

	it('releases state and unmounts on dispose', () => {
		const registry = new SplitviewWidgetRegistry()
		registry.register('a', { component: { name: 'Pane' } } as never)

		const factory = createSplitviewFactory(registry)
		const panel = factory.createComponent({ id: 'p1', name: 'a' })
		panel.init({ params: {} } as never)

		expect(factory.getState('p1')).toBeDefined()
		// `getComponent()` is protected on the real `SplitviewPanel`; reach it
		// through the stub's public shape (this is the BasePanelView dispose path).
		;(panel as unknown as { getComponent(): { dispose(): void } }).getComponent().dispose()
		expect(factory.getState('p1')).toBeUndefined()
		expect(unmount).toHaveBeenCalledTimes(1)
	})

	it('forwards the splitview context to the mount', () => {
		const registry = new SplitviewWidgetRegistry()
		registry.register('a', { component: { name: 'Pane' } } as never)

		const context = { api: undefined, registerWidget: vi.fn(), unregisterWidget: vi.fn(), kind: 'splitview' as const }
		const factory = createSplitviewFactory(registry, context)
		const panel = factory.createComponent({ id: 'p1', name: 'a' })
		panel.init({ params: {} } as never)

		const opts = vi.mocked(mount).mock.calls[0][1] as {
			context?: Map<unknown, unknown>
		}
		expect(opts.context?.get(DOCKVIEW_CONTEXT_KEY)).toBe(context)
	})
})
