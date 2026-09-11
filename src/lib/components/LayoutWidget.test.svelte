<script lang="ts">
// Minimal mountable widget content for layout-binding integration tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let { state }: any = $props()
</script>

<div data-testid="widget">{state?.title ?? 'widget'}</div>
