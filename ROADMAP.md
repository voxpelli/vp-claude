# Roadmap: vp-knowledge

> What this plugin is for: higher-level Basic Memory workflows — package and
> tool research, graph maintenance, coverage and drift audits — built on top of
> the upstream `memory-*` skills rather than duplicating them. The product is
> markdown an agent executes, so a wrong sentence is a behavioural bug.

Deferred work lives here with the trigger that would revive it. A drop without a
trigger loses its revival path and becomes accidental debt, so every entry says
what would bring it back.

`bd` is this repo's tracker, but its write path is unreliable (see
[CLAUDE.md](CLAUDE.md#task-tracking)) and `.beads/` is gitignored, so the backlog
does not travel with a clone. This file is the durable, committed counterpart.

Items are deliberately **unnumbered**: numbered lists invite cross-references
that go stale the moment one item lands, which is a drift class this repo has
now been bitten by more than once. Refer to an item by its heading.

---

## ✔ Closed (2026-08-28): the post-0.34.0 review findings

Three adversarial reviews after the release found live defects. All are fixed,
each verified by planting the defect and watching the guard fail. Recorded here
only so nobody re-derives them from the reviews; the detail is in the commits.

The two with lasting consequences:

- **The audit cadence was implemented twice and the copies contradicted each
  other.** Both sides were tested and the tests pinned opposite answers, so
  neither guard could fail on the disagreement. Fixed, and `check:host-parity`
  now compares the two hosts *behaviourally* — replanting the old bash cadence
  fails it at 9 of 13 sprint counts. That guard is the durable half.
- **`createCheckHarness().done()` exited 0 having run no assertions.** `done()`
  now takes a required floor and refuses `done(0)`, because a guard against
  vacuous checks that permits its own vacuous configuration is the same bug in
  the remedy's clothes.

One finding is deliberately **not** acted on. `driftClassesRanked` and
`unmeasuredReasonsRanked` in `lib/npm-triage.mjs` are `[].every()` over a
filtered set, so a cohort with zero `intel` rows passes having checked nothing —
but `every()` on an empty set is *semantically correct*: with no intel rows
there is genuinely nothing unrankable. Deleting them needs `distance`
union-typed and `DRIFT_ORDER` keyed on that union, and a previous attempt at
this exact coverage check was found vacuous by plant-and-revert because both its
sides derived from one tuple. **Revival trigger:** `ClassifiedRow.distance`
becomes a union type for some other reason, at which point the two checks become
statically provable and can go.

## ▶ Next step (2026-08-28): make the read-only agents read-only on Pi

Four agents this plugin documents as read-only — `knowledge-gardener`,
`knowledge-primer`, `raindrop-gardener`, `finding-verifier` — reach every write
tool on every configured server through the `mcp` proxy. On Claude Code a
`tools` allowlist plus a `PreToolUse` hook enforce the boundary; **Pi has
neither**. Today the guarantee is prose.

**How to update this section** — when the next step is started or completed, or
when a state change makes it stale, replace the title and date (keeping the
`## ▶ Next step (date): <title>` shape), rewrite the content, and re-derive what
follows. Keep the structure: single action, then why, then what comes after.

**The work is one pass over the five `agents-pi/*.md` files**, because three
separate findings land in the same frontmatter:

- **Add `permission:` blocks** to the four read-only agents. Denied tools are
  removed before the agent starts and the `tools:` allowlist cannot restore
  them, so this is real enforcement. `knowledge-maintainer` is deliberately
  excluded — it is the sole write path by design — but takes
  `mcp: { "*": ask, "*delete*": deny }`.
- **Fix the `tools:` lists.** `tools:` is a *complete allowlist* on the installed
  runtime, not a filter over the builtins. `knowledge-gardener` currently ships
  without `read` or `grep` and cannot read a file; `knowledge-primer` and
  `knowledge-maintainer` lack `grep`; `raindrop-gardener` has only `mcp`.
- **Fix `max_turns`.** All five carry `20`, which caps *below* this machine's
  `defaultMaxTurns: 40` and cannot be raised per call. Enforcement is a wrap-up
  steer at the limit then a hard abort five turns later, surfacing as
  `steered`/`aborted` rather than an error — so a capped gardener returns a
  truncated audit that reads like a complete one. The installed
  `finding-verifier.md` already carries `40`, which is someone having hit this.

**The block shape is settled and the two traps are verified** — read
[§6 of the findings record](docs/design/pi-runtime-findings-2026-08-28.md)
before writing a single block. In short: use `"*": "ask"` and never
`"*": deny` on the `mcp` surface (deny strips the proxy tool entirely at
`before_agent_start`, which for `raindrop-gardener` means zero tools), and never
put a colon in a pattern key (the hand-rolled parser splits on the first colon
and discards the entry without error).

**Also in the same pass, two guards** so it cannot silently regress:
`check:agent-parity` should assert every `agents-pi/` tool entry is one of the
seven Pi builtins or the literal `mcp` — which encodes the portability decision
and would have caught the drift the installed copies showed — and that
`basename(file, '.md') === frontmatter.name`, because an unknown `subagent_type`
falls back to **write-capable `general-purpose`** with no signal beyond a line of
prose inside the child's own prompt. Plant-and-revert both; this repo has shipped
eight checks that could not fail, the most recent written inside the guard built
to prevent that class.

**Why this next:** it is the largest remaining gap between what this plugin says
about itself and what it enforces.

**After it:** the MCP tool-name chain below, in order — runtime enumeration
first, then `directTools` coverage, then the generator redesign that depends on
both.

---

## Deferred

### MCP tool names

These three are a dependency chain; doing them out of order breaks agents.

#### Resolve names at runtime rather than by transform

Read `pi.getAllTools()` and inject a table of the host's real names instead of a
rule the model must apply. The correct long-run answer: the adapter's naming
convention has been renegotiated repeatedly, so any local transform is a snapshot
of a moving target. Two guards are mandatory, both learned in `../pi-extensions`
— reject a degenerate enumeration rather than caching it over a good one (at
`session_start` the adapter may not have registered yet), and never let a
subagent write the shared cache, with `PI_SUBAGENT_DEPTH` as the detector.

**Revival trigger:** the transform breaks again, or a second host with different
`directTools` needs supporting.

#### Complete the flattener, or stop mirroring the adapter

`flattenMcpToolName` handles the default `"server"` prefix mode for the character
set every known tool name uses. It does not replicate `formatToolName`'s `.`→`_`
replacement in the tool segment, `sanitizeServerPrefix`'s `_<hex>_` escaping for
server characters outside `[A-Za-z0-9_-]`, or the `"short"`/`"none"`/`"mcp"`
modes. `docs/pi-setup.md` telling users to leave `toolPrefix` at `"server"` is
the standing workaround, not incidental advice. The adapter exports
`getToolNameCandidates`, which handles all of it.

**Revival trigger:** a live tool name contains a dot, a server name falls outside
`[A-Za-z0-9_-]`, or taking `pi-mcp-adapter` as a dependency is reconsidered — it
was offered and declined.

#### Widen `directTools` so the `mcp` proxy can be dropped

Both `../pi-extensions` and the knowledge graph recommend removing the proxy from
the read-only agents, since it reaches every write tool on every server. They are
right about the shape and wrong about the order: on this machine
`raindrop-gardener` needs four raindrop tools that are not `directTools`, and
`knowledge-gardener` needs `recent_activity` plus three `schema_*` calls, none of
which are either. Dropping `mcp` first makes three agents non-functional.

**Revival trigger:** `directTools` covers every call the read-only agents make,
**and** the permission system is confirmed to gate direct tools in practice.

### The Pi agent port

#### Generate the agent files at sync time instead of committing them

An architecture review returned **BUILD-LATER** having verified the premise: every
`agents-pi/*.md` is its canonical twin's body byte-for-byte plus one verbatim
boilerplate header plus mechanically-derived frontmatter. Nothing in them is hand
-authored, and `.claude/rules/agent-development.md` already forbids the divergence
a committed port would enable — so the artifact's one selling point is a
capability the project has denied itself. Collapsing `agents-pi/`, both port
scripts and `check:agent-parity` into one sync-time generator would delete more
code than it adds, and would let the tool list be *derived* against the host's
live registry rather than collapsed to the unrestricted proxy.

Not now: a generator built today would hardcode another static server table,
relocating the bug this release just fixed rather than removing it.

**Revival trigger:** runtime enumeration is wired in with both its guards, **and**
`directTools` covers the read-only agents' calls. Deleting the port machinery is
an ASK-FIRST large removal even once that fires.

#### `prompt_mode: replace`

The installed default (`append`) wraps the agent body in `<agent_instructions>`
and injects a parent-twin bridge. These bodies are self-contained, so `replace`
is plausibly the better fit — but it changes prompt composition for all five at
once.

**Revival trigger:** an agent's output shows it is confused about its own role.
Test on one agent before touching the set.

#### A `general-purpose.md` override as fallback defence

An unknown `subagent_type` falls back to write-capable `general-purpose`, and the
only signal is a line of prose inside the child's own prompt. Shipping a
`general-purpose.md` carrying `permission: { "*": ask }` would turn that silent
downgrade into a visible one.

**Revival trigger:** user decision — it changes behaviour for legitimate
`general-purpose` use, so it is not a default we can pick.

### Extension hygiene

#### Move the extension config to the ecosystem convention

`extensions/config.js` reads `~/.pi/agent/extensions/vp-knowledge.json`. That
subdirectory is where Pi scans for *extensions*; the convention across the
ecosystem is `~/.pi/agent/<package-name>.json`.

**Revival trigger:** the next breaking release — moving a config path strands
anyone who has written one, so it wants its own version bump and a migration note.

#### Adopt `@voxpelli/pi-logger` for caught faults

The extension writes raw `process.stderr.write('[vp-knowledge] …')` calls. The
sibling repo publishes a frozen, dependency-free JSONL logger with session
scoping and a durable `fallbackDir`.

**Revival trigger:** a fault we cannot diagnose from stderr, or that package
being published to npm — taking it is an ASK-FIRST dependency decision either way.

### Known-bad, carried so it is not rediscovered

#### `~/.pi/agent/mcp.json` `approveTools` has the retired underscore spelling

`basic_memory_move_note` and `basic_memory_delete_*` never match the real
`basic-memory_*` names, so that approval gate is partly inert. `*_delete_*` still
catches deletes by luck. Outside this repo, so not fixable from here.

**Revival trigger:** next time that file is edited for any reason.

#### A stray frontmatter line silently truncates a tool list

`parseFrontmatter` in the port script flushes a pending block list when it meets
any line that is neither a list item nor a `key: value`, so a malformed file ports
a shorter `tools:` list with no complaint. Since `tools:` is a complete allowlist,
a dropped entry is a capability the agent silently does not have. Conservative,
but it fails in the quiet direction — this repo's recurring shape. Pinned by a
test rather than fixed.

**Revival trigger:** the parser gains a caller that does not hand-review its
output, or a real agent file acquires a wrapped frontmatter value.

---

## Standing constraints

Not tasks — rules that hold until upstream changes.

- **Never use `tools: none`.** `agent-types.ts:98` falls back to all seven
  builtins on an empty list while `create-subagent-session.ts:220` passes the
  empty list straight through. The two paths disagree, and the documented
  behaviour ("no tools at all") matches only one of them. Lifts when upstream
  resolves the disagreement.

---

## Parked elsewhere

Not restated here, to avoid two records drifting apart:

- The **bd backlog** — 122 open, 116 ready, 237 closed. Read-only access works;
  the write path is unreliable, so nothing new is filed there.
- **`docs/design/`** holds the decision records that outlive a sprint. They are
  indexed nowhere else, so a decision recorded there is invisible unless you go
  looking. The two with the widest reach:
  [pi-runtime-findings-2026-08-28.md](docs/design/pi-runtime-findings-2026-08-28.md)
  (read §6 before any permission work) and
  [intel-corrections-2026-07-28.md](docs/design/intel-corrections-2026-07-28.md).
- **`UPSTREAM-*.md`** track friction in external packages; **`SYNERGY-*.md`**
  track cross-project patterns. Both have their own review cadence.
