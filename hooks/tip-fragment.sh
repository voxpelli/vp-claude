#!/bin/bash
# Deliberately NOT "set -e" / "set -u": every failure mode in this script
# (missing file, empty file, zero matches, awk unavailable) must degrade to
# empty stdout, never abort partway and never take down the caller. Verified
# against real macOS system /bin/bash 3.2 (not just a Homebrew bash): an
# empty array expanded as "${arr[@]}" throws "unbound variable" under set -u
# on 3.2, while "${arr[@]:-}" survives — array expansions that could be empty
# use the defensive `:-` form for that reason. Plain slices (`${arr[@]:1}`,
# `${arr[@]: -N}`) are exempt: a slice of an empty array is itself empty, not
# an error. Applies independent of whether -u is set.
set -o pipefail

# Extract a tip line's trailing "Feature: <slug>" token via bash parameter
# expansion, not sed/awk -F on the em-dash -- a tip's own prose can contain
# one, which would break a naive split.
tip_slug() {
	local s="${1##*Feature: }"
	printf '%s' "${s%% Added:*}"
}

source="${1:-}"

# One tip per real session start; compact already gets its own recovery
# injection from session-start.sh itself. This check runs before the
# kill-switch below -- it is the only thing that runs earlier.
if [ "$source" = "compact" ]; then
	exit 0
fi

# Global kill-switch -- checked before any tips-file/state/date work.
if [ "${VP_KNOWLEDGE_DISABLE_NUDGE:-}" = "1" ]; then
	exit 0
fi

tips_file="${VP_KNOWLEDGE_NUDGE_TIPS_FILE:-$HOME/.claude/references/claude-code-nudge-tips.txt}"
state_dir="${VP_KNOWLEDGE_STATE_DIR:-$HOME/.local/state/vp-knowledge}"
state_file="$state_dir/nudge-state"

# Missing/empty tips file -> empty output, never an error.
[ -s "$tips_file" ] || exit 0

today=$(date +%Y-%m-%d 2>/dev/null) || exit 0
[ -n "$today" ] || exit 0

mkdir -p "$state_dir" 2>/dev/null || true

# Merged throttle + ring-buffer state: one line, "<date> <slug1> <slug2> ...".
# Field 1 is the throttle date; the rest is the ring buffer of recently-shown
# slugs. Missing state -> empty state, not an error.
#
# This read-check-write sequence is deliberately unguarded against a
# two-session TOCTOU (both sessions starting before either has written
# today's date): the worst case is two tips shown the same day, which is
# cosmetic and self-heals on the next start. Not worth a lockfile.
prior_state=""
if [ -f "$state_file" ]; then
	prior_state=$(cat "$state_file" 2>/dev/null) || prior_state=""
fi

read -ra prior_fields <<<"$prior_state"
prior_date="${prior_fields[0]:-}"

# Throttle: already shown today -> exit quietly, no tip.
if [ -n "$prior_date" ] && [ "$prior_date" = "$today" ]; then
	exit 0
fi

# Ring buffer = everything after the date field.
shown_slugs=("${prior_fields[@]:1}")

candidates=()
while IFS= read -r line || [ -n "$line" ]; do
	[ -n "$line" ] || continue
	slug=$(tip_slug "$line")
	[ -n "$slug" ] || continue
	skip=0
	for shown in "${shown_slugs[@]:-}"; do
		if [ -n "$shown" ] && [ "$slug" = "$shown" ]; then
			skip=1
			break
		fi
	done
	if [ "$skip" -eq 0 ]; then
		candidates+=("$line")
	fi
done <"$tips_file"

# If every tip was shown recently (the single most likely steady-state
# trigger once the pool is small), fall back to excluding only the single
# most-recently-shown slug rather than the whole ring buffer -- this still
# guarantees no immediate back-to-back repeat of yesterday's pick, while
# accepting that once the pool is this small, an older tip may resurface
# sooner than the full ring would ideally allow.
if [ "${#candidates[@]}" -eq 0 ]; then
	last_shown_arr=("${shown_slugs[@]: -1}")
	last_shown="${last_shown_arr[0]:-}"
	while IFS= read -r line || [ -n "$line" ]; do
		[ -n "$line" ] || continue
		slug=$(tip_slug "$line")
		if [ -z "$last_shown" ] || [ "$slug" != "$last_shown" ]; then
			candidates+=("$line")
		fi
	done <"$tips_file"
fi

# If STILL nothing (e.g. only one tip total, and it's the one just excluded
# above), fall through to the full pool -- showing the single available tip
# is strictly better than silence.
if [ "${#candidates[@]}" -eq 0 ]; then
	while IFS= read -r line || [ -n "$line" ]; do
		[ -n "$line" ] && candidates+=("$line")
	done <"$tips_file"
fi

[ "${#candidates[@]}" -gt 0 ] || exit 0

# Random pick without shuf (confirmed absent on macOS by default).
pick=$(printf '%s\n' "${candidates[@]}" | awk 'BEGIN{srand()}{a[NR]=$0}END{if(NR)print a[int(rand()*NR)+1]}' 2>/dev/null) || exit 0
[ -n "$pick" ] || exit 0

pick_slug=$(tip_slug "$pick")
[ -n "$pick_slug" ] || pick_slug="$pick"

# Ring buffer: keep the last 5 shown slugs (including this one).
new_shown=("${shown_slugs[@]:-}" "$pick_slug")
ring_size=5
if [ "${#new_shown[@]}" -gt "$ring_size" ]; then
	new_shown=("${new_shown[@]: -$ring_size}")
fi

# Atomic write: temp file + rename -- a concurrent reader never observes a
# partial state file. (The skills that write the tip cache itself do a plain
# `Write` overwrite, not this rename dance -- their reader already degrades
# gracefully on a torn read, so the extra machinery isn't worth it there. It
# is worth it here: this state file backs the once-a-day throttle, and this
# script has real `mv` available to do it properly.)
#
# The tip is emitted ONLY if this state write succeeds: an unwritable state
# dir must fail toward SILENCE, not spam the tip every session because the
# throttle date never persisted.
tmp_state="$state_file.tmp.$$"
if {
	printf '%s' "$today"
	for s in "${new_shown[@]:-}"; do
		[ -n "$s" ] && printf ' %s' "$s"
	done
	printf '\n'
} >"$tmp_state" 2>/dev/null && mv -f "$tmp_state" "$state_file" 2>/dev/null; then
	printf '%s\n' "$pick"
else
	rm -f "$tmp_state" 2>/dev/null || true
fi
