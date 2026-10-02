<script lang="ts">
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
</script>

<ScreenHeader title="My rides" backHref="/me" />
<EmptyState title="My rides" body="Ride history lands in the Me task." />
