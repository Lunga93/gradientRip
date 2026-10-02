<script lang="ts">
	import { page } from '$app/state';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
</script>

<ScreenHeader title="Route" backHref="/explore/routes" />
<EmptyState title="Route" body={`Route detail lands in the detail task. (id: ${page.params.id ?? '?'})`} />
