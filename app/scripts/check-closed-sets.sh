#!/usr/bin/env bash
# check-closed-sets.sh — AGENTS.md §1 teeth.
#
# For every string literal inside CHECK (… IN (…)) across
# db/migrations/*.up.sql, assert BOTH:
#   (A) the literal appears somewhere in src (any .ts/.svelte), and
#   (B) the literal is covered by the canonical TS mirror in
#       src/lib/closed-sets.ts —
# unless the literal carries a one-line waiver below. Exit non-zero
# listing offenders.
#
# Extraction assumes each CHECK … IN (…) group sits on one line (true
# for every migration to date; keep it that way or extend with rg -U).
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

# Waivers: "literal|reason". Genuinely local/legacy literals with no const
# mirror by design — one line each, saying why.
WAIVERS=(
	# legacy crew_members.role value from 20240910000001 (dead crews table,
	# superseded by channels/channel_members) — no const by design.
	"owner|legacy role from the dead crews table, superseded by channel_members.role ('admin','member')"
)

is_waived() {
	local lit="$1" w name
	for w in ${WAIVERS[@]+"${WAIVERS[@]}"}; do
		name="${w%%|*}"
		if [[ "$name" == "$lit" ]]; then return 0; fi
	done
	return 1
}

in_groups="$(rg --no-filename -N "CHECK.*IN[[:space:]]*\(" db/migrations/*.up.sql | rg -o "IN[[:space:]]*\([^)]*\)" || true)"
if [[ -z "$in_groups" ]]; then
	echo "check-closed-sets: no CHECK … IN (…) groups found — refusing to pass blind"
	exit 1
fi

literals="$(printf '%s\n' "$in_groups" | grep -o "'[^']*'" | tr -d "'" | sort -u)"

missing_src=()
missing_const=()
while IFS= read -r lit; do
	[[ -z "$lit" ]] && continue
	if is_waived "$lit"; then continue; fi
	if ! rg -qF --glob '*.ts' --glob '*.svelte' "'$lit'" src; then
		missing_src+=("$lit")
	fi
	if ! rg -qF "'$lit'" src/lib/closed-sets.ts; then
		missing_const+=("$lit")
	fi
done <<< "$literals"

fail=0
if [[ ${#missing_src[@]} -gt 0 ]]; then
	echo "check-closed-sets: literals with no use in src:"
	printf '  - %s\n' "${missing_src[@]}"
	fail=1
fi
if [[ ${#missing_const[@]} -gt 0 ]]; then
	echo "check-closed-sets: literals missing from src/lib/closed-sets.ts (add a const or waive):"
	printf '  - %s\n' "${missing_const[@]}"
	fail=1
fi
if [[ $fail -eq 0 ]]; then
	echo "check-closed-sets: clean ($(printf '%s\n' "$literals" | grep -c .) literals, ${#WAIVERS[@]} waiver(s))"
fi
exit $fail
