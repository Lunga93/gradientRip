# App Shell Redesign (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the app shell and visual language (light editorial, solid colour, real routes, bottom tab bar) while moving every existing screen to its new home with zero behaviour change to planning/riding.

**Architecture:** Token-layer rewrite in `app.css`, then a new `src/lib/ui/` primitive set, then a route-by-route migration off the single `+page.svelte` panel onto a `+layout.svelte` shell. The `mapController` module singleton is untouched; routes only mount/unmount `MapCanvas`.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Tailwind v4 (`@theme` tokens), vitest (node env; happy-dom pragma for component tests), `@testing-library/svelte`, `@fontsource-variable/inter`, Leaflet (unchanged).

**Spec:** `docs/superpowers/specs/2026-09-25-app-shell-redesign-design.md`

## Global Constraints

- All work happens in the worktree `/home/lunga/Projects/Skater/gradientRip/.worktrees/feat-social-v1`, app code in `app/`, branch `feat/social-v1`.
- Colour: solid hex only, never `rgba()` for text. Text floors: 12px minimum (11px metadata only), weight ≥ 500, labels 600.
- One primary action per screen. 44px minimum touch targets. `aria-current` on the active tab. `prefers-reduced-motion` respected.
- No planner/ride behaviour change in Phase A — tokens and type only on those screens.
- After every task: `npm run check && npm run lint && npm test` in `app/`. Full gate adds `npm run build`.
- Unit tests live in `src/**/*.test.ts`. Component tests use the `// @vitest-environment happy-dom` pragma and `@testing-library/svelte`.
- Commit after every task with a `feat:`/`fix:`/`docs:`/`test:` prefix. Never commit secrets. `app/.env` is gitignored — leave it alone.
- Dev verification uses the running dummy stack: app `http://127.0.0.1:5173/`, dummy login `http://127.0.0.1:5173/api/auth/dev-login?token=dummy-local-login&email=lungy@skate.test`, dummy DB on port 5435. Restart the dev server after route-tree changes if HMR misses them (`/tmp/gradientrip-dev.log` shows which).

---

## File Structure

New files (each one responsibility):

- `app/src/lib/ui/tokens.css` — imported by `app.css`; all colour/type/spacing tokens, light + `[data-theme="dark"]`.
- `app/src/lib/ui/nav.ts` — the route table: ordered tabs `{ key, label, href }`, detail parent map, `isActive(path)` helper.
- `app/src/lib/ui/format.ts` — `relTime(ts)`, `fmtKm(km)`, `fmtCount(n)` (1.2k), pure functions.
- `app/src/lib/ui/AppShell.svelte` — header slot, content slot, `<TabBar/>`, safe-area padding.
- `app/src/lib/ui/TabBar.svelte` — bottom bar rendering `nav.ts` tabs as links.
- `app/src/lib/ui/ScreenHeader.svelte` — `{ title, backHref?, action? }` snippet props.
- `app/src/lib/ui/ListRow.svelte` — avatar/title/meta/trailing-action row with hairline.
- `app/src/lib/ui/MediaCard.svelte` — the only surfaced card, for media content.
- `app/src/lib/ui/SegmentedControl.svelte` — link-based segments `{ label, href, active }`.
- `app/src/lib/ui/EmptyState.svelte` — `{ title, body, actionLabel?, onAction? }`.
- `app/src/lib/ui/StateBadge.svelte` — `{ label, tone: 'accent'|'go'|'caution'|'stop'|'neutral' }`, solid fill.
- `app/src/lib/ui/Buttons.svelte` — `PrimaryButton` + `SecondaryButton` snippets (44px min).
- `app/src/lib/ui/Skeleton.svelte`, `app/src/lib/ui/Sheet.svelte`, `app/src/lib/ui/ErrorNotice.svelte`.
- New routes: `app/src/routes/(tabs)/home/+page.svelte`, `map/`, `explore/`, `explore/routes/`, `explore/crews/`, `explore/events/`, `activity/`, `me/`, `me/rides/`, `me/friends/`, `ride/`, `crew/[id]/`, `route/[id]/`, `event/[id]/`. (Route group `(tabs)` holds the tabbed screens so `+layout.svelte` can render `AppShell` only for them; `/ride` and detail routes sit outside the group and opt out of the tab bar.)

Modified: `app/src/app.css`, `app/package.json`, `app/src/routes/+layout.svelte`, `app/src/routes/+page.ts` (new), `app/src/lib/state/ui.svelte.ts`, `app/src/lib/planner.svelte.ts`, `app/src/lib/tracker.ts`, `app/src/lib/components/MapFabs.svelte`, every migrated view component, `app/static/manifest.webmanifest`.

Deleted at the end: `app/src/routes/+page.svelte` (replaced by redirect), old `TabBar.svelte`, `PanelHeader.svelte`, `SavedView.svelte` (folded into `me/rides`), `RideView.svelte` (folded into `/ride`), `FriendsView.svelte` (split).

---

### Task 1: Token layer, Inter, DaisyUI removal

**Files:**
- Modify: `app/src/app.css`, `app/package.json`, `app/static/manifest.webmanifest`
- Create: `app/src/lib/ui/tokens.css`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties consumed by every later task: `--text-primary/secondary/tertiary/disabled/on-accent`, `--surface-page/sunken/raised/inverse`, `--line/line-strong`, `--accent/accent-hover`, `--brand-gradient`, `--state-go/caution/stop/live`, `--radius-sm/md/lg`, `--type-*` scale. Font family `--font-sans` pointing at Inter Variable.

- [ ] **Step 1: Install the Inter variable font**

Run: `npm install @fontsource-variable/inter` in `app/`
Expected: `node_modules/@fontsource-variable/inter` exists.

- [ ] **Step 2: Create `app/src/lib/ui/tokens.css`** with the full token set (solid hex only, light + dark):

```css
/* Solid-only design tokens. Text hierarchy from colour value, never opacity. */
:root {
	--font-sans: 'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	--surface-page: #ffffff;
	--surface-sunken: #f6f7f9;
	--surface-raised: #ffffff;
	--surface-inverse: #0b0f14;
	--line: #e4e7ec;
	--line-strong: #d0d5dd;
	--text-primary: #0f172a;
	--text-secondary: #46525f;
	--text-tertiary: #6b7687;
	--text-disabled: #9aa5b1;
	--text-on-accent: #ffffff;
	--accent: #1d4ed8;
	--accent-hover: #1e40af;
	--brand-gradient: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
	--state-go: #047857;
	--state-caution: #b45309;
	--state-stop: #dc2626;
	--state-live: #059669;
	--radius-sm: 8px;
	--radius-md: 12px;
	--radius-lg: 16px;
	--type-display: 700 1.75rem/2rem var(--font-sans);
	--type-title: 600 1.25rem/1.625rem var(--font-sans);
	--type-heading: 600 1.0625rem/1.5rem var(--font-sans);
	--type-body: 400 0.9375rem/1.375rem var(--font-sans);
	--type-body-strong: 600 0.9375rem/1.375rem var(--font-sans);
	--type-meta: 500 0.8125rem/1.125rem var(--font-sans);
	--type-label: 600 0.75rem/1rem var(--font-sans);
}

[data-theme='dark'] {
	--surface-page: #0b0f14;
	--surface-sunken: #11161d;
	--surface-raised: #151b24;
	--surface-inverse: #ffffff;
	--line: #232b36;
	--line-strong: #333d4b;
	--text-primary: #f8fafc;
	--text-secondary: #c3cad4;
	--text-tertiary: #8e98a8;
	--text-disabled: #5b6472;
	--text-on-accent: #ffffff;
	--accent: #60a5fa;
	--accent-hover: #93c5fd;
}
```

- [ ] **Step 3: Wire tokens + font into `app.css`** — add at the top after the tailwind import:

```css
@import '@fontsource-variable/inter';
@import './lib/ui/tokens.css';
```

Replace the `-webkit-font-smoothing: antialiased;` declaration on `html, body` with nothing (delete the line; browser default applies). Delete the `.clip-chamfer-tr`, `.clip-chamfer-tl`, `.clip-chamfer-bl` rules, the `.chamfer-card`, `.chamfer-card-interactive`, `.verdict-tag` rules, the `.panel`, `.panel-scroll`, `.grabber`, `.view` rules and their mobile duplicates. Replace the four `--ink-*` custom property definitions with nothing (components migrate off them in later tasks; any leftover `var(--ink-*)` reference fails loudly at review time — that is intentional).

- [ ] **Step 4: Remove DaisyUI and refresh manifest colours**

Run: `npm uninstall daisyui` in `app/` (verified: no `daisyui` import in `src/`, `vite.config.ts`, or `svelte.config.js`; `card`/`btn` hits are our own `chamfer-card`/`slash-btn`).
In `app/static/manifest.webmanifest` set `background_color` and `theme_color` to `#ffffff`.

- [ ] **Step 5: Verify**

Run: `npm run check && npm run lint && npm run build` in `app/`
Expected: 0 errors. Then run: `rg -n "rgba\(15, 23, 42|rgba\(241, 245, 249" src/app.css src/lib/ui/tokens.css` — Expected: no output. Run: `rg -c "chamfer|verdict-tag|\.panel\b|grabber" src/app.css` — Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add app/src/app.css app/src/lib/ui/tokens.css app/package.json app/package-lock.json app/static/manifest.webmanifest
git commit -m "feat: solid token layer, Inter, drop unused daisyui"
```

---

### Task 2: Navigation spine (`nav.ts`, `format.ts`) + `ui` store trim

**Files:**
- Create: `app/src/lib/ui/nav.ts`, `app/src/lib/ui/nav.test.ts`, `app/src/lib/ui/format.ts`, `app/src/lib/ui/format.test.ts`
- Modify: `app/src/lib/state/ui.svelte.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `TABS: { key: 'home'|'map'|'explore'|'activity'|'me'; label: string; href: string }[]`, `isTabActive(tabHref, pathname): boolean`, `detailParent(pathname): string | null` (maps `/crew/x`→`/explore/crews`, `/route/x`→`/explore/routes`, `/event/x`→`/explore/events`), `relTime(ts, now?): string`, `fmtKm(km): string`, `fmtCount(n): string`. `UiState` keeps `netOnline/isMobile/theme/legal/statusMsg`; deletes `activeTab/setTab/sheetOpen/setSheet/panelVisible`.

- [ ] **Step 1: Write failing tests for `nav.ts` and `format.ts`**

```ts
// app/src/lib/ui/nav.test.ts
import { describe, it, expect } from 'vitest';
import { TABS, isTabActive, detailParent } from './nav.js';

describe('route table', () => {
	it('has exactly the five approved tabs in order', () => {
		expect(TABS.map((t) => t.key)).toEqual(['home', 'map', 'explore', 'activity', 'me']);
	});
	it('marks nested explore children active for /explore', () => {
		expect(isTabActive('/explore', '/explore/crews')).toBe(true);
		expect(isTabActive('/map', '/explore/crews')).toBe(false);
	});
	it('resolves detail parents', () => {
		expect(detailParent('/crew/abc')).toBe('/explore/crews');
		expect(detailParent('/route/abc')).toBe('/explore/routes');
		expect(detailParent('/event/abc')).toBe('/event/x'.replace('x', 'abc'));
		expect(detailParent('/me/rides')).toBeNull();
	});
});
```

```ts
// app/src/lib/ui/format.test.ts
import { describe, it, expect } from 'vitest';
import { relTime, fmtKm, fmtCount } from './format.js';

describe('format', () => {
	it('relTime buckets minutes/hours/days', () => {
		const now = new Date('2026-09-25T12:00:00Z').getTime();
		expect(relTime(now - 30_000, now)).toBe('just now');
		expect(relTime(now - 5 * 60_000, now)).toBe('5m');
		expect(relTime(now - 3 * 3_600_000, now)).toBe('3h');
		expect(relTime(now - 2 * 86_400_000, now)).toBe('25 Sep');
	});
	it('fmtKm keeps one decimal', () => {
		expect(fmtKm(1.84)).toBe('1.8 km');
	});
	it('fmtCount compacts thousands', () => {
		expect(fmtCount(999)).toBe('999');
		expect(fmtCount(1200)).toBe('1.2k');
	});
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- src/lib/ui/` in `app/`
Expected: FAIL — `nav.js`/`format.js` not defined. (Vitest errors `Failed to load` on the missing modules.)

- [ ] **Step 3: Write minimal `nav.ts` + `format.ts`**

```ts
// app/src/lib/ui/nav.ts
export interface Tab {
	key: 'home' | 'map' | 'explore' | 'activity' | 'me';
	label: string;
	href: string;
}

export const TABS: Tab[] = [
	{ key: 'home', label: 'Home', href: '/home' },
	{ key: 'map', label: 'Map', href: '/map' },
	{ key: 'explore', label: 'Explore', href: '/explore' },
	{ key: 'activity', label: 'Activity', href: '/activity' },
	{ key: 'me', label: 'Me', href: '/me' }
];

export const isTabActive = (tabHref: string, pathname: string): boolean =>
	pathname === tabHref || pathname.startsWith(`${tabHref}/`);

const DETAIL_PARENTS: [prefix: string, parent: string][] = [
	['/crew/', '/explore/crews'],
	['/route/', '/explore/routes'],
	['/event/', '/explore/events']
];

export const detailParent = (pathname: string): string | null => {
	for (const [prefix, parent] of DETAIL_PARENTS) {
		if (pathname.startsWith(prefix)) return parent;
	}
	return null;
};
```

```ts
// app/src/lib/ui/format.ts
export const relTime = (ts: number, now: number = Date.now()): string => {
	const diff = Math.max(0, now - ts);
	if (diff < 60_000) return 'just now';
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
	return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export const fmtKm = (km: number): string => `${km.toFixed(1)} km`;

export const fmtCount = (n: number): string =>
	n < 1000 ? `${n}` : `${(Math.floor(n / 100) / 10).toString()}k`;
```

- [ ] **Step 4: Trim `app/src/lib/state/ui.svelte.ts`** — delete the `activeTab` field, `setTab`, `sheetOpen`, `setSheet`, `panelVisible`. Keep `netOnline`, `isMobile`, `legalDismissed`, `theme`, `statusMsg`, `statusErr`, `statusBusy` and their methods. Do NOT fix callers yet — that is Task 6's job; `npm run check` will fail until then, which is expected and recorded here.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/lib/ui/` in `app/`
Expected: PASS (all 8 tests). Full `npm test` still passes (no existing test touches `ui` state — verified by grep).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/ui/nav.ts app/src/lib/ui/nav.test.ts app/src/lib/ui/format.ts app/src/lib/ui/format.test.ts app/src/lib/state/ui.svelte.ts
git commit -m "feat: nav route table, format helpers, trim ui store"
```

---

### Task 3: UI primitives

**Files:**
- Create: `app/src/lib/ui/AppShell.svelte`, `TabBar.svelte`, `ScreenHeader.svelte`, `ListRow.svelte`, `MediaCard.svelte`, `SegmentedControl.svelte`, `EmptyState.svelte`, `StateBadge.svelte`, `Buttons.svelte`, `Skeleton.svelte`, `Sheet.svelte`, `ErrorNotice.svelte`, plus `app/src/lib/ui/primitives.test.ts`

**Interfaces:**
- Consumes: `nav.ts` (`TABS`, `isTabActive`), tokens from Task 1.
- Produces: the components above with these exact props:
  - `ScreenHeader`: `{ title: string; backHref?: string; action?: Snippet }`
  - `ListRow`: `{ title: string; meta?: string; avatar?: Snippet; trailing?: Snippet; href?: string }` — renders `<a>` when `href` set, else `<div>`.
  - `MediaCard`: `{ title: string; meta?: string; media?: Snippet; footer?: Snippet }`
  - `SegmentedControl`: `{ segments: { label: string; href: string }[]; current: string }` (link-based, `aria-current` on match)
  - `EmptyState`: `{ title: string; body: string; actionLabel?: string; onAction?: () => void }`
  - `StateBadge`: `{ label: string; tone: 'accent' | 'go' | 'caution' | 'stop' | 'neutral' }`
  - `Buttons.svelte` exports `PrimaryButton` and `SecondaryButton` snippets taking `{ label: string; onclick?: () => void; type?: 'button' | 'submit' }`
  - `Skeleton`: `{ lines?: number }`; `Sheet`: `{ open: boolean; onClose: () => void; children: Snippet }`; `ErrorNotice`: `{ message: string; onRetry?: () => void }`
  - `TabBar`: no props; reads `$page.url.pathname`; five `<a>` links with `aria-current="page"` on the active tab and a 3px solid `var(--accent)` indicator.
  - `AppShell`: `{ children: Snippet }`; bottom padding `env(safe-area-inset-bottom)`; renders `<TabBar/>` except on routes that opt out via `data.noTabs` (see Task 4).

- [ ] **Step 1: Install component-test deps**

Run: `npm install -D @testing-library/svelte happy-dom` in `app/`
Expected: both in `devDependencies`.

- [ ] **Step 2: Write the failing primitive tests** (`// @vitest-environment happy-dom` must be the first line):

```ts
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EmptyState from './EmptyState.svelte';
import StateBadge from './StateBadge.svelte';
import ErrorNotice from './ErrorNotice.svelte';

describe('EmptyState', () => {
	it('renders title, body and action, and fires onAction', async () => {
		const onAction = vi.fn();
		render(EmptyState, {
			props: { title: 'No routes yet', body: 'Be the first.', actionLabel: 'Publish', onAction }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
		expect(screen.getByRole('heading', { name: 'No routes yet' })).toBeTruthy();
		expect(onAction).toHaveBeenCalledOnce();
	});
});

describe('StateBadge', () => {
	it('renders a solid badge with the label', () => {
		render(StateBadge, { props: { label: 'LIVE', tone: 'live' as never } });
		expect(screen.getByText('LIVE')).toBeTruthy();
	});
});

describe('ErrorNotice', () => {
	it('shows message and retry', async () => {
		const onRetry = vi.fn();
		render(ErrorNotice, { props: { message: 'Offline.', onRetry } });
		await fireEvent.click(screen.getByRole('button', { name: /retry/i }));
		expect(onRetry).toHaveBeenCalledOnce();
	});
});
```

Note: the `StateBadge` test above intentionally passes `tone: 'live'` to force the failure first — `StateBadge` only accepts `'accent' | 'go' | 'caution' | 'stop' | 'neutral'`, and `live` maps to the `'go'` tone (live state reuses go-green). Correct the test to `tone: 'go'` in the implementation step.

- [ ] **Step 3: Run to verify they fail**

Run: `npm test -- src/lib/ui/primitives.test.ts` in `app/`
Expected: FAIL — modules not defined.

- [ ] **Step 4: Write the primitives.** Svelte 5 runes, no `export let`. Styling rules: page background `var(--surface-page)`, text `var(--text-*)`, dividers `1px solid var(--line)`, radii from `--radius-*`, type from `--type-*`, no `box-shadow` except `MediaCard` (`0 1px 2px rgb(15 23 42 / 0.06)`), no uppercase tracking above `0.04em`, no `color-mix` tints, no `var(--ink-*)`. `TabBar` uses plain `<a href>` links (SvelteKit enhances them) and `$page` from `$app/state`. `AppShell` hides `<TabBar/>` when the current route sets `data.noTabs` — read it via `$page.data.noTabs` (routes set it in `+page.ts`, see Task 4).

- [ ] **Step 5: Fix the `StateBadge` test** (`tone: 'go'`), run tests to verify they pass

Run: `npm test -- src/lib/ui/` in `app/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/ui/ app/package.json app/package-lock.json
git commit -m "feat: ui primitives with component tests"
```

---

### Task 4: Routing skeleton + shell layout

**Files:**
- Create: `app/src/routes/+page.ts`, `app/src/routes/+error.svelte`, `app/src/routes/(tabs)/+layout.svelte`, `app/src/routes/(tabs)/home/+page.svelte`, `map/+page.svelte`, `explore/+page.ts` (redirect to `/explore/routes`), `explore/routes/+page.svelte`, `explore/crews/+page.svelte`, `explore/events/+page.svelte`, `activity/+page.svelte`, `me/+page.svelte`, `me/rides/+page.svelte`, `me/friends/+page.svelte`, `app/src/routes/ride/+page.svelte` (+ `+page.ts` setting `noTabs`), `crew/[id]/+page.svelte` (+ `+page.ts` `noTabs`), `route/[id]/+page.svelte`, `event/[id]/+page.svelte`
- Modify: `app/src/routes/+layout.svelte`

**Interfaces:**
- Consumes: `AppShell`, `TabBar`, `nav.ts`, primitives.
- Produces: working route tree. Each tab/detail page renders a placeholder `EmptyState` titled e.g. `Home — coming in Task N` EXCEPT it must be obvious scaffolding, never shippable copy: title `Home`, body `Feed lands in the Home task.` etc. The `(tabs)` layout renders `<AppShell>`; routes outside the group render plain content; `noTabs` pages render without the tab bar.

- [ ] **Step 1: Move shell behaviour into `+layout.svelte`** — copy the `onMount` block from `app/src/routes/+page.svelte` (net listeners, `initCloudBackup()`, mobile media query) into `+layout.svelte`, keeping the service-worker registration in the root layout as-is. The root `+layout.svelte` renders `{@render children()}` plus `<OnboardingWizard/>` and `<LegalNote/>` (they are app-global, not tab content).

- [ ] **Step 2: Create `(tabs)/+layout.svelte`:**

```svelte
<script lang="ts">
	import AppShell from '$lib/ui/AppShell.svelte';
	let { children } = $props();
</script>

<AppShell>
	{@render children()}
</AppShell>
```

- [ ] **Step 3: Create the redirect + placeholder pages** — `app/src/routes/+page.ts`:

```ts
import { redirect } from '@sveltejs/kit';

export const load = () => {
	throw redirect(307, '/home');
};
```

`app/src/routes/explore/+page.ts` same shape → `/explore/routes`. Every other page from the file list: `<ScreenHeader title="…"/>` + `<EmptyState title="…" body="Content moves here in its migration task."/>`. `ride/+page.ts`, `crew/[id]/+page.ts` export `export const load = () => ({ noTabs: true });`

- [ ] **Step 4: Create `+error.svelte`** using `ErrorNotice` with a "Back home" link to `/home`.

- [ ] **Step 5: Verify** — `npm run check && npm run lint && npm run build`, then `npm run dev` (or use the running dev server after HMR settles) and visit `/`, `/home`, `/map`, `/explore`, `/explore/crews`, `/activity`, `/me`, `/ride`, `/crew/x`, `/route/x`, `/event/x`: every URL renders, tab bar highlights the right tab, back button works, `/ride` and `/crew/x` show no tab bar.

- [ ] **Step 6: Commit**

```bash
git add app/src/routes/
git commit -m "feat: route skeleton with tab shell"
```

---

### Task 5: Migrate `/map` and `/ride` (reskin only)

**Files:**
- Modify: `app/src/routes/(tabs)/map/+page.svelte` (new content), `app/src/routes/ride/+page.svelte` (new content), `app/src/lib/components/PlanView.svelte`, `ResultsPanel.svelte`, `PresetChips.svelte`, `ModePicker.svelte`, `HomeCircuitBar.svelte`, `StopList.svelte`, `BattRing.svelte`, `MapFabs.svelte`, `app/src/lib/planner.svelte.ts`, `app/src/lib/tracker.ts`

**Interfaces:**
- Consumes: primitives, tokens. `MapCanvas` mounts inside `/map` only.
- Produces: `/map` = `MapCanvas` + `PlanView` + results; `/ride` = `SessionToolbar` + `ResultsPanel` when results exist, `EmptyState` otherwise. No logic changes.

- [ ] **Step 1: Fix navigation calls.** In `app/src/lib/planner.svelte.ts`: line 108 and 160 `ui.setTab('ride')` → `goto('/ride')` (`import { goto } from '$app/navigation'`); lines 83, 158 `ui.setSheet(true)` → delete. In `app/src/lib/tracker.ts`: lines 250, 259, 295, 304 `ui.panelVisible = …` → delete (ride route has no panel). In `MapFabs.svelte`: lines 45, 118 `!(ui.isMobile && ui.sheetOpen)` guards → delete the guard, keep the rest. In `ResultsPanel.svelte`: line 50 `ui.setTab('plan')` → `goto('/map')`. In `OnboardingWizard.svelte`: line 196 `ui.setTab('plan')` → `goto('/map')`.

- [ ] **Step 2: Build `/map`** — move `MapCanvas`, `PlanView`, `HomeCircuitBar` into `(tabs)/map/+page.svelte`. Read `MapCanvas.svelte` first and add an `onDestroy` cleanup (remove listeners, `map.remove()`) so remounting on tab switches is clean; `mapController` module state persists by design.

- [ ] **Step 3: Build `/ride`** — move `SessionToolbar` + results `ResultsPanel` here; reuse the `RideView` empty state rewritten with `EmptyState` (`Nothing scored yet` / `Plan a route with stops, or draw one straight on the map.` / action → `/map`). Delete `RideView.svelte`.

- [ ] **Step 4: Reskin in place** — in the touched planner components replace `var(--ink-*)` with `var(--text-*)`, `font-mono2` section labels with `--type-label`, `chamfer-card` with plain blocks or `ListRow`, `SlashButton` with `PrimaryButton`/`SecondaryButton` where it is the screen's primary action. Touch nothing behavioural: same props, same handlers, same thresholds.

- [ ] **Step 5: Verify** — `npm run check && npm run lint && npm test` (planner/engine tests must pass unchanged). Manual: plan a route end-to-end (autocomplete → score → save), start ride mode, confirm `/ride` has no tab bar and back returns to `/map`.

- [ ] **Step 6: Commit**

```bash
git add app/src/routes/ app/src/lib/components/ app/src/lib/planner.svelte.ts app/src/lib/tracker.ts
git commit -m "feat: migrate map and ride routes"
```

---

### Task 6: Migrate `/me`, `/me/rides`, `/me/friends`

**Files:**
- Modify: `app/src/routes/(tabs)/me/+page.svelte`, `me/rides/+page.svelte`, `me/friends/+page.svelte`, `app/src/lib/components/SavedTrips.svelte`
- Delete: `app/src/lib/components/SavedView.svelte`

**Interfaces:**
- Consumes: `social.svelte.ts` (`me`, `friends`, `livePeerFor`), `rowToTrip`, primitives.
- Produces: `/me` profile card (avatar, name, email, friend count, sign-in/out — the auth home; Google login CTA lives here), `/me/rides` = `SavedTrips` content, `/me/friends` = buddy rows with live status + expandable shared routes + remove.

- [ ] **Step 1: Fix navigation calls.** `SavedTrips.svelte:59` `ui.setTab('friends')` → `goto('/me')` (sign-in lives on the profile). `SavedTrips.svelte:92` `ui.setTab('plan')` → `goto('/map')`.

- [ ] **Step 2: Build the three pages** by moving the matching blocks out of `FriendsView.svelte` (profile card → `/me`; friends list + expand → `/me/friends`) and `SavedView`+`SavedTrips` (→ `/me/rides`, `ScreenHeader title="My rides"`). Restyle rows as `ListRow`, section labels as `--type-label`, buttons as the new set. Keep `loadTrip` → `goto('/map')` behaviour for opening a friend's route.

- [ ] **Step 3: Delete `SavedView.svelte`.**

- [ ] **Step 4: Verify** — gate trio. Manual as Lungy: sign in, open `/me/rides`, flip Share on a trip (must still round-trip after the identity fix), expand a buddy on `/me/friends`, open their shared route → lands on `/map`.

- [ ] **Step 5: Commit**

```bash
git add app/src/routes/ app/src/lib/components/
git commit -m "feat: migrate profile, rides and friends routes"
```

---

### Task 7: Build `/activity` (split from `FriendsView`)

**Files:**
- Modify: `app/src/routes/(tabs)/activity/+page.svelte`
- Delete: `app/src/lib/components/FriendsView.svelte` (after this task nothing imports it — verify with grep)

**Interfaces:**
- Consumes: `social.svelte.ts` (`incoming`, `outgoing`, `respond`, `sendRequest`, `lastError`), notifications endpoint via `feed.svelte.ts` (endpoints live; wire the list read-only).
- Produces: `/activity` = Requests section (accept/decline) + add-buddy form + notifications list. The `$effect` that started/stopped live updates on `activeTab === 'friends'` becomes a page-level `$effect` on `/activity` while signed in.

- [ ] **Step 1: Move the requests + add-friend blocks** out of `FriendsView.svelte` into the activity page, restyled with primitives. Keep `sendRequest`/`respond` logic identical.

- [ ] **Step 2: Add the notifications list** — `GET /api/notifications`, render rows with `relTime`, empty state `You're all caught up.`

- [ ] **Step 3: Delete `FriendsView.svelte`.** Verify: `rg -n "FriendsView" src` returns nothing.

- [ ] **Step 4: Verify** — gate trio. Manual: send a request from a second dummy user (Priya), accept it as Lungy on `/activity`, confirm the tab badge count matches `incoming.length + unread`.

- [ ] **Step 5: Commit**

```bash
git add app/src/routes/ app/src/lib/components/
git commit -m "feat: activity route, delete FriendsView"
```

---

### Task 8: `/explore` segments + detail routes

**Files:**
- Modify: `app/src/routes/(tabs)/explore/routes/+page.svelte`, `explore/crews/+page.svelte`, `explore/events/+page.svelte`, `app/src/routes/crew/[id]/+page.svelte`, `route/[id]/+page.svelte`, `event/[id]/+page.svelte`, `app/src/lib/components/ChannelsView.svelte`, `ExploreView.svelte`, `EventsView.svelte`, `ChannelDetail.svelte`, `RouteDetail.svelte`, `EventDetail.svelte`

**Interfaces:**
- Consumes: `channels.svelte.ts`, explore/events APIs, primitives.
- Produces: three segment pages under one `SegmentedControl` (Routes `/explore/routes`, Crews `/explore/crews`, Events `/explore/events`); detail pages with `ScreenHeader backHref` to their `detailParent()` (`/crew/x`→`/explore/crews` etc.).

- [ ] **Step 1: Segment pages** — move each view's list content into its page, wrapped with the shared `SegmentedControl`. Restyle list rows as `ListRow`, keep create/join/RSVP logic identical.

- [ ] **Step 2: Detail pages** — move `ChannelDetail` → `crew/[id]` (keep `noTabs`), `RouteDetail` → `route/[id]`, `EventDetail` → `event/[id]`. Replace each `onBack` prop with a back link (`history.back()` with fallback to the parent href).

- [ ] **Step 3: Verify** — gate trio. Manual: create a channel, join it, open it (URL `/crew/<id>` — copy, open cold, confirm it loads), open a route and an event, RSVP, back button at each level.

- [ ] **Step 4: Commit**

```bash
git add app/src/routes/ app/src/lib/components/
git commit -m "feat: explore segments and detail routes"
```

---

### Task 9: `/home` feed + legacy deletion + offline + visual pass

**Files:**
- Create: `app/src/lib/ui/FeedItem.svelte` (+ cases in `app/src/lib/ui/primitives.test.ts`)
- Modify: `app/src/routes/(tabs)/home/+page.svelte`, `app/src/routes/+page.svelte` (delete → replaced by `+page.ts` redirect from Task 4; delete the file here), `app/src/lib/components/TabBar.svelte` (delete), `PanelHeader.svelte` (delete)
- Delete: any remaining `.view`-class usage, leftover `var(--ink-*)` references

**Interfaces:**
- Consumes: `GET /api/feed` (auth-required: signed-out users get an `EmptyState` with sign-in action → `/me`), kudos endpoints, `FeedItem` (header/body/action slots)/`relTime`/`fmtCount`.
- Produces: `FeedItem` component with props `{ header: Snippet; body: Snippet; actions: Snippet }` (slots, so Phase B post content drops in with no structural change); populated `/home` (route cards with fit badge + kudos, event cards with RSVP shortcut), signed-out state, and a codebase with zero references to the old shell.

- [ ] **Step 0: Build + test `FeedItem`** — create `app/src/lib/ui/FeedItem.svelte` (header/body/actions slots, token styling per Task 3 rules, 44px action targets, `:focus-visible` outline) and add render tests to `primitives.test.ts` (header/body/actions all render; slots compose). Run `npm test -- src/lib/ui/` — Expected: PASS.

- [ ] **Step 1: Build `/home`** — fetch `/api/feed`, render every entry inside the `FeedItem` shell (header row: source avatar + title + `relTime`; body slot; action row: kudos/comment/share). `route` bodies show sport, saves/rides and fit `StateBadge`; `event` bodies show time with an RSVP action. Loading → `Skeleton lines={3}`; failure → `ErrorNotice` with retry; empty → `EmptyState`; signed-out → `EmptyState` (`See what the crew is riding` / action `Sign in` → `/me`). Tapping a card navigates to `/route/[id]` / `/event/[id]`.

- [ ] **Step 2: Delete legacy** — `+page.svelte`, old `TabBar.svelte`, `PanelHeader.svelte`. Then run `rg -n "activeTab|setTab|sheetOpen|panelVisible|chamfer|verdict-tag|var\(--ink-" src` — Expected: no output. Fix every hit before proceeding.

- [ ] **Step 3: Service worker check** — read `app/src/service-worker.js`; new route chunks ship via the `build` array automatically, and with `ssr=false` the offline navigation fallback to cached `/` still boots the client router. No code change expected; if the airplane-mode test below fails, fix the fallback to match the requested navigation URL.

- [ ] **Step 4: Full gate** — `npm run check && npm run lint && npm test && npm run build`. Expected: 0 errors, all tests pass (129 existing + new).

- [ ] **Step 5: Visual pass** — screenshot every route at 390px and 1280px (Playwright browsers are cached at `~/.cache/ms-playwright`), fix spacing/type/hierarchy issues at the source, then a manual pass as Lungy through all five tabs, airplane-mode toggle on each tab, and cold-open of a `/crew/[id]` link.

- [ ] **Step 6: Commit**

```bash
git add app/src/routes/ app/src/lib/ app/src/app.css
git commit -m "feat: home feed, legacy shell removal"
```

---

## Self-Review

**1. Spec coverage:** §4.1/4.2 tokens+type → Task 1. §4.3 primitives → Task 3 (+ tests Task 3). §4.4 deletions → Tasks 5–9 stepwise + Task 9 grep gate. §5 routes + screen map → Tasks 4–9 (every current element has a named destination; `/post/[id]` reserved, not built). §6 a11y/offline → Task 3 props, Task 9 SW + airplane test. §7 testing → Tasks 2/3 tests, per-task gates, Task 9 full gate + visual pass. §8 rollout order → Tasks 1–9 in the same order. Feed-auth edge (signed-out `/home`) covered in Task 9. Dark theme covered by Task 1 tokens; planner reskin-only enforced in Task 5 step 4. No gaps.

**2. Placeholder scan:** no TBD/TODO/"similar to"/"appropriate handling". Every test step has exact code and exact run commands. Behavioural unknowns (MapCanvas cleanup, notifications wiring) are scoped as read-first steps with concrete files, not open questions.

**3. Type consistency:** `TABS` keys match the five approved tabs; `detailParent` parents match the explore segment hrefs; `StateBadge` tones are the closed set used by Tasks 5–9; `ScreenHeader`/`ListRow`/etc. props are identical between Task 3 definitions and their later uses. `noTabs` flows `+page.ts` → `$page.data` → `AppShell` consistently.
