/** True for plain objects (not arrays, not null, not class instances). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null) return false
	const proto = Object.getPrototypeOf(value)
	return proto === Object.prototype || proto === null
}

/** Structural deep equality for JSON-like data (plain objects, arrays, primitives). */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
		return false
	}

	const aIsArray = Array.isArray(a)
	const bIsArray = Array.isArray(b)
	if (aIsArray !== bIsArray) return false

	if (aIsArray && bIsArray) {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) return false
		}
		return true
	}

	const aKeys = Object.keys(a)
	const bKeys = Object.keys(b)
	if (aKeys.length !== bKeys.length) return false
	for (const key of aKeys) {
		if (!Object.hasOwn(b, key)) return false
		if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
			return false
		}
	}
	return true
}

/**
 * Deep-merge `partial` into `target` in place.
 *
 * Nested plain objects are recursed into (preserving object identity so that
 * existing reactive subscriptions survive); leaf values are assigned only when
 * they actually differ, so a no-op merge triggers no reactivity.
 */
export function mergeInto(target: Record<string, unknown>, partial: Record<string, unknown>): void {
	for (const key of Object.keys(partial)) {
		const value = partial[key]
		const current = target[key]
		if (isPlainObject(value) && isPlainObject(current)) {
			mergeInto(current, value)
		} else if (!deepEqual(value, current)) {
			target[key] = value
		}
	}
}
