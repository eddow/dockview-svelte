import { describe, expect, it } from 'vitest'
import { defineWidgets, WidgetRegistry } from './registry.js'

const widgetA = { component: {} } as never
const widgetB = { component: {}, title: 'B' } as never

describe('WidgetRegistry', () => {
	it('registers and retrieves definitions', () => {
		const registry = new WidgetRegistry()
		expect(registry.has('a')).toBe(false)
		registry.register('a', widgetA)
		expect(registry.has('a')).toBe(true)
		expect(registry.get('a')).toBe(widgetA)
	})

	it('replaces existing definitions', () => {
		const registry = new WidgetRegistry()
		registry.register('a', widgetA)
		registry.register('a', widgetB)
		expect(registry.get('a')).toBe(widgetB)
	})

	it('seeds from a widgets object', () => {
		const registry = new WidgetRegistry()
		registry.seed({ a: widgetA, b: widgetB })
		expect(registry.get('a')).toBe(widgetA)
		expect(registry.get('b')).toBe(widgetB)
	})

	it('returns undefined for unknown keys', () => {
		const registry = new WidgetRegistry()
		expect(registry.get('missing')).toBeUndefined()
	})
})

describe('defineWidgets (deprecated alias)', () => {
	it('returns the same object preserving keys', () => {
		const widgets = defineWidgets({ a: widgetA, b: widgetB })
		expect(widgets.a).toBe(widgetA)
		expect(widgets.b).toBe(widgetB)
	})
})
