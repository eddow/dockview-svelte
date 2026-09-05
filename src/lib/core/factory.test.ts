import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WidgetRegistry } from './registry.js'

vi.mock('svelte', () => ({
	mount: vi.fn(() => ({})),
	unmount: vi.fn(),
}))

vi.mock('../components/DefaultTab.svelte', () => ({
	default: { name: 'DefaultTab' },
}))

const { mount, unmount } = await import('svelte')
const { createDockviewFactory } = await import('./factory.svelte.js')

function fakePanelApi(id: string) {
	const listeners: Record<string, Array<(e: never) => void>> = {}
	return {
		id,
		onDidTitleChange: vi.fn((cb: (e: never) => void) => {
			listeners.title ??= []
			listeners.title.push(cb)
			return { dispose: vi.fn() }
		}),
		updateParameters: vi.fn(),
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
})
