import { cleanup, fireEvent, render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import ReplPage from '../../routes/replcheck/+page.svelte'

/**
 * Faithful reproduction of the docs/playground demo: the real page component,
 * real `dockview`, real buttons. Exercises `bind:layout` as a **read/write**
 * binding — the `save` button reads the emitted layout, the `restore` button
 * writes a previously saved one back in.
 */

// jsdom has no ResizeObserver; dockview's `Resizable` needs one to build.
if (!('ResizeObserver' in globalThis)) {
	;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	}
}

async function flush(rounds = 5): Promise<void> {
	for (let i = 0; i < rounds; i++) await tick()
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
	const el = [...container.querySelectorAll('button')].find(
		(b) => b.textContent?.trim() === label
	) as HTMLButtonElement | undefined
	if (!el) throw new Error(`button "${label}" not found`)
	return el
}

function panelCount(container: HTMLElement): number {
	const el = [...container.querySelectorAll('small')].find((s) => s.textContent?.includes('panels'))
	return Number(el?.textContent?.match(/^(\d+)/)?.[1] ?? -1)
}

describe('docs/repl-demo save & restore (real page, real dockview)', () => {
	afterEach(() => {
		cleanup()
	})

	it('restores a saved layout via the bound `layout`', async () => {
		const view = render(ReplPage)
		await flush()

		// onMount opened 2 panels.
		expect(panelCount(view.container)).toBe(2)

		// save (reads `layout`)
		await fireEvent.click(button(view.container, 'save'))
		await flush()

		// mutate: add two more panels
		await fireEvent.click(button(view.container, '+ files'))
		await fireEvent.click(button(view.container, '+ notes'))
		await flush()
		expect(panelCount(view.container)).toBe(4)

		// restore (writes `layout`)
		const restore = button(view.container, 'restore')
		expect(restore.disabled).toBe(false)
		await fireEvent.click(restore)
		await flush()
		await flush()

		expect(panelCount(view.container)).toBe(2)
		view.unmount()
	})
})
