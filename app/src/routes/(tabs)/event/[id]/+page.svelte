<script lang="ts">
	import { page } from '$app/state';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
</script>

<ScreenHeader title="Event" backHref="/explore/events" />
<EmptyState title="Event" body={`Event detail lands in the detail task. (id: ${page.params.id ?? '?'})`} />
