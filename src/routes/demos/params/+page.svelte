<script lang="ts">
import { themeAbyss } from 'dockview'
import { onMount } from 'svelte'
import { Dockview, type DockviewHandle, defineWidgets } from '$lib/index.js'
import CounterPanel from '../_widgets/CounterPanel.svelte'

const widgets = defineWidgets({
	counter: { component: CounterPanel, title: 'Counter' },
})

let handle = $state<DockviewHandle<typeof widgets> | undefined>(undefined)
// Passed by reference as openPanel `params`, so this object IS `state.params`
// in the widget. Mutate its fields from either side and both update — but
// never reassign it wholesale (that would detach the widget's reference).
let counter = $state({ start: 10, step: 2 })

onMount(() => {
	// Child onMount runs before parent onMount, so Dockview has already
	// assigned `handle` — `!` asserts that ordering invariant (TS can't see it).
	handle!.openPanel('counter', { params: counter })
})
</script>

<svelte:head><title>Params — dockview-svelte demos</title></svelte:head>

<h1>Reactive params (two-way)</h1>
<p>
	Mutating <code>state.params</code> in the widget calls <code>api.updateParameters</code>;
	dockview-side updates merge back in. The page shares its own
	<code>$state</code> object as the panel's <code>params</code> — try
	<code>step++</code> on either side and watch both update.
</p>
<div class="row">
	<button onclick={() => (counter.step += 1)}>page: step++ ({counter.step})</button>
	<span>page sees: start={counter.start}, step={counter.step}</span>
</div>
<div class="demo">
	<Dockview bind:handle {widgets} options={{ theme: themeAbyss }} />
</div>

<style>
	.demo {
		height: 40vh;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
</style>
