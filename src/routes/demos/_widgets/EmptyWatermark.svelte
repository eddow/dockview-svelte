<script lang="ts">
	import type { DockviewHandle } from '$lib/index.js'

	let { openPanel }: { openPanel: DockviewHandle['openPanel'] } = $props()
</script>

<div class="watermark">
	<p>Empty dock — open a panel to begin</p>
	<button
		type="button"
		onclick={() => openPanel('a', { params: { text: 'Opened from empty state' } })}
	>
		open panel
	</button>
</div>

<style>
	.watermark {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		height: 100%;
		color: var(--dv-activegroup-visiblepanel-tab-color);
	}
</style>
