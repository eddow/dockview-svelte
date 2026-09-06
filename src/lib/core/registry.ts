import type {
	GridviewWidgetDefinition,
	GridviewWidgets,
	PaneviewWidgetDefinition,
	PaneviewWidgets,
	SplitviewWidgetDefinition,
	SplitviewWidgets,
	WidgetDefinition,
	Widgets,
} from './types.js'

/**
 * Mutable widget registry consulted by the renderer factories and `openPanel`.
 * Seeded from the `widgets` prop, extended at runtime via `registerWidget`
 * (including `<DvWidget>` declarative children).
 */
export class WidgetRegistry {
	private map = new Map<string, WidgetDefinition>()

	/** Register or replace a widget definition. */
	register(key: string, def: WidgetDefinition): void {
		this.map.set(key, def)
	}

	/** Remove a widget definition (used when a `<DvWidget>` child is destroyed). */
	unregister(key: string): void {
		this.map.delete(key)
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

/**
 * Same as {@link defineWidgets} for splitviews — preserves literal keys and
 * per-widget param types.
 */
export function defineSplitviewWidgets<const W extends SplitviewWidgets>(w: W): W {
	return w
}

/**
 * Same as {@link defineWidgets} for gridviews — preserves literal keys and
 * per-widget param types.
 */
export function defineGridviewWidgets<const W extends GridviewWidgets>(w: W): W {
	return w
}

/**
 * Same as {@link defineWidgets} for paneviews — preserves literal keys and
 * per-widget param types.
 */
export function definePaneviewWidgets<const W extends PaneviewWidgets>(w: W): W {
	return w
}

/** Mutable splitview widget registry, mirroring {@link WidgetRegistry}. */
export class SplitviewWidgetRegistry {
	private map = new Map<string, SplitviewWidgetDefinition>()

	/** Register or replace a widget definition. */
	register(key: string, def: SplitviewWidgetDefinition): void {
		this.map.set(key, def)
	}

	/** Remove a widget definition (used when a `<DvWidget>` child is destroyed). */
	unregister(key: string): void {
		this.map.delete(key)
	}

	/** Get a widget definition by key, or `undefined` if unknown. */
	get(key: string): SplitviewWidgetDefinition | undefined {
		return this.map.get(key)
	}

	/** True if a widget with the given key is registered. */
	has(key: string): boolean {
		return this.map.has(key)
	}

	/** Seed the registry from a `{ [key]: definition }` object. */
	seed(widgets: Record<string, SplitviewWidgetDefinition>): void {
		for (const [key, def] of Object.entries(widgets)) {
			this.map.set(key, def)
		}
	}
}

/** Mutable gridview widget registry, mirroring {@link WidgetRegistry}. */
export class GridviewWidgetRegistry {
	private map = new Map<string, GridviewWidgetDefinition>()

	/** Register or replace a widget definition. */
	register(key: string, def: GridviewWidgetDefinition): void {
		this.map.set(key, def)
	}

	/** Remove a widget definition (used when a `<DvWidget>` child is destroyed). */
	unregister(key: string): void {
		this.map.delete(key)
	}

	/** Get a widget definition by key, or `undefined` if unknown. */
	get(key: string): GridviewWidgetDefinition | undefined {
		return this.map.get(key)
	}

	/** True if a widget with the given key is registered. */
	has(key: string): boolean {
		return this.map.has(key)
	}

	/** Seed the registry from a `{ [key]: definition }` object. */
	seed(widgets: Record<string, GridviewWidgetDefinition>): void {
		for (const [key, def] of Object.entries(widgets)) {
			this.map.set(key, def)
		}
	}
}

/** Mutable paneview widget registry, mirroring {@link WidgetRegistry}. */
export class PaneviewWidgetRegistry {
	private map = new Map<string, PaneviewWidgetDefinition>()

	/** Register or replace a widget definition. */
	register(key: string, def: PaneviewWidgetDefinition): void {
		this.map.set(key, def)
	}

	/** Remove a widget definition (used when a `<DvWidget>` child is destroyed). */
	unregister(key: string): void {
		this.map.delete(key)
	}

	/** Get a widget definition by key, or `undefined` if unknown. */
	get(key: string): PaneviewWidgetDefinition | undefined {
		return this.map.get(key)
	}

	/** True if a widget with the given key is registered. */
	has(key: string): boolean {
		return this.map.has(key)
	}

	/** Seed the registry from a `{ [key]: definition }` object. */
	seed(widgets: Record<string, PaneviewWidgetDefinition>): void {
		for (const [key, def] of Object.entries(widgets)) {
			this.map.set(key, def)
		}
	}
}
