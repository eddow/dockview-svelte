import { vi } from 'vitest'

/**
 * Fake {@link PaneviewPanelApi} for tests that need a real `init()` without
 * importing the paneview factory test's hoisted mock.
 */
export function makePaneviewFakeApi(id: string) {
	const listeners: Record<string, Array<(e: never) => void>> = {}
	const on = (key: string) => (cb: (e: never) => void) => {
		;(listeners[key] ??= []).push(cb)
		return { dispose: vi.fn() }
	}
	return {
		id,
		isVisible: true,
		isActive: false,
		isFocused: false,
		isExpanded: true,
		onDidActiveChange: vi.fn(on('active')),
		onDidFocusChange: vi.fn(on('focus')),
		onDidVisibilityChange: vi.fn(on('visibility')),
		onDidDimensionsChange: vi.fn(on('dimensions')),
		onDidExpansionChange: vi.fn(on('expansion')),
		updateParameters: vi.fn(),
		setActive: vi.fn(),
		setExpanded: vi.fn(),
	}
}
