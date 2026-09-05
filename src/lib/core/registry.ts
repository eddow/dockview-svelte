import type { WidgetDefinition, Widgets } from './types.js'

/**
 * Mutable widget registry consulted by the renderer factories and `openPanel`.
 * Seeded from the `widgets` prop, extended at runtime via `registerWidget`.
 */
export class WidgetRegistry {
	private map = new Map<string, WidgetDefinition>()

	/** Register or replace a widget definition. */
	register(key: string, def: WidgetDefinition): void {
		this.map.set(key, def)
	}

	/** Get a widget definition by key, or `undefined` if unknown. */
	get(key: string): WidgetDefinition | undefined {
		return this.map.get(key)
	}

	/** True if a widget with the given key is registered. */
	has(key: string): boolean {
		return this.map.has(key)
	}

	/** Seed the registry from a `{ [key]: definition }` object. */
	seed(widgets: Record<string, WidgetDefinition>): void {
		for (const [key, def] of Object.entries(widgets)) {
			this.map.set(key, def)
		}
	}
}

/**
 * Preserves literal keys and per-widget param types via a `const` type param.
 * A bare `satisfies Widgets` would widen the values to `WidgetDefinition<any>`,
 * losing param inference — use this instead.
 */
export function defineWidgets<const W extends Widgets>(w: W): W {
	return w
}
