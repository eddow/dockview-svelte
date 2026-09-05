import { describe, expect, it } from 'vitest'
import {
	defineGridviewWidgets,
	definePaneviewWidgets,
	GridviewWidgetRegistry,
	PaneviewWidgetRegistry,
} from './registry.js'

const widgetA = { component: {} } as never
const widgetB = { component: {} } as never

describe('GridviewWidgetRegistry', () => {
	it('registers and retrieves definitions', () => {
		const registry = new GridviewWidgetRegistry()
		expect(registry.has('a')).toBe(false)
		registry.register('a', widgetA)
		expect(registry.has('a')).toBe(true)
		expect(registry.get('a')).toBe(widgetA)
	})

	it('replaces existing definitions', () => {
		const registry = new GridviewWidgetRegistry()
		registry.register('a', widgetA)
		registry.register('a', widgetB)
		expect(registry.get('a')).toBe(widgetB)
	})

	it('seeds from a widgets object', () => {
		const registry = new GridviewWidgetRegistry()
		registry.seed({ a: widgetA, b: widgetB })
		expect(registry.get('a')).toBe(widgetA)
		expect(registry.get('b')).toBe(widgetB)
	})

	it('returns undefined for unknown keys', () => {
		const registry = new GridviewWidgetRegistry()
		expect(registry.get('missing')).toBeUndefined()
	})
})

describe('defineGridviewWidgets', () => {
	it('returns the same object preserving keys', () => {
		const widgets = defineGridviewWidgets({ a: widgetA, b: widgetB })
		expect(widgets.a).toBe(widgetA)
		expect(widgets.b).toBe(widgetB)
	})
})

describe('PaneviewWidgetRegistry', () => {
	it('registers and retrieves definitions', () => {
		const registry = new PaneviewWidgetRegistry()
		expect(registry.has('a')).toBe(false)
		registry.register('a', widgetA)
		expect(registry.has('a')).toBe(true)
		expect(registry.get('a')).toBe(widgetA)
	})

	it('replaces existing definitions', () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', widgetA)
		registry.register('a', widgetB)
		expect(registry.get('a')).toBe(widgetB)
	})

	it('seeds from a widgets object', () => {
		const registry = new PaneviewWidgetRegistry()
		registry.seed({ a: widgetA, b: widgetB })
		expect(registry.get('a')).toBe(widgetA)
		expect(registry.get('b')).toBe(widgetB)
	})

	it('returns undefined for unknown keys', () => {
		const registry = new PaneviewWidgetRegistry()
		expect(registry.get('missing')).toBeUndefined()
	})
})

describe('definePaneviewWidgets', () => {
	it('returns the same object preserving keys', () => {
		const widgets = definePaneviewWidgets({ a: widgetA, b: widgetB })
		expect(widgets.a).toBe(widgetA)
		expect(widgets.b).toBe(widgetB)
	})
})
