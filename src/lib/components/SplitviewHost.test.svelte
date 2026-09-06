<script lang="ts">
	import Splitview from './Splitview.svelte'

	let {
		widgets = {},
		options = {},
		layout = $bindable(undefined),
		onReady
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}: any = $props()

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let views: any[] = $state([])
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let handle: any = $state(undefined)
	let layoutSnapshot: string = $state('none')

	$effect(() => {
		layoutSnapshot = layout === undefined ? 'none' : JSON.stringify(layout)
	})
</script>

<Splitview {widgets} {options} bind:layout bind:views bind:handle {onReady} />
<span data-testid="views-count">{views.length}</span>
<span data-testid="views-ids">{views.map((v) => v.id).join(',')}</span>
<span data-testid="has-handle">{handle ? 'yes' : 'no'}</span>
<span data-testid="layout-snapshot">{layoutSnapshot}</span>
