<script lang="ts">
import { themeAbyss } from 'dockview'
import { onMount } from 'svelte'
import { Dockview, type DockviewHandle } from '$lib/index.js'
import BadgeTab from '../_widgets/BadgeTab.svelte'
import InboxPanel from '../_widgets/InboxPanel.svelte'

const widgets = {
	inbox: { component: InboxPanel, tab: BadgeTab, title: 'Inbox' },
	plain: { component: InboxPanel, title: 'Plain' },
}

let handle = $state<DockviewHandle<typeof widgets> | undefined>(undefined)

onMount(() => {
	handle?.openPanel('inbox', { title: 'Inbox (custom tab)' })
	handle?.openPanel('plain', { title: 'Plain (default tab)' })
})
</script>

<svelte:head><title>Custom tab — dockview-svelte demos</title></svelte:head>

<h1>Custom tab + shared state</h1>
<p>
	Tab and content receive the <em>same</em> <code>PanelState</code> —
	<code>state.custom.unread</code> set in the content renders as a badge in the tab.
</p>
<div class="demo"><Dockview bind:handle {widgets} options={{ theme: themeAbyss }} /></div>

<style>
	.demo {
		height: 40vh;
	}
</style>
