<script lang="ts">
	import { page } from '$app/state';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
</script>

<ScreenHeader title="Crew" backHref="/explore/crews" />
<EmptyState title="Crew" body={`Crew detail lands in the detail task. (id: ${page.params.id ?? '?'})`} />
