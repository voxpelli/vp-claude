# Adoption Check — Accepted Limitations

Loaded by `/nudge check` (Mode B). Known constraints of the transcript-evidence
approach that need no fix — documented here so they aren't rediscovered as a
surprise later.


- **The slash-command evidence check (see Step 2) is a structural signal,
  not a positive "a human typed this" flag** — there is no such flag
  anywhere in the real transcript schema (confirmed against 600 real
  dispatch samples). The one theoretical gap this leaves: a human could
  type a message whose content, verbatim and from the very first
  character, reproduces `<command-name>term</command-name>` as literal
  text (e.g. quoting this exact skill's own prose at the start of a
  message) — the starts-with-the-tag condition would not catch that
  specific construction. Accepted as an extremely low-probability
  coincidence (the message would need to open with that exact tag
  pattern, not merely mention it) rather than engineered around, since no
  stronger signal exists in the real data to close it.
- **A slug's `Grep` result hits the tool's own result cap** (confirmed: a
  broad bare-word token can exceed ~250 matched files; the tag-based search
  for slash-command terms does not have this exposure in practice, since it
  only matches genuine dispatches) — accepted, not engineered around:
  evidence is confirmed the moment any one matched file passes its
  applicable evidence check, so a cap can only ever under-count the
  *session number* shown in the Step 4 preview, never flip a real "adopted"
  into a false "no evidence."
- **A non-slash-command feature is adopted entirely outside any Claude Code
  transcript** — environment variables (set in shell rc files), settings.json
  fields, and model-picker choices leave no trace in a session transcript at
  all, genuinely used or not. This is a structural limitation of
  transcript-scanning itself, not a bug: these features will keep proposing
  `nudged` indefinitely regardless of real adoption. Accepted rather than
  engineered around — there is no transcript-based signal to check. The
  `opusplan` seed feature is exactly this case: even a positive non-slash
  bare-word match for it can't be trusted the way a slash-command tag match
  can, since a genuine model-picker selection may never appear in a
  transcript at all — any positive hit is at least as likely to be a
  mention as real use.
- **A tip whose first backtick span is not the feature's own invocable
  term** — the search-term derivation (see Step 2 / evidence-detection.md)
  assumes the tip leads with the feature's command, flag, or env-var in
  backticks. Two catalog tips break that: `scratchpad`'s first span
  is `` `/tmp` `` (the feature name sits in double quotes) and
  `subagents-background-default`'s is `` `background` `` (a frontmatter field
  named in passing). The derivation sanity guard skips searching the garbage
  term (`/tmp` matches nothing; `background` matches essentially every
  transcript) and treats the slug as having no trustworthy evidence — the same
  *outcome* as the environment-variable/settings features above (an `unseen`
  slug keeps being proposed for `nudged`). The difference is only in *why*: for
  an env-var the derived search term is correct, so its 0-result is genuine
  no-evidence; for these two the term itself is wrong, so its results — 0 hits,
  or a flood of generic-word matches — are meaningless and must never be read as
  confirmation either way. Accepted rather than reworded away, because neither
  feature actually HAS a term a human types — a per-session directory and a
  default-on behavior leave no invocation trace at all. The guard's only job is
  to stop a mis-derived term from driving a false transition (a spurious
  `adopted` from generic-word noise).
- **The "starts with `/`" branch condition (see Step 2) is a syntactic
  proxy, not a semantic catalog field** — it correctly classifies all 15
  current seed features, but a future `[nudge]` addition that dispatches
  via a different structural marker (an `@agent` mention, a keyboard
  shortcut, an MCP tool picker) would silently fall into the weaker
  non-slash branch with no equivalent structural check devised for it.
  Worth a look whenever a new catalog entry is added, not engineered around
  pre-emptively for a marker that doesn't exist yet. Two narrower risks
  within the slash-command branch itself, both absent from the current 15
  seed terms but worth checking on any future addition: a plugin/skill-
  namespaced command's real dispatch tag holds the full namespaced form
  (e.g. `<command-name>/vp-knowledge:session-reflect</command-name>`), not
  a bare form — a tip showing only the bare name would never match; and a
  tip showing a literal example argument instead of a `<placeholder>` would
  derive a multi-word search term that can never match a real dispatch tag,
  since command arguments always live in a separate `<command-args>` tag,
  never concatenated into `<command-name>`.
- **Orphaned `adoption-<slug>` frontmatter keys** (a `[nudge]` observation
  was later deleted from the note body, but its frontmatter key remains) —
  left as-is. The key is inert: `schema_validate` ignores frontmatter, and a
  future `read_note` on an absent-from-body slug simply never surfaces it.
  Not worth a reconciliation pass for a low-probability, harmless gap.
- **A separate, lower-probability BM-side risk, accepted rather than
  engineered around** — concurrent `edit_note` calls to the *same BM note*
  (not the local cache file) are last-write-wins with no row-level locking.
  If this skill and an interactive `/knowledge-maintain` pass ever touched
  the noteworthy-features note at the same moment, one edit could be
  silently overwritten. Not mitigated with new machinery, since both are
  interactive, on-demand, effectively-single-writer in practice — stated
  here so it isn't rediscovered as a surprise later.

