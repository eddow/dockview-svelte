<script lang="ts">
	import Dockview from './Dockview.svelte'

	let {
		widgets = {},
		options = {},
		layout = $bindable(undefined),
		watermark,
		onReady
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}: any = $props()

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let active: any = $state({
		panel: undefined,
		group: undefined
	})
	let floating: { count: number; hasFloating: boolean } = $state({ count: 0, hasFloating: false })
	let popout: { count: number; hasPopout: boolean } = $state({ count: 0, hasPopout: false })
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let handle: any = $state(undefined)
	let layoutSnapshot: string = $state('none')

	$effect(() => {
		layoutSnapshot = layout === undefined ? 'none' : JSON.stringify(layout)
	})
</script>

<Dockview
	{widgets}
	{options}
	{watermark}
	bind:layout
	bind:active
	bind:floating
	bind:popout
	bind:handle
	{onReady}
/>
<span data-testid="active-panel">{active.panel?.id ?? 'none'}</span>
<span data-testid="floating-count">{floating.count}</span>
<span data-testid="popout-count">{popout.count}</span>
<span data-testid="has-handle">{handle ? 'yes' : 'no'}</span>
<span data-testid="layout-snapshot">{layoutSnapshot}</span>
