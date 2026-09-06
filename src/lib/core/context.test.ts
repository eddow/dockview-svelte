import { describe, expect, it, vi } from 'vitest'
import {
	DOCKVIEW_CONTEXT_KEY,
	type DockviewContext,
	type GridviewContext,
	type PaneviewContext,
	type SplitviewContext,
} from './context.js'
import {
	GridviewWidgetRegistry,
	PaneviewWidgetRegistry,
	SplitviewWidgetRegistry,
	WidgetRegistry,
} from './registry.js'

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

describe('factory context forwarding', () => {
	it('forwards the dockview context to content and tab mounts', () => {
		const registry = new WidgetRegistry()
		registry.register('chat', { component: { name: 'C' }, tab: { name: 'T' } } as never)

		const context: DockviewContext = {
			api: undefined,
			registerWidget: vi.fn(),
			unregisterWidget: vi.fn(),
			kind: 'dockview',
		}
		const factory = createDockviewFactory(registry, context)
		const api = fakePanelApi('p1')

		const content = factory.createComponent({ id: 'p1', name: 'chat' })
		content.init({ api, params: {}, title: 'Chat' } as never)
		const tabRenderer = factory.createTabComponent({ id: 'p1', name: 'chat' })
		tabRenderer.init({ api, params: {}, title: 'Chat' } as never)

		expect(vi.mocked(mount)).toHaveBeenCalledTimes(2)
		for (const call of vi.mocked(mount).mock.calls) {
			const opts = call[1] as { context?: Map<unknown, unknown> }
			expect(opts.context?.get(DOCKVIEW_CONTEXT_KEY)).toBe(context)
		}
	})

	it('omits the context option when no context is provided', () => {
		const registry = new WidgetRegistry()
		registry.register('chat', { component: { name: 'C' } } as never)

		const factory = createDockviewFactory(registry)
		const api = fakePanelApi('p1')
		const content = factory.createComponent({ id: 'p1', name: 'chat' })
		content.init({ api, params: {}, title: 'Chat' } as never)

		const opts = vi.mocked(mount).mock.calls[0][1] as { context?: Map<unknown, unknown> }
		expect(opts.context).toBeUndefined()
	})

	it('a widget can register a new type via the context at runtime', () => {
		const registry = new WidgetRegistry()
		const late = { component: { name: 'Late' } } as never

		// The context object handed to widgets exposes a live `registerWidget`
		// bound to the same registry the factory consults.
		const context: DockviewContext = {
			api: undefined,
			registerWidget: (key, def) => registry.register(key, def),
			unregisterWidget: (key) => registry.unregister(key),
			kind: 'dockview',
		}
		const ctx: DockviewContext | undefined = new Map([[DOCKVIEW_CONTEXT_KEY, context]]).get(
			DOCKVIEW_CONTEXT_KEY
		)
		ctx!.registerWidget('late', late)

		expect(registry.get('late')).toBe(late)

		// The newly registered type is immediately usable by the factory.
		const factory = createDockviewFactory(registry, context)
		const api = fakePanelApi('p1')
		const content = factory.createComponent({ id: 'p1', name: 'late' })
		expect(() => content.init({ api, params: {}, title: 'Late' } as never)).not.toThrow()
		expect(factory.getState('p1')).toBeDefined()
	})

	it('unregisters a type via the context at runtime', () => {
		const registry = new WidgetRegistry()
		registry.register('late', { component: { name: 'Late' } } as never)
		const context: DockviewContext = {
			api: undefined,
			registerWidget: (key, def) => registry.register(key, def),
			unregisterWidget: (key) => registry.unregister(key),
			kind: 'dockview',
		}
		const ctx = new Map([[DOCKVIEW_CONTEXT_KEY, context]]).get(DOCKVIEW_CONTEXT_KEY)
		ctx!.unregisterWidget('late')
		expect(registry.has('late')).toBe(false)
	})
})

describe('runtime register/unregister paths for splitview / gridview / paneview', () => {
	it('splitview: register then unregister round-trips through the live registry', async () => {
		const { createSplitviewFactory } = await import('./splitview.svelte.js')
		const registry = new SplitviewWidgetRegistry()
		const late = { component: { name: 'Late' } } as never
		const context: SplitviewContext = {
			api: undefined,
			registerWidget: (key, def) => registry.register(key, def),
			unregisterWidget: (key) => registry.unregister(key),
			kind: 'splitview',
		}
		const ctx = new Map([[DOCKVIEW_CONTEXT_KEY, context]]).get(DOCKVIEW_CONTEXT_KEY)
		ctx!.registerWidget('late', late)
		expect(registry.get('late')).toBe(late)

		const factory = createSplitviewFactory(registry, context)
		const panel = factory.createComponent({ id: 'p1', name: 'late' })
		expect(() => panel.init({ params: {}, title: 'Late' } as never)).not.toThrow()
		expect(factory.getState('p1')).toBeDefined()

		ctx!.unregisterWidget('late')
		expect(registry.has('late')).toBe(false)
	})

	it('gridview: register then unregister round-trips through the live registry', async () => {
		const { createGridviewFactory } = await import('./gridview.svelte.js')
		const registry = new GridviewWidgetRegistry()
		const late = { component: { name: 'Cell' } } as never
		const context: GridviewContext = {
			api: undefined,
			registerWidget: (key, def) => registry.register(key, def),
			unregisterWidget: (key) => registry.unregister(key),
			kind: 'gridview',
		}
		const ctx = new Map([[DOCKVIEW_CONTEXT_KEY, context]]).get(DOCKVIEW_CONTEXT_KEY)
		ctx!.registerWidget('late', late)
		expect(registry.get('late')).toBe(late)

		const factory = createGridviewFactory(registry, context)
		const panel = factory.createComponent({ id: 'p1', name: 'late' })
		expect(() => panel.init({ params: {} } as never)).not.toThrow()
		expect(factory.getState('p1')).toBeDefined()

		ctx!.unregisterWidget('late')
		expect(registry.has('late')).toBe(false)
	})

	it('paneview: register then unregister round-trips through the live registry', async () => {
		const { createPaneviewFactory } = await import('./paneview.svelte.js')
		const { makePaneviewFakeApi } = await import('./paneview-test-helpers.js')
		const registry = new PaneviewWidgetRegistry()
		const late = { component: { name: 'Body' } } as never
		const context: PaneviewContext = {
			api: undefined,
			registerWidget: (key, def) => registry.register(key, def),
			unregisterWidget: (key) => registry.unregister(key),
			kind: 'paneview',
		}
		const ctx = new Map([[DOCKVIEW_CONTEXT_KEY, context]]).get(DOCKVIEW_CONTEXT_KEY)
		ctx!.registerWidget('late', late)
		expect(registry.get('late')).toBe(late)

		const factory = createPaneviewFactory(registry, context)
		const body = factory.createComponent({ id: 'p1', name: 'late' })
		expect(() =>
			body.init({ api: makePaneviewFakeApi('p1'), params: {}, title: 'Late' } as never)
		).not.toThrow()
		expect(factory.getState('p1')).toBeDefined()

		ctx!.unregisterWidget('late')
		expect(registry.has('late')).toBe(false)
	})
})
