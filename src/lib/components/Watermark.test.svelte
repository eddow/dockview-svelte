<script lang="ts">
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let { openPanel }: any = $props()
</script>

<div data-testid="watermark-overlay">
	<button type="button" onclick={() => openPanel('a')}>open panel</button>
</div>
