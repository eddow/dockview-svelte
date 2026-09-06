import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOCKVIEW_CONTEXT_KEY } from './context.js'
import { expectUpdateParameters, flushEffects } from './effect-helpers.js'
import { PaneviewWidgetRegistry } from './registry.js'

// The fake paneview panel api is hoisted so the part stubs can create it.
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
			isExpanded: true,
			onDidActiveChange: vi.fn(on('active')),
			onDidFocusChange: vi.fn(on('focus')),
			onDidVisibilityChange: vi.fn(on('visibility')),
			onDidDimensionsChange: vi.fn(on('dimensions')),
			onDidExpansionChange: vi.fn(on('expansion')),
			updateParameters: vi.fn(),
			setActive: vi.fn(),
			setExpanded: vi.fn(),
			emitActive: (v: boolean) => listeners.active?.forEach((cb) => cb({ isActive: v } as never)),
			emitFocus: (v: boolean) => listeners.focus?.forEach((cb) => cb({ isFocused: v } as never)),
			emitVisibility: (v: boolean) =>
				listeners.visibility?.forEach((cb) => cb({ isVisible: v } as never)),
			emitDimensions: (width: number, height: number) =>
				listeners.dimensions?.forEach((cb) => cb({ width, height } as never)),
			emitExpansion: (v: boolean) =>
				listeners.expansion?.forEach((cb) => cb({ isExpanded: v } as never)),
		}
	}
	return { makeFakeApi }
})

vi.mock('svelte', async (importOriginal) => {
	const actual = await importOriginal<typeof import('svelte')>()
	return {
		...actual,
		mount: vi.fn(() => ({})),
		unmount: vi.fn(),
	}
})

const { mount, unmount } = await import('svelte')
const { createPaneviewFactory } = await import('./paneview.svelte.js')

function fakeParams(id: string, params: Record<string, unknown> = {}, title = 'T') {
	return { api: makeFakeApi(id), params, title } as never
}

describe('createPaneviewFactory', () => {
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
		const factory = createPaneviewFactory(new PaneviewWidgetRegistry())
		expect(() => factory.createComponent({ id: 'p1', name: 'missing' })).toThrow(
			'unknown widget "missing"'
		)
		expect(() => factory.createHeaderComponent({ id: 'p1', name: 'missing' })).toThrow(
			'unknown widget "missing"'
		)
	})

	it('mounts body and header against one shared state', () => {
		const registry = new PaneviewWidgetRegistry()
		const component = { name: 'Body' }
		const header = { name: 'Header' }
		registry.register('a', { component, header } as never)

		const factory = createPaneviewFactory(registry)
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		body.init(fakeParams('p1', { text: 'hi' }))
		const headerPart = factory.createHeaderComponent({ id: 'p1', name: 'a' })!
		headerPart.init(fakeParams('p1', { text: 'hi' }))

		const state = factory.getState('p1')
		expect(state).toBeDefined()
		expect(state?.params).toEqual({ text: 'hi' })
		expect(state?.title).toBe('T')

		// Both mounts receive the same state object by reference.
		expect(vi.mocked(mount)).toHaveBeenCalledTimes(2)
		expect(vi.mocked(mount).mock.calls[0][0]).toBe(component)
		expect(vi.mocked(mount).mock.calls[1][0]).toBe(header)
		const bodyState = (
			vi.mocked(mount).mock.calls[0][1] as unknown as { props: { state: unknown } }
		).props.state
		const headerState = (
			vi.mocked(mount).mock.calls[1][1] as unknown as { props: { state: unknown } }
		).props.state
		expect(bodyState).toBe(state)
		expect(headerState).toBe(state)
	})

	it('returns undefined header when the widget defines none', () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', { component: { name: 'Body' } } as never)

		const factory = createPaneviewFactory(registry)
		expect(factory.createHeaderComponent({ id: 'p1', name: 'a' })).toBeUndefined()
	})

	it('mirrors active / focus / visible / expanded flags into state', () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', { component: { name: 'Body' } } as never)

		const factory = createPaneviewFactory(registry)
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		const api = makeFakeApi('p1')
		body.init({ api, params: {}, title: 'T' } as never)

		api.emitActive(true)
		api.emitFocus(true)
		api.emitVisibility(false)
		api.emitExpansion(false)

		const state = factory.getState('p1')
		expect(state?.active).toBe(true)
		expect(state?.focused).toBe(true)
		expect(state?.visible).toBe(false)
		expect(state?.expanded).toBe(false)
	})

	it('writes size from dimensions (rAF-throttled)', () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', { component: { name: 'Body' } } as never)

		const factory = createPaneviewFactory(registry)
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		const api = makeFakeApi('p1')
		body.init({ api, params: {}, title: 'T' } as never)

		api.emitDimensions(100, 200)

		expect(factory.getState('p1')?.size).toEqual({ width: 100, height: 200 })
	})

	it('merges dockview params updates into state (body only)', () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', {
			component: { name: 'Body' },
			header: { name: 'Header' },
		} as never)

		const factory = createPaneviewFactory(registry)
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		body.init(fakeParams('p1', { a: 1, nested: { x: 1 } }))
		body.update({ params: { nested: { y: 2 } } } as never)

		expect(factory.getState('p1')?.params).toEqual({ a: 1, nested: { x: 1, y: 2 } })

		const headerPart = factory.createHeaderComponent({ id: 'p1', name: 'a' })!
		headerPart.init(fakeParams('p1'))
		// Header updates are no-ops — the shared state is untouched.
		headerPart.update({ params: { z: 9 } } as never)
		expect(factory.getState('p1')?.params).toEqual({ a: 1, nested: { x: 1, y: 2 } })
	})

	it('releases state only after both body and header dispose', () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', {
			component: { name: 'Body' },
			header: { name: 'Header' },
		} as never)

		const factory = createPaneviewFactory(registry)
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		body.init(fakeParams('p1'))
		const headerPart = factory.createHeaderComponent({ id: 'p1', name: 'a' })!
		headerPart.init(fakeParams('p1'))

		body.dispose()
		expect(factory.getState('p1')).toBeDefined()
		headerPart.dispose()
		expect(factory.getState('p1')).toBeUndefined()
		expect(unmount).toHaveBeenCalledTimes(2)
	})

	it('forwards the paneview context to both mounts', () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', {
			component: { name: 'Body' },
			header: { name: 'Header' },
		} as never)

		const context = {
			api: undefined,
			registerWidget: vi.fn(),
			unregisterWidget: vi.fn(),
			kind: 'paneview' as const,
		}
		const factory = createPaneviewFactory(registry, context)
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		body.init(fakeParams('p1'))
		const headerPart = factory.createHeaderComponent({ id: 'p1', name: 'a' })!
		headerPart.init(fakeParams('p1'))

		expect(vi.mocked(mount)).toHaveBeenCalledTimes(2)
		for (const call of vi.mocked(mount).mock.calls) {
			const opts = call[1] as { context?: Map<unknown, unknown> }
			expect(opts.context?.get(DOCKVIEW_CONTEXT_KEY)).toBe(context)
		}
	})

	it('pushes widget params mutations to api.updateParameters', async () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', { component: { name: 'Body' } } as never)

		const factory = createPaneviewFactory(registry)
		const api = makeFakeApi('p1')
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		body.init({ api, params: { a: 1 }, title: 'T' } as never)
		await flushEffects()

		factory.getState('p1')!.params = { a: 2 }
		await flushEffects()
		expectUpdateParameters(api, { a: 2 })
	})

	it('pushes widget activation to api.setActive', async () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', { component: { name: 'Body' } } as never)

		const factory = createPaneviewFactory(registry)
		const api = makeFakeApi('p1')
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		body.init({ api, params: {}, title: 'T' } as never)
		await flushEffects()

		factory.getState('p1')!.active = true
		await flushEffects()
		expect(api.setActive).toHaveBeenCalled()
	})

	it('pushes widget expand toggles to api.setExpanded', async () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', { component: { name: 'Body' } } as never)

		const factory = createPaneviewFactory(registry)
		const api = makeFakeApi('p1')
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		body.init({ api, params: {}, title: 'T' } as never)
		await flushEffects()

		factory.getState('p1')!.expanded = false
		await flushEffects()
		expect(api.setExpanded).toHaveBeenCalledWith(false)
	})

	it('does not re-push dockview-origin params updates (loop-break)', async () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', { component: { name: 'Body' } } as never)

		const factory = createPaneviewFactory(registry)
		const api = makeFakeApi('p1')
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		body.init({ api, params: { a: 1 }, title: 'T' } as never)
		await flushEffects()
		expect(api.updateParameters).not.toHaveBeenCalled()

		body.update({ params: { a: 2 } } as never)
		await flushEffects()
		expect(api.updateParameters).not.toHaveBeenCalled()
		expect(factory.getState('p1')?.params).toEqual({ a: 2 })
	})

	it('coalesces rapid dimensions events into one size write', async () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', { component: { name: 'Body' } } as never)

		const factory = createPaneviewFactory(registry)
		const api = makeFakeApi('p1')
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		body.init({ api, params: {}, title: 'T' } as never)

		const queue: FrameRequestCallback[] = []
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			queue.push(cb)
			return queue.length
		})
		try {
			api.emitDimensions(10, 10)
			api.emitDimensions(20, 20)
			api.emitDimensions(30, 30)
			expect(factory.getState('p1')?.size).toEqual({ width: 0, height: 0 })
			for (const cb of queue) cb(0)
			expect(factory.getState('p1')?.size).toEqual({ width: 30, height: 30 })
		} finally {
			vi.unstubAllGlobals()
		}
	})
})
