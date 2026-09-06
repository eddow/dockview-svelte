import { render } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DvWidget from '../components/DvWidget.svelte'
import { DOCKVIEW_CONTEXT_KEY } from './context.js'

/** A fake parent-layout context that records registrations/unregistrations. */
function makeCtx() {
	const registrations: Array<[string, Record<string, unknown>]> = []
	const unregistrations: string[] = []
	return {
		ctx: {
			kind: 'dockview' as 'dockview' | 'splitview' | 'gridview' | 'paneview',
			api: undefined,
			registerWidget: (key: string, def: Record<string, unknown>) => {
				registrations.push([key, def])
			},
			unregisterWidget: (key: string) => {
				unregistrations.push(key)
			},
		},
		registrations,
		unregistrations,
	}
}

/** A fake compiled snippet: `(anchor, ...args) => void`. */
function fakeSnippet() {
	return vi.fn()
}

function renderWidget(props: Record<string, unknown>, ctx: ReturnType<typeof makeCtx>) {
	return render(DvWidget, {
		props: {
			children: fakeSnippet(),
			...props,
		} as never,
		context: new Map([[DOCKVIEW_CONTEXT_KEY, ctx.ctx]]),
	})
}

describe('DvWidget component', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('registers the widget with a function component + title on mount', () => {
		const fake = makeCtx()
		renderWidget({ name: 'chat', title: 'Chat' }, fake)

		expect(fake.registrations).toHaveLength(1)
		const [key, def] = fake.registrations[0]
		expect(key).toBe('chat')
		expect(typeof def.component).toBe('function')
		expect(def.title).toBe('Chat')
		expect(def.tab).toBeUndefined()
		expect(def.header).toBeUndefined()
	})

	it('includes tab when provided', () => {
		const fake = makeCtx()
		renderWidget({ name: 'chat', tab: fakeSnippet() }, fake)

		const [, def] = fake.registrations[0]
		expect(typeof def.tab).toBe('function')
	})

	it('unregisters the current name on unmount', () => {
		const fake = makeCtx()
		const view = renderWidget({ name: 'chat' }, fake)
		expect(fake.unregistrations).toHaveLength(0)

		view.unmount()
		expect(fake.unregistrations).toEqual(['chat'])
	})

	it('unregisters the old name when the name prop changes', () => {
		const fake = makeCtx()
		const view = renderWidget({ name: 'chat' }, fake)

		view.rerender({ name: 'chat2', children: fakeSnippet() } as never)

		// The effect cleanup runs before re-register: old key unregistered first.
		expect(fake.unregistrations).toEqual(['chat'])
		expect(fake.registrations.map(([k]) => k)).toEqual(['chat', 'chat2'])
	})

	it('drops tab/title that are inapplicable to the layout', () => {
		const fake = makeCtx()
		fake.ctx.kind = 'splitview'
		renderWidget({ name: 'a', tab: fakeSnippet(), title: 'X' }, fake)

		// `tab` and `title` don't apply to Splitview, so they never reach the registry.
		expect(fake.registrations).toHaveLength(1)
		const [, def] = fake.registrations[0]
		expect(typeof def.component).toBe('function')
		expect(def.tab).toBeUndefined()
		expect(def.title).toBeUndefined()
	})

	it('keeps header only in a paneview layout', () => {
		const fake = makeCtx()
		fake.ctx.kind = 'paneview'
		renderWidget({ name: 'a', header: fakeSnippet() }, fake)

		const [, def] = fake.registrations[0]
		expect(typeof def.header).toBe('function')
	})

	it('keeps tab + title in a dockview layout', () => {
		const fake = makeCtx()
		renderWidget({ name: 'a', tab: fakeSnippet(), title: 'A' }, fake)

		const [, def] = fake.registrations[0]
		expect(typeof def.tab).toBe('function')
		expect(def.title).toBe('A')
	})
})
