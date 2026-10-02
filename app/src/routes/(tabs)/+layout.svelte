<script lang="ts">
	import AppShell from '$lib/ui/AppShell.svelte';
	let { children } = $props();
</script>

<AppShell>
	{@render children()}
</AppShell>
