<script lang="ts">
	import Gridview from './Gridview.svelte'

	let {
		widgets = {},
		options = {},
		layout = $bindable(undefined),
		onReady
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}: any = $props()

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let panels: any[] = $state([])
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let activePanel: any = $state(undefined)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let handle: any = $state(undefined)
	let layoutSnapshot: string = $state('none')

	$effect(() => {
		layoutSnapshot = layout === undefined ? 'none' : JSON.stringify(layout)
	})
</script>

<Gridview {widgets} {options} bind:layout bind:panels bind:activePanel bind:handle {onReady} />
<span data-testid="panels-count">{panels.length}</span>
<span data-testid="panels-ids">{panels.map((p) => p.id).join(',')}</span>
<span data-testid="active-id">{activePanel?.id ?? 'none'}</span>
<span data-testid="has-handle">{handle ? 'yes' : 'no'}</span>
<span data-testid="layout-snapshot">{layoutSnapshot}</span>
