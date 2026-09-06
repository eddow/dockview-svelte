import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectUpdateParameters, flushEffects } from './effect-helpers.js'
import { WidgetRegistry } from './registry.js'

vi.mock('svelte', async (importOriginal) => {
	const actual = await importOriginal<typeof import('svelte')>()
	return {
		...actual,
		mount: vi.fn(() => ({})),
		unmount: vi.fn(),
	}
})

vi.mock('../components/DefaultTab.svelte', () => ({
	default: { name: 'DefaultTab' },
}))

const { mount, unmount } = await import('svelte')
const { createDockviewFactory } = await import('./factory.svelte.js')

function fakePanelApi(id: string) {
	const listeners: Record<string, Array<(e: never) => void>> = {}
	const on = (key: string) => (cb: (e: never) => void) => {
		listeners[key] ??= []
		listeners[key].push(cb)
		return { dispose: vi.fn() }
	}
	return {
		id,
		onDidTitleChange: vi.fn(on('title')),
		onDidActiveChange: vi.fn(on('active')),
		onDidFocusChange: vi.fn(on('focus')),
		onDidVisibilityChange: vi.fn(on('visibility')),
		onDidChangePinned: vi.fn(on('pinned')),
		onDidActiveGroupChange: vi.fn(on('groupActive')),
		updateParameters: vi.fn(),
		setActive: vi.fn(),
		setPinned: vi.fn(),
		emitTitle: (title: string) => listeners.title?.forEach((cb) => cb({ title } as never)),
	}
}

describe('createDockviewFactory', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('throws for unknown widgets', () => {
		const factory = createDockviewFactory(new WidgetRegistry())
		const renderer = factory.createComponent({ id: 'p1', name: 'missing' })
		expect(() =>
			renderer.init({ api: fakePanelApi('p1'), params: {}, title: 't' } as never)
		).toThrow('unknown widget "missing"')
	})

	it('shares one PanelState between tab and content', () => {
		const registry = new WidgetRegistry()
		const component = { name: 'Content' }
		const tab = { name: 'Tab' }
		registry.register('chat', { component, tab } as never)

		const factory = createDockviewFactory(registry)
		const api = fakePanelApi('p1')

		const content = factory.createComponent({ id: 'p1', name: 'chat' })
		content.init({ api, params: { a: 1 }, title: 'Chat' } as never)
		const contentState = factory.getState('p1')

		const tabRenderer = factory.createTabComponent({ id: 'p1', name: 'chat' })
		tabRenderer.init({ api, params: { a: 1 }, title: 'Chat' } as never)

		expect(contentState).toBeDefined()
		expect(factory.getState('p1')).toBe(contentState)
		// Both mounts received the same state object.
		expect(vi.mocked(mount).mock.calls[0][1].props).toEqual({ state: contentState })
		expect(vi.mocked(mount).mock.calls[1][1].props).toEqual({ state: contentState })
	})

	it('falls back to DefaultTab when the widget has no tab', async () => {
		const { default: DefaultTab } = await import('../components/DefaultTab.svelte')
		const registry = new WidgetRegistry()
		registry.register('plain', { component: { name: 'C' } } as never)

		const factory = createDockviewFactory(registry)
		const api = fakePanelApi('p1')
		const tabRenderer = factory.createTabComponent({ id: 'p1', name: 'plain' })
		tabRenderer.init({ api, params: {}, title: 'plain' } as never)

		expect(vi.mocked(mount).mock.calls[0][0]).toBe(DefaultTab)
	})

	it('mirrors title changes into state', () => {
		const registry = new WidgetRegistry()
		registry.register('chat', { component: { name: 'C' } } as never)

		const factory = createDockviewFactory(registry)
		const api = fakePanelApi('p1')
		const content = factory.createComponent({ id: 'p1', name: 'chat' })
		content.init({ api, params: {}, title: 'Chat' } as never)

		expect(factory.getState('p1')?.title).toBe('Chat')
		api.emitTitle('Renamed')
		expect(factory.getState('p1')?.title).toBe('Renamed')
	})

	it('merges dockview params updates into state', () => {
		const registry = new WidgetRegistry()
		registry.register('chat', { component: { name: 'C' } } as never)

		const factory = createDockviewFactory(registry)
		const api = fakePanelApi('p1')
		const content = factory.createComponent({ id: 'p1', name: 'chat' })
		content.init({ api, params: { a: 1, nested: { x: 1 } }, title: 't' } as never)
		content.update?.({ params: { nested: { y: 2 } } } as never)

		expect(factory.getState('p1')?.params).toEqual({ a: 1, nested: { x: 1, y: 2 } })
	})

	it('releases state only after both renderers dispose', () => {
		const registry = new WidgetRegistry()
		registry.register('chat', { component: { name: 'C' }, tab: { name: 'T' } } as never)

		const factory = createDockviewFactory(registry)
		const api = fakePanelApi('p1')
		const content = factory.createComponent({ id: 'p1', name: 'chat' })
		const tabRenderer = factory.createTabComponent({ id: 'p1', name: 'chat' })
		content.init({ api, params: {}, title: 't' } as never)
		tabRenderer.init({ api, params: {}, title: 't' } as never)

		content.dispose?.()
		expect(factory.getState('p1')).toBeDefined()
		expect(unmount).toHaveBeenCalledTimes(1)

		tabRenderer.dispose?.()
		expect(factory.getState('p1')).toBeUndefined()
		expect(unmount).toHaveBeenCalledTimes(2)
	})

	it('pushes widget params mutations to api.updateParameters', async () => {
		const registry = new WidgetRegistry()
		registry.register('chat', { component: { name: 'C' } } as never)

		const factory = createDockviewFactory(registry)
		const api = fakePanelApi('p1')
		const content = factory.createComponent({ id: 'p1', name: 'chat' })
		content.init({ api, params: { a: 1 }, title: 't' } as never)
		await flushEffects()

		factory.getState('p1')!.params = { a: 2 }
		await flushEffects()
		expectUpdateParameters(api, { a: 2 })
	})

	it('pushes widget activation to api.setActive', async () => {
		const registry = new WidgetRegistry()
		registry.register('chat', { component: { name: 'C' } } as never)

		const factory = createDockviewFactory(registry)
		const api = fakePanelApi('p1')
		const content = factory.createComponent({ id: 'p1', name: 'chat' })
		content.init({ api, params: {}, title: 't' } as never)
		await flushEffects()

		factory.getState('p1')!.active = true
		await flushEffects()
		expect(api.setActive).toHaveBeenCalled()
	})

	it('pushes widget pin toggles to api.setPinned', async () => {
		const registry = new WidgetRegistry()
		registry.register('chat', { component: { name: 'C' } } as never)

		const factory = createDockviewFactory(registry)
		const api = fakePanelApi('p1')
		const content = factory.createComponent({ id: 'p1', name: 'chat' })
		content.init({ api, params: {}, title: 't' } as never)
		await flushEffects()

		factory.getState('p1')!.pinned = true
		await flushEffects()
		expect(api.setPinned).toHaveBeenCalledWith(true)
	})

	it('does not re-push dockview-origin params updates (loop-break)', async () => {
		const registry = new WidgetRegistry()
		registry.register('chat', { component: { name: 'C' } } as never)

		const factory = createDockviewFactory(registry)
		const api = fakePanelApi('p1')
		const content = factory.createComponent({ id: 'p1', name: 'chat' })
		content.init({ api, params: { a: 1 }, title: 't' } as never)
		await flushEffects()
		expect(api.updateParameters).not.toHaveBeenCalled()

		// dockview → widget: `update()` merges and re-baselines `lastParams`,
		// so the widget → dockview effect must stay silent.
		content.update?.({ params: { a: 2 } } as never)
		await flushEffects()
		expect(api.updateParameters).not.toHaveBeenCalled()
		expect(factory.getState('p1')?.params).toEqual({ a: 2 })
	})

	it('coalesces rapid layout() calls into one size write', async () => {
		const registry = new WidgetRegistry()
		registry.register('chat', { component: { name: 'C' } } as never)

		const factory = createDockviewFactory(registry)
		const api = fakePanelApi('p1')
		const content = factory.createComponent({ id: 'p1', name: 'chat' })
		content.init({ api, params: {}, title: 't' } as never)

		// Queue the rAF callbacks instead of running them inline, then flush.
		const queue: FrameRequestCallback[] = []
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			queue.push(cb)
			return queue.length
		})
		try {
			content.layout?.(10, 10)
			content.layout?.(20, 20)
			content.layout?.(30, 30)
			expect(factory.getState('p1')?.size).toEqual({ width: 0, height: 0 })
			for (const cb of queue) cb(0)
			expect(factory.getState('p1')?.size).toEqual({ width: 30, height: 30 })
		} finally {
			vi.unstubAllGlobals()
		}
	})
})
