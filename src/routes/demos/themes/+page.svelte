<script lang="ts">
import { themeAbyss, themeDark, themeDracula, themeLight } from 'dockview'
import { onMount } from 'svelte'
import { Dockview, type DockviewHandle, defineWidgets } from '$lib/index.js'
import BasicPanel from '../_widgets/BasicPanel.svelte'

const themes = { abyss: themeAbyss, dark: themeDark, light: themeLight, dracula: themeDracula }
type ThemeName = keyof typeof themes

const widgets = defineWidgets({
	basic: { component: BasicPanel, title: 'Themed' },
})

let handle = $state<DockviewHandle<typeof widgets> | undefined>(undefined)
let name = $state<ThemeName>('abyss')

onMount(() => {
	handle?.openPanel('basic', { params: { text: 'Switch the theme!' } })
})
</script>

<svelte:head><title>Themes — dockview-svelte demos</title></svelte:head>

<h1>Themes</h1>
<div class="row">
	{#each Object.keys(themes) as t (t)}
		<button onclick={() => (name = t as ThemeName)} aria-pressed={name === t}>{t}</button>
	{/each}
</div>
<div class="demo"><Dockview bind:handle {widgets} options={{ theme: themes[name] }} /></div>

<style>
	.demo {
		height: 40vh;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
</style>
