<script lang="ts">
import type { PanelState } from '$lib/index.js'

let { state }: { state: PanelState } = $props()
</script>

<div class="inbox">
	<p>unread: <strong>{String(state.custom.unread ?? 0)}</strong></p>
	<button onclick={() => (state.custom.unread = Number(state.custom.unread ?? 0) + 1)}>
		unread++ (tab badge updates)
	</button>
</div>

<style>
	.inbox {
		padding: 1rem;
		height: 100%;
		box-sizing: border-box;
		color: var(--dv-activegroup-visiblepanel-tab-color);
	}
</style>
