# Evidence Detection — Transcript Scan for Feature Use

Loaded by `/nudge check` (Mode B), Step 2. **Read IN FULL.** This prose is
dogfood-hardened with real dispatch counts and documents specific fixed
false-positives (bare-word `advisor`/`advisories`; the Glob-mtime-cap bug) — a
lossy reword reintroduces exactly those bugs. Do not paraphrase.


**Search by content directly — do not pre-filter by a "recent files"
working set.** An earlier version of this step used `Glob` to build a
most-recently-modified-first working set of ~50 transcript files, then
grepped only within it. This shipped a real, silent bug: Claude Code's
`Glob` caps its returned file list (confirmed: capped well under the total
file count across `~/.claude/projects`), and that cap is a traversal-order
truncation, not a true mtime-sorted slice — so "sort what `Glob` returned,
take the top ~50" was sorting an arbitrary subset. In one real run, the
actively-running session's own transcript (the freshest file on the whole
machine) was completely absent from the computed "top 50." A specific
feature's mentions are sparse relative to any practical file-count cap, so
searching by content directly is both simpler and reliably correct — it
never depends on getting file *ordering* right.

**Two sanity checks first**, once per invocation, before the per-slug loop
— one for the generic transcript format, one for the tag-based mechanism
the slash-command branch below depends on:

```
Grep(pattern="\"type\":\"user\"", path="~/.claude/projects",
     glob="**/*.jsonl", output_mode="files_with_matches")

Grep(pattern="<command-name>", path="~/.claude/projects",
     glob="**/*.jsonl", output_mode="files_with_matches")
```

The second check exists because the slash-command branch's whole mechanism
rests on an assumption about the exact tag format — without a standing
check on that assumption itself, a subtly-wrong format (a missing leading
`/`, a client-version change) would make every slash-command slug return
zero matches, forever, silently indistinguishable from genuine non-use.
This mirrors why the first check exists at all: an indistinguishable
failure mode is exactly how the original `Glob`-based bug shipped
undetected.

Both literal strings (no space after the colon on the first — confirmed
empirically that real transcript JSON has none, unlike a `"type": "user"`
form with a space, which matches nothing) are present in essentially every
real session transcript with any command usage, so together they are a
reliable check that transcript scanning and the tag mechanism both work:
- **Either check gets a "Path does not exist" error** — `~/.claude/projects`
  itself is missing. This is the benign fresh-install case (see Edge
  Cases): treat as "no session evidence available yet," not a failure.
- **The first check returns zero matches with no error** (the directory
  exists but nothing matched this ubiquitous string) — genuine tool/path
  failure. Report to the user and stop; never silently proceed as if every
  feature had no evidence (indistinguishable failure modes are exactly how
  the original bug shipped undetected).
- **The first check succeeds but the second returns zero** — the tag-format
  assumption itself may be wrong, or no slash command has ever been
  dispatched in any scanned project (a legitimate but rare state, since the
  built-in `/config` and similar commands are heavily used in normal
  Claude Code sessions). Treat as a mechanism-level failure for the
  slash-command branch specifically: report it rather than silently
  proposing `nudged` for every slash-command feature. The non-slash branch
  is unaffected and can still proceed normally.
- **Both checks return non-zero** (expect many for the first — common
  enough that the result may itself hit the tool's own result-count cap,
  which is fine here: this check only needs "more than zero," not an exact
  count) — transcript scanning and the tag mechanism both work; proceed to
  the per-slug loop below.

**Per-slug search.** For each catalog slug, derive a `<search-term>` from
the tip text (loaded in Step 1) — **not** the normalized slug, which is a
machine key for frontmatter/ring-buffer matching that nobody ever types
into a session:
1. Extract the first backtick-quoted span from the slug's tip text (every
   seed tip's prose leads with one, e.g. `` `opusplan` ``, `` `/advisor` ``,
   `` `/fork <directive>` ``, `` `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP=1` ``).
2. If it contains a placeholder argument (a `<...>` token, e.g.
   `/fork <directive>`, `/batch <instruction>`), truncate at the first `<`
   and trim trailing whitespace, keeping only the fixed literal part
   (`/fork <directive>` → `/fork`).
3. Use the resulting literal string as `<search-term>`. None of the current
   seed terms contain regex metacharacters, so no escaping is needed today
   — but a future tip containing one (`.`, `(`, `$`, etc.) would need
   literal-string escaping before use as a `Grep` pattern.

**Derivation sanity guard.** Steps 1–3 assume the tip *leads* with the
feature's own invocable term in backticks. Most tips satisfy this, but it is
not guaranteed — two catalog tips break it: `scratchpad`'s first backtick span
is `` `/tmp` `` (the feature name is in double quotes, not backticks) and
`subagents-background-default`'s is
`` `background` `` (a frontmatter field named in passing, a generic English
word). Before using `<search-term>`, confirm it plausibly *names the feature*:
its normalized form should share a token with the slug, or be a recognizable
command / flag / env-var / setting for it. If instead the derived term is an
unrelated token — a bare path like `/tmp`, or a generic word like `background`
that would match essentially every transcript — the tip does not lead with a
searchable term. Do NOT search the mis-derived term at all — its results are
meaningless: a 0-result (like `/tmp`) is not evidence of non-use, and a
generic-word flood (like `background`) must never be read as genuine
typed/dispatch evidence and drive a false `adopted`. The slug then follows the
ordinary no-evidence path in the Step 3 transition table — an `unseen` slug is
proposed for `nudged`, an already-`adopted`/`declined` slug is left as-is —
exactly like the structurally-undetectable env-var/settings features in
[`adoption-limitations.md`](adoption-limitations.md). Annotate its line in the
Step 4 preview to say the term could not be derived, so the reader knows use was
never actually checked (rather than checked and found absent).

**Branch on whether `<search-term>` starts with `/` (a slash command) — the
two cases need genuinely different evidence criteria, not just different
patterns.**

**Slash-command terms — search for the dispatch tag directly, not the bare
term.**  Claude Code wraps every genuine slash-command dispatch (built-in
or plugin-namespaced) in a `<command-name>...</command-name>` tag inside
`message.content`, and free-text mentions never produce this wrapper
regardless of where in the message the term appears. So search for the tag
directly:

```
Grep(pattern="<command-name><search-term></command-name>",
     path="~/.claude/projects", glob="**/*.jsonl",
     output_mode="files_with_matches")
```

**A tag match alone is not sufficient — but the correct further check is
structural, not field-based.** An earlier version of this doc required
`promptSource:"typed"` + `origin.kind=="human"` on top of the tag match.
That was backwards and confirmed unsatisfiable against 600 real dispatch
samples across every project on this machine: a genuine dispatch entry's
`message` object is *always* exactly `{role, content}` — no `promptSource`,
no `origin`, no `permissionMode` field ever exists on a real dispatch.

**This "never exists" claim is scoped to dispatch-tagged entries only.**
Those fields belong to a different message shape — ordinary typed prose,
the one the non-slash-command branch further below evaluates — and
structurally never co-occur with the dispatch-tag shape evaluated here.
Requiring them on *this* shape made the check impossible to satisfy, ever,
for any real usage. The non-slash-command branch legitimately checks
`promptSource`/`origin.kind` because it is reading a different kind of
transcript entry, not because the rule above was relaxed.

`Read` each matched file and confirm the matching entry satisfies **one of
two** genuine-dispatch shapes — confirmed via live dogfooding that built-in
commands are emitted in either shape depending on the command, so checking
only one produces real false negatives (a genuine historical `/fork`
dispatch was missed by Shape A alone):

**Shape A — `type:"user"` dispatch.** All four of:
1. The entry is `type:"user"`.
2. `message.content` is a **string**, not an array/list — this alone rules
   out an assistant `tool_use` block and a `tool_result` entry, both of
   which always have list-shaped content, never string.
3. That string, with leading whitespace trimmed, **starts with**
   `<command-name>` or `<command-message>` — not "contains the tag
   anywhere in the message." Confirmed: 0/600 genuine dispatches had the
   tag embedded mid-prose. A human quoting or pasting the tag inside a
   longer message fails this condition.
4. The **top-level transcript entry** (a sibling of `message`, not nested
   inside it) carries **none** of `toolUseResult`, `sourceToolAssistantUUID`,
   `requestId` — an extra, cheap guard against the `tool_result` shape
   specifically, on top of condition 2 (which already excludes it via
   content type).

**Shape B — `type:"system"` local-command dispatch.** Confirmed this is
the general emission shape for every built-in local slash command (found
99 times across 33 sessions and ~10 projects, spanning `/fork`, `/exit`,
`/mcp`, `/doctor`, `/plugin`, `/model`, and others — not a rare one-off).
All three of:
1. The entry is `type:"system"` with `subtype:"local_command"` — check
   these as the entry's own literal JSON fields, not as text mentioned
   inside some other entry's content (a report or message that merely
   *quotes* `"type":"system"` as a string doesn't make its own top-level
   `type` field `"system"`).
2. `content` sits **directly on the entry** (no `message` wrapper — this
   shape has no `message` object at all, unlike Shape A) and is a string.
3. That string, trimmed, starts with `<command-name>` or `<command-
   message>` — same rule as Shape A condition 3.

Shape B needs no extra tool_result/tool_use guard: the exact combination
`type:"system"` + `subtype:"local_command"` was confirmed absent from
every `assistant`/`tool_result` entry found — conditions 1–2 alone already
exclude the self-contamination risk.

A match satisfying either shape **is** the evidence — no further check
needed. Both are *structural* signals, not a positive "a human typed this"
flag — there is no such flag anywhere in the real data; every condition
works by elimination, ruling out every non-dispatch shape actually
observed rather than asserting a positive marker of humanity. **Any match
on a `type:"assistant"` entry is not evidence — discard it, regardless of
what tool or arguments produced it.** Confirmed by dogfooding this exact
mechanism: a matched file can contain the tag-wrapped string inside a
`type:"assistant"` `tool_use` entry — specifically, this very kind of
search's own prior `Grep` call, logged with the literal pattern as its
`input.pattern` argument, which is real noise this mechanism produces, not
a hypothetical. This is also why "Tool use" is not a valid evidence path
for slash-command terms at all: a slash command is always human-dispatched,
never assistant-tool-invoked, so accepting a `type:"assistant"` match here
would count exactly the self-referential noise just described as if it
were genuine adoption.

**Non-slash terms** (bare words, environment variables, settings fields —
e.g. `opusplan`, `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP=1`) have no
equivalent structural marker to search for. Fall back to:

```
Grep(pattern="<search-term>", path="~/.claude/projects", glob="**/*.jsonl",
     output_mode="files_with_matches")
```

Then `Read` each matched file to confirm the shape is real evidence, not
just a mention:

- **Typed invocation** — `type:"user"` + a `message.content` field +
  `promptSource:"typed"` + `origin.kind=="human"`. These two fields are
  legitimate here — this is the ordinary-typed-prose message shape, not the
  dispatch-tag shape the slash-command branch above evaluates, where the same
  fields never appear. This check excludes synthetic, replayed, or pasted
  content — but, unlike the slash-command branch above, there is no further
  structural marker (no equivalent to the
  `<command-name>` tag) to distinguish genuine use from a human merely
  discussing the term in ordinary prose; see the Edge Cases entry on this
  class of feature for the accepted limitation.
- **Tool use** — `type:"assistant"` + a `message.content[]` entry with
  `type:"tool_use"`.
- **Whole-word match, not a bare substring** — confirmed by a real
  pre-fix run: a bare `advisor` search matched ordinary prose about
  "security advisor**ies**." Before counting a match as shape-confirmed,
  verify the search term is not embedded inside a longer word: the
  characters immediately **before and after** the match, if alphanumeric,
  must not continue the same word (checking only one side leaves the other
  boundary open to the identical false-positive class).

Count **distinct sessions** (distinct transcript files) with at least one
confirmed hit per slug — structurally-confirmed for slash-command terms,
shape-confirmed for non-slash terms — not raw line matches: repeated
matches within the same session are one piece of evidence, not several. If
a slug's own `Grep` result hits the tool's result-count cap (confirmed: a
broad bare-word token can exceed ~250 matched files — the tag-based search
does not have this exposure in practice, since it only matches genuine
dispatches), this cannot produce a false "no evidence" — a hit is confirmed
the moment any one matched file passes its applicable evidence check, so a
cap can only ever under-count the *session number* shown in the Step 4
preview.

