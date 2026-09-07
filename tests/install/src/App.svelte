<script lang="ts">
import { Dockview, type DockviewHandle } from 'dockview-svelte'
import 'dockview/dist/styles/dockview.css'
import { themeAbyss } from 'dockview'
import { onMount } from 'svelte'
import HelloPanel from './HelloPanel.svelte'

const widgets = {
	hello: { component: HelloPanel, title: 'Hello' },
}

let handle = $state<DockviewHandle<typeof widgets> | undefined>(undefined)

onMount(() => {
	handle?.openPanel('hello', { params: { text: 'Hello from installed package' } })
})
</script>

<div class="demo">
	<Dockview bind:handle {widgets} options={{ theme: themeAbyss }} />
</div>

<style>
	.demo {
		height: 400px;
	}
</style>
