import { describe, expect, it } from 'vitest'
import { deepEqual, isPlainObject, mergeInto } from './utils.js'

describe('isPlainObject', () => {
	it('accepts plain objects and null-prototype objects', () => {
		expect(isPlainObject({})).toBe(true)
		expect(isPlainObject({ a: 1 })).toBe(true)
		expect(isPlainObject(Object.create(null))).toBe(true)
	})

	it('rejects arrays, null, primitives, class instances', () => {
		expect(isPlainObject([])).toBe(false)
		expect(isPlainObject(null)).toBe(false)
		expect(isPlainObject('x')).toBe(false)
		expect(isPlainObject(42)).toBe(false)
		expect(isPlainObject(new Date())).toBe(false)
	})
})

describe('deepEqual', () => {
	it('compares primitives', () => {
		expect(deepEqual(1, 1)).toBe(true)
		expect(deepEqual(1, 2)).toBe(false)
		expect(deepEqual('a', 'a')).toBe(true)
		expect(deepEqual(null, null)).toBe(true)
		expect(deepEqual(null, undefined)).toBe(false)
	})

	it('compares arrays structurally', () => {
		expect(deepEqual([1, 2], [1, 2])).toBe(true)
		expect(deepEqual([1, 2], [1, 3])).toBe(false)
		expect(deepEqual([1], [1, 2])).toBe(false)
		expect(deepEqual({ a: 1 }, [1])).toBe(false)
	})

	it('compares nested objects', () => {
		expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true)
		expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false)
		expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
	})
})

describe('mergeInto', () => {
	it('merges top-level keys in place', () => {
		const target = { a: 1 }
		mergeInto(target, { b: 2 })
		expect(target).toEqual({ a: 1, b: 2 })
	})

	it('recurses into nested plain objects preserving identity', () => {
		const nested = { x: 1 }
		const target = { nested }
		mergeInto(target, { nested: { y: 2 } })
		expect(target.nested).toBe(nested)
		expect(target).toEqual({ nested: { x: 1, y: 2 } })
	})

	it('replaces non-plain values', () => {
		const target = { a: [1, 2] }
		mergeInto(target, { a: [3] })
		expect(target).toEqual({ a: [3] })
	})
})
