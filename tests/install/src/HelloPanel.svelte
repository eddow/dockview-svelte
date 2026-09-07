<script lang="ts">
import type { PanelState } from 'dockview-svelte'

let { state }: { state: PanelState<{ text?: string }> } = $props()
</script>

<p>{state.params.text ?? 'Hello from installed package'}</p>
