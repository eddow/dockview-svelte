<script lang="ts">
import type { HeaderActionProps } from '$lib/index.js'

let { containerApi, group }: HeaderActionProps = $props()

function floatGroup(): void {
	containerApi.addFloatingGroup(group)
}

async function popoutGroup(): Promise<void> {
	await containerApi.addPopoutGroup(group)
}
</script>

<div class="group-actions">
	<button type="button" title="Float group" aria-label="Float group" onclick={floatGroup}>
		⧉
	</button>
	<button type="button" title="Popout group" aria-label="Popout group" onclick={popoutGroup}>
		↗
	</button>
</div>

<style>
	.group-actions {
		display: flex;
		align-items: center;
		gap: 0.15rem;
		padding-right: 0.25rem;
	}
	.group-actions button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.4rem;
		height: 1.4rem;
		padding: 0;
		border: none;
		background: transparent;
		border-radius: 0.25rem;
		cursor: pointer;
		color: inherit;
		font-size: 0.85rem;
		line-height: 1;
		opacity: 0.7;
	}
	.group-actions button:hover {
		opacity: 1;
		background: var(--dv-hover-background-color, rgba(128, 128, 128, 0.2));
	}
</style>
