<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import PrimaryButton from '$lib/ui/PrimaryButton.svelte';
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';
	import AttachRidePicker, { type RidePick } from './AttachRidePicker.svelte';
	import { ui } from '$lib/state/ui.svelte.js';
	import {
		compressPhoto,
		probeVideoDuration,
		putObjectBytes,
		MAX_PHOTOS,
		MAX_VIDEOS,
		VIDEO_MAX_SECONDS,
		POST_TEXT_MAX
	} from '$lib/media.js';

	interface PhotoItem {
		id: string;
		file: File;
		preview: string;
		uploading: boolean;
		uploaded: boolean;
	}

	interface VideoItem {
		id: string;
		file: File;
		duration: number;
		uploading: boolean;
		uploaded: boolean;
	}

	let text = $state('');
	let photos = $state<PhotoItem[]>([]);
	let video = $state<VideoItem | null>(null);
	let ride = $state<RidePick | null>(null);
	let visibility = $state<'public' | 'friends'>('public');

	let mediaError = $state('');
	let submitError = $state('');
	let busy = $state(false);
	let uploadLabel = $state('');
	let probingVideo = $state(false);

	let photoInput = $state<HTMLInputElement | null>(null);
	let videoInput = $state<HTMLInputElement | null>(null);

	const offline = $derived(
		!ui.netOnline || (typeof navigator !== 'undefined' && navigator.onLine === false)
	);
	const hasContent = $derived(
		text.trim().length > 0 || photos.length > 0 || video !== null || ride !== null
	);
	const canPost = $derived(!offline && !busy && !probingVideo && hasContent);

	const readError = async (res: Response, fallback: string): Promise<string> => {
		if (res.status === 401) return 'Sign in to post — your draft stays here.';
		try {
			const data = (await res.json()) as { message?: unknown };
			if (typeof data.message === 'string' && data.message.trim()) return data.message;
		} catch {
			/* non-JSON error body — fall through to the fallback */
		}
		return `${fallback} (HTTP ${res.status})`;
	};

	const revokeAll = (): void => {
		for (const p of photos) URL.revokeObjectURL(p.preview);
	};

	// Abandoned drafts must not leak object URLs.
	onDestroy(() => {
		revokeAll();
	});

	const onPhotoFiles = (files: FileList | null): void => {
		mediaError = '';
		if (!files || offline || busy) return;
		const incoming = [...files].filter((f) => f.type.startsWith('image/'));
		if (incoming.length === 0) {
			mediaError = 'Those files are not photos — pick image files.';
			return;
		}
		if (photos.length + incoming.length > MAX_PHOTOS) {
			mediaError = `At most ${MAX_PHOTOS} photos per post — extra photos were skipped.`;
		}
		const room = MAX_PHOTOS - photos.length;
		for (const file of incoming.slice(0, room)) {
			photos = [
				...photos,
				{
					id: crypto.randomUUID(),
					file,
					preview: URL.createObjectURL(file),
					uploading: false,
					uploaded: false
				}
			];
		}
		if (photoInput) photoInput.value = '';
	};

	const removePhoto = (id: string): void => {
		const found = photos.find((p) => p.id === id);
		if (found) URL.revokeObjectURL(found.preview);
		photos = photos.filter((p) => p.id !== id);
	};

	const onVideoFile = async (files: FileList | null): Promise<void> => {
		mediaError = '';
		if (!files || offline || busy) return;
		const file = files[0];
		if (videoInput) videoInput.value = '';
		if (!file || !file.type.startsWith('video/')) {
			mediaError = 'That file is not a video — pick a video file.';
			return;
		}
		if (video) {
			mediaError = `At most ${MAX_VIDEOS} video per post — remove the current one first.`;
			return;
		}
		probingVideo = true;
		try {
			const duration = await probeVideoDuration(file);
			if (duration > VIDEO_MAX_SECONDS) {
				mediaError = `Videos must be ${VIDEO_MAX_SECONDS} seconds or shorter — yours is ${Math.round(duration)}s.`;
				return;
			}
			video = {
				id: crypto.randomUUID(),
				file,
				duration,
				uploading: false,
				uploaded: false
			};
		} catch {
			mediaError = 'Could not read that video — try a different file.';
		} finally {
			probingVideo = false;
		}
	};

	const removeVideo = (): void => {
		video = null;
	};

	const post = async (): Promise<void> => {
		if (!canPost) return;
		if (text.length > POST_TEXT_MAX) {
			submitError = `Keep it to ${POST_TEXT_MAX} characters.`;
			return;
		}
		submitError = '';
		busy = true;
		uploadLabel = photos.length > 0 ? 'Preparing photos…' : 'Preparing…';
		try {
			// 1. Compress photos client-side (server re-checks size caps).
			const photoBlobs: Blob[] = [];
			for (const p of photos) photoBlobs.push(await compressPhoto(p.file));

			// 2. Mint upload URLs — keys come back from the server verbatim;
			//    the composer NEVER constructs storage keys. Text/ride-only
			//    posts skip mint+PUT entirely (the endpoint needs ≥1 file).
			const mintFiles = [
				...photoBlobs.map((b) => ({
					kind: 'photo',
					contentType: b.type.startsWith('image/') ? b.type : 'image/jpeg',
					bytes: b.size
				})),
				...(video
					? [{ kind: 'video', contentType: video.file.type || 'video/mp4', bytes: video.file.size }]
					: [])
			];
			const media: { key: string; kind: string }[] = [];
			if (mintFiles.length > 0) {
				const mintRes = await fetch('/api/media/upload-urls', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ files: mintFiles })
				});
				if (!mintRes.ok) throw new Error(await readError(mintRes, 'Could not prepare uploads'));
				const minted = (await mintRes.json()) as { urls: { key: string; url: string }[] };

				// 3. Raw header-less PUTs, one file at a time with an honest step label.
				// Each body carries its kind alongside (no index math against
				// photoBlobs/video to decide photo-vs-video later).
				const bodies: { kind: 'photo' | 'video'; bytes: Uint8Array; photoIdx: number | null }[] = [];
				for (let i = 0; i < photoBlobs.length; i++) {
					bodies.push({ kind: 'photo', bytes: new Uint8Array(await photoBlobs[i].arrayBuffer()), photoIdx: i });
				}
				if (video) bodies.push({ kind: 'video', bytes: new Uint8Array(await video.file.arrayBuffer()), photoIdx: null });
				if (minted.urls.length !== bodies.length)
					throw new Error('Upload preparation mismatch — please try again');
				for (let i = 0; i < minted.urls.length; i++) {
					const part = bodies[i];
					uploadLabel = `Uploading ${i + 1}/${minted.urls.length}…`;
					if (part.kind === 'photo' && part.photoIdx !== null)
						photos[part.photoIdx] = { ...photos[part.photoIdx], uploading: true };
					else if (video) video = { ...video, uploading: true };
					await putObjectBytes(minted.urls[i].url, part.bytes);
					if (part.kind === 'photo' && part.photoIdx !== null)
						photos[part.photoIdx] = { ...photos[part.photoIdx], uploading: false, uploaded: true };
					else if (video) video = { ...video, uploading: false, uploaded: true };
				}
				for (let i = 0; i < minted.urls.length; i++) {
					media.push({
						key: minted.urls[i].key,
						kind: bodies[i].kind
					});
				}
			}

			// 4. Create the post with the minted keys verbatim.
			uploadLabel = 'Publishing…';
			const trimmed = text.trim();
			const createRes = await fetch('/api/posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...(trimmed ? { body: trimmed } : {}),
					media,
					...(ride ? { ride: { kind: ride.kind, id: ride.id } } : {}),
					visibility
				})
			});
			if (!createRes.ok) throw new Error(await readError(createRes, 'Could not publish the post'));
			revokeAll();
			await goto(resolve('/home'));
		} catch (e) {
			submitError = e instanceof Error ? e.message : 'Could not publish — check your connection.';
		} finally {
			busy = false;
			uploadLabel = '';
		}
	};
</script>

<ScreenHeader title="New post" backHref="/home" />
<div class="compose-body">
	{#if offline}
		<p class="offline-copy" role="status">
			You're offline — posting needs a connection. Your draft stays here until you're back.
		</p>
	{/if}

	<label class="field">
		<span class="field-label">What's happening?</span>
		<textarea
			class="field-input"
			rows="4"
			maxlength={POST_TEXT_MAX}
			placeholder="Share a ride, a line, a plan…"
			disabled={offline || busy}
			bind:value={text}
		></textarea>
		<span class="field-counter" aria-live="polite">{text.length}/{POST_TEXT_MAX}</span>
	</label>

	<div class="attach-row">
		<SecondaryButton
			label="Add photos ({photos.length}/{MAX_PHOTOS})"
			ariaLabel="Add photos, up to {MAX_PHOTOS}"
			title="Add photos"
			disabled={offline || busy || photos.length >= MAX_PHOTOS}
			onclick={() => photoInput?.click()}
		/>
		<SecondaryButton
			label={video ? 'Video attached' : 'Add video'}
			ariaLabel="Add a video up to {VIDEO_MAX_SECONDS} seconds"
			title="Add a video"
			disabled={offline || busy || probingVideo || video !== null}
			onclick={() => videoInput?.click()}
		/>
	</div>
	<input
		type="file"
		accept="image/*"
		multiple
		hidden
		bind:this={photoInput}
		onchange={(e) => void onPhotoFiles(e.currentTarget.files)}
		aria-hidden="true"
		tabindex="-1"
	/>
	<input
		type="file"
		accept="video/*"
		hidden
		bind:this={videoInput}
		onchange={(e) => void onVideoFile(e.currentTarget.files)}
		aria-hidden="true"
		tabindex="-1"
	/>

	{#if mediaError}
		<p class="field-error" role="alert">{mediaError}</p>
	{/if}

	{#if photos.length > 0}
		<ul class="preview-list" aria-label="Attached photos">
			{#each photos as p, i (p.id)}
				<li class="preview-item">
					<img src={p.preview} alt="Attachment {i + 1} of {photos.length}" class="preview-img" />
					<span class="preview-state">
						{#if p.uploading}Uploading…
						{:else if p.uploaded}Uploaded ✓
						{:else}{p.file.name}{/if}
					</span>
					<SecondaryButton
						label="Remove"
						ariaLabel="Remove attached photo"
						title="Remove photo"
						disabled={busy}
						onclick={() => removePhoto(p.id)}
					/>
				</li>
			{/each}
		</ul>
	{/if}

	{#if probingVideo}
		<p class="preview-state" role="status">Reading video…</p>
	{/if}
	{#if video}
		<div class="preview-item">
			<!-- No preload/streaming here on purpose: the composer only needs
			     the picked file's name + probed length, not playback. -->
			<span class="preview-state">{video.file.name} · {Math.round(video.duration)}s</span>
			<span class="preview-state">
				{#if video.uploading}Uploading…
				{:else if video.uploaded}Uploaded ✓{/if}
			</span>
			<SecondaryButton
				label="Remove"
				ariaLabel="Remove attached video"
				title="Remove video"
				disabled={busy}
				onclick={removeVideo}
			/>
		</div>
	{/if}

	<AttachRidePicker
		selected={ride}
		onselect={(r) => {
			ride = r;
		}}
		onclear={() => {
			ride = null;
		}}
	/>

	<fieldset class="visibility" disabled={offline || busy}>
		<legend class="field-label">Who can see it?</legend>
		<div class="visibility-row">
			<SecondaryButton
				label="Everyone"
				ariaLabel="Visible to everyone"
				ariaPressed={visibility === 'public'}
				onclick={() => (visibility = 'public')}
			/>
			<SecondaryButton
				label="Friends"
				ariaLabel="Visible to friends only"
				ariaPressed={visibility === 'friends'}
				onclick={() => (visibility = 'friends')}
			/>
		</div>
	</fieldset>

	{#if submitError}
		<ErrorNotice message={submitError} onRetry={() => void post()} />
	{/if}

	{#if busy}
		<p class="progress-copy" role="status">{uploadLabel}</p>
	{/if}

	<PrimaryButton
		label={busy ? uploadLabel || 'Posting…' : 'Post'}
		ariaLabel="Publish post"
		title={offline
			? "You're offline — posting needs a connection"
			: !hasContent
				? 'Add text, media or a ride first'
				: 'Publish post'}
		disabled={!canPost}
		onclick={() => void post()}
	/>
</div>

<style>
	.compose-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--surface-page);
	}

	.offline-copy {
		margin: 0;
		padding: 0.75rem 1rem;
		background: var(--surface-sunken);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		font: var(--type-body);
		color: var(--text-secondary);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.field-label {
		font: var(--type-label);
		letter-spacing: 0.02em;
		color: var(--text-secondary);
	}

	.field-input {
		min-height: 44px;
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--text-primary);
		font: var(--type-body);
		resize: vertical;
	}

	.field-input:disabled {
		opacity: 0.55;
	}

	.field-input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.field-counter {
		align-self: flex-end;
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.field-error {
		margin: 0;
		font: var(--type-body);
		color: var(--state-stop);
	}

	.attach-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.preview-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.preview-item {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem;
		background: var(--surface-sunken);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
	}

	.preview-img {
		width: 56px;
		height: 56px;
		object-fit: cover;
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}

	.preview-state {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.visibility {
		margin: 0;
		padding: 0;
		border: none;
	}

	.visibility-row {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.375rem;
	}

	.progress-copy {
		margin: 0;
		font: var(--type-body);
		color: var(--text-secondary);
	}
</style>
