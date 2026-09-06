<script lang="ts">
import { DEV } from 'esm-env'
import type { Snippet } from 'svelte'
import { getContext } from 'svelte'
import { DOCKVIEW_CONTEXT_KEY } from '$lib/core/context.js'

/**
 * Props for `<DvWidget>`.
 *
 * The `children` snippet receives the panel's shared `state` object — the same
 * object a `widgets`-registry component receives as its `state` prop — and its
 * output is rendered into the panel body (and tab/header, when given).
 * `tab` / `header` snippets receive the same `state`.
 *
 * > **Type note:** the snippet parameter defaults to `never` on purpose — it
 * > cannot be inferred per-widget, so annotate it with your panel's state type
 * > (e.g. `{#snippet children(state: PanelState<{ id: number }>)}`). The
 * > annotation is what gives you typed `state.params`.
 *
 * Usage:
 *
 * ```svelte
 * <Dockview>
 * 	<DvWidget name="chat" title="Chat">
 * 		{#snippet children(state)}
 * 			<ChatWidget {state} />
 * 		{/snippet}
 * 	</DvWidget>
 * </Dockview>
 * ```
 */
interface Props {
	/** Widget key this instance registers under. */
	name: string
	/** Body content, called with the shared `state`. */
	children: Snippet<[state: never]>
	/** Dockview tab override, called with the shared `PanelState` (Dockview only). */
	tab?: Snippet<[state: never]>
	/** Paneview header override, called with the shared `PaneviewState` (Paneview only). */
	header?: Snippet<[state: never]>
	/** Default title for this widget (tier 2 in the resolution chain). */
	title?: string
}

let { name, children, tab, header, title }: Props = $props()

const ctx = getContext<{
	kind: 'dockview' | 'splitview' | 'gridview' | 'paneview'
	registerWidget: (key: string, def: Record<string, unknown>) => void
	unregisterWidget: (key: string) => void
} | null>(DOCKVIEW_CONTEXT_KEY)
if (!ctx) {
	throw new Error(
		'dockview-svelte: <DvWidget> must be a child of Dockview/Splitview/Gridview/Paneview'
	)
}

// Snippets only apply to specific layouts; warn on inapplicable ones instead
// of silently dropping them (the per-layout registry ignores unknown keys).
$effect(() => {
	if (!DEV) return
	if (tab && ctx.kind !== 'dockview') {
		console.warn(
			`dockview-svelte: <DvWidget tab> is only supported by <Dockview>; ignored inside <${ctx.kind}>`
		)
	}
	if (header && ctx.kind !== 'paneview') {
		console.warn(
			`dockview-svelte: <DvWidget header> is only supported by <Paneview>; ignored inside <${ctx.kind}>`
		)
	}
	if (title !== undefined && ctx.kind !== 'dockview' && ctx.kind !== 'paneview') {
		console.warn(
			`dockview-svelte: <DvWidget title> is only supported by <Dockview>/<Paneview>; ignored inside <${ctx.kind}>`
		)
	}
})

/**
 * Build a plain-function component around a snippet. The factories call
 * `mount(component, { target, props: { state } })`, so the wrapper only needs
 * to accept `{ state }` and invoke the snippet with the dockview-owned anchor.
 * A plain function works because Svelte 5 `mount` invokes
 * `Component(anchor, props)` directly (see `_mount` in `svelte/internal/client`).
 *
 * Compiled snippets are `(anchor, ...args)` functions where each arg is a
 * getter thunk (see `svelte/compiler` output: `children($$anchor, () =>
 * myState)`). Passing a thunk over the live `state` keeps reactive reads
 * tracked.
 */
function snippetComponent(snippet: Snippet<[state: never]>) {
	return (anchor: Node, props: { state: never }) => {
		;(snippet as unknown as (node: Node, getState: () => never) => void)(anchor, () => props.state)
	}
}

const component = $derived(snippetComponent(children as Snippet<[state: never]>))
const tabComponent = $derived(tab ? snippetComponent(tab as Snippet<[state: never]>) : undefined)
const headerComponent = $derived(
	header ? snippetComponent(header as Snippet<[state: never]>) : undefined
)

// Register on mount and on every prop change; the cleanup unregisters the
// current key first, so a changed `name` never leaves a stale entry behind.
// `widgets`-prop entries with the same key win on re-seed — declarative
// children are the override path, not the base.
// Only include snippets that apply to the parent layout (`tab` → Dockview,
// `header` → Paneview, `title` → Dockview/Paneview) so the dev warning above is
// accurate and the inapplicable keys never reach the registry.
$effect(() => {
	const def: Record<string, unknown> = { component }
	if (tabComponent && ctx.kind === 'dockview') def.tab = tabComponent
	if (headerComponent && ctx.kind === 'paneview') def.header = headerComponent
	if (title !== undefined && (ctx.kind === 'dockview' || ctx.kind === 'paneview')) {
		def.title = title
	}
	ctx.registerWidget(name, def)
	return () => ctx.unregisterWidget(name)
})
</script>
