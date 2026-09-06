import { describe, expect, it, vi } from 'vitest'
import { DOCKVIEW_CONTEXT_KEY } from './context.js'
import { WidgetRegistry } from './registry.js'

vi.mock('svelte', async (importOriginal) => {
	const actual = await importOriginal<typeof import('svelte')>()
	return {
		...actual,
		mount: vi.fn(() => ({})),
		unmount: vi.fn(),
		getContext: vi.fn(),
		onDestroy: vi.fn(),
	}
})

vi.mock('../components/DefaultTab.svelte', () => ({
	default: { name: 'DefaultTab' },
}))

const { mount } = await import('svelte')
const { createDockviewFactory } = await import('./factory.svelte.js')

function fakePanelApi(id: string) {
	const on = () => () => ({ dispose: vi.fn() })
	return {
		id,
		isVisible: true,
		isActive: false,
		isFocused: false,
		isPinned: false,
		isGroupActive: false,
		onDidTitleChange: vi.fn(on()),
		onDidActiveChange: vi.fn(on()),
		onDidFocusChange: vi.fn(on()),
		onDidVisibilityChange: vi.fn(on()),
		onDidChangePinned: vi.fn(on()),
		onDidActiveGroupChange: vi.fn(on()),
		updateParameters: vi.fn(),
		setActive: vi.fn(),
		setPinned: vi.fn(),
	}
}

describe('DvWidget wrapper components', () => {
	it('a snippet wrapper mounts with the shared state as its single prop', async () => {
		const registry = new WidgetRegistry()
		// Simulate what `<DvWidget>` registers: a plain-function component
		// closing over the `children` snippet.
		const seen: Array<{ state: unknown }> = []
		const wrapper = (_anchor: Node, props: { state: unknown }) => {
			seen.push({ state: props.state })
		}
		registry.register('chat', { component: wrapper } as never)

		const factory = createDockviewFactory(registry)
		const api = fakePanelApi('p1')
		const content = factory.createComponent({ id: 'p1', name: 'chat' })
		content.init({ api, params: { text: 'hi' }, title: 'Chat' } as never)

		const state = factory.getState('p1')
		expect(state).toBeDefined()
		expect(vi.mocked(mount).mock.calls[0][0]).toBe(wrapper)
		expect(vi.mocked(mount).mock.calls[0][1].props).toEqual({ state })
		expect(seen).toHaveLength(0)
	})

	it('unregister removes the widget so openPanel throws unknown widget', () => {
		const registry = new WidgetRegistry()
		registry.register('chat', { component: { name: 'C' } } as never)
		expect(registry.has('chat')).toBe(true)
		registry.unregister('chat')
		expect(registry.has('chat')).toBe(false)

		const factory = createDockviewFactory(registry)
		const content = factory.createComponent({ id: 'p1', name: 'chat' })
		expect(() =>
			content.init({ api: fakePanelApi('p1'), params: {}, title: 't' } as never)
		).toThrow('unknown widget "chat"')
	})

	it('context exposes unregisterWidget bound to the registry', () => {
		const registry = new WidgetRegistry()
		registry.register('chat', { component: { name: 'C' } } as never)
		const context = {
			api: undefined,
			registerWidget: (key: string, def: never) => registry.register(key, def as never),
			unregisterWidget: (key: string) => registry.unregister(key),
		}
		const ctx = new Map([[DOCKVIEW_CONTEXT_KEY, context]]).get(DOCKVIEW_CONTEXT_KEY)
		ctx!.unregisterWidget('chat')
		expect(registry.has('chat')).toBe(false)
	})
})
