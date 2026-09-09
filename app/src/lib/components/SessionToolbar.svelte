<script lang="ts">
	import { session } from '$lib/state/session.svelte.js';
	import { exitDrawMode, undoDrawPoint, finishDrawing, exitRecordMode, finishRecording } from '$lib/tracker.js';
</script>

{#if session.drawMode}
	<div class="draw-toolbar" role="status" aria-live="polite">
		<span class="badge badge-lg badge-primary">
			{#if session.drawPoints.length === 1}1 point{:else}{session.drawPoints.length} points{/if}
		</span>
		<span class="hidden text-[0.78rem] text-base-content/60 sm:inline">Tap the map to trace your route</span>
		<span class="flex gap-1.5">
			<button type="button" class="btn btn-sm btn-ghost" onclick={undoDrawPoint} title="Remove last point">Undo</button>
			<button type="button" class="btn btn-sm btn-primary" onclick={finishDrawing} disabled={session.drawPoints.length < 2} title="Finish and score this route">Finish</button>
			<button type="button" class="btn btn-sm btn-ghost" onclick={exitDrawMode} title="Cancel drawing">Cancel</button>
		</span>
	</div>
{/if}

{#if session.recordMode}
	<div class="draw-toolbar" role="status" aria-live="polite">
		<span class="rec-dot" aria-hidden="true"></span>
		<span class="text-[0.8rem] font-bold tabular-nums text-base-content">{session.recordKm.toFixed(2)} km</span>
		<span class="hidden text-[0.78rem] text-base-content/60 sm:inline">Recording your live path — move to trace it</span>
		<span class="flex gap-1.5">
			<button type="button" class="btn btn-sm btn-primary" onclick={finishRecording} disabled={session.recordPoints.length < 2} title="Finish and score this route">Finish</button>
			<button type="button" class="btn btn-sm btn-ghost" onclick={exitRecordMode} title="Cancel recording">Cancel</button>
		</span>
	</div>
{/if}
