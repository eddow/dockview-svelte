/**
 * Shared helpers for factory double-bind tests.
 *
 * The factories wire widget → dockview pushes through `$effect`s created inside
 * `$effect.root()` during `init()`. Those effects run on Svelte's microtask
 * queue, so tests must `await tick()` after mutating `state` before asserting
 * on the api mocks. `flushSync` does NOT work here — the effects are scheduled
 * async, not batched sync updates.
 */
import { tick } from 'svelte'
import { expect, type vi } from 'vitest'

/** Await pending `$effect`s so widget → dockview pushes have run. */
export async function flushEffects(rounds = 2): Promise<void> {
	for (let i = 0; i < rounds; i++) {
		await tick()
	}
}

/** Assert `updateParameters` was called with a snapshot equal to `expected`. */
export function expectUpdateParameters(
	api: { updateParameters: ReturnType<typeof vi.fn> },
	expected: unknown
): void {
	expect(api.updateParameters).toHaveBeenCalled()
	const last = api.updateParameters.mock.calls.at(-1)![0]
	expect(last).toEqual(expected)
}
