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

**Shipped work is not recorded here** — `CHANGELOG.md` is its home, and a
roadmap that accumulates a history section stops being read as a to-do list.
What IS worth keeping is a decision *not* to act, which is why several entries
below explain why something was left alone and what would change that.

Every factual claim below was re-verified against the tree on 2026-08-28. Three
were wrong rather than merely stale, and the corrections are noted inline where
they are instructive: a roadmap that is confidently wrong costs more than one
that is out of date, because it gets acted on.

---

## ▶ Next step: make the read-only agents read-only on Pi

Four agents this plugin documents as read-only — `knowledge-gardener`,
`knowledge-primer`, `raindrop-gardener`, `finding-verifier` — reach every write
tool on every configured server through the `mcp` proxy. Verified: `mcp.json`
wires `basic-memory` and `raindrop` as full servers, so `write_note`,
`delete_note`, `move_note` and the raindrop write set are all reachable. On
Claude Code a `tools` allowlist plus a `PreToolUse` hook enforce the boundary;
**Pi has neither**. Today the guarantee is prose.

**How to update this section** — when the next step is started or completed, or
when a state change makes it stale, replace the title and rewrite the content,
keeping the `## ▶ Next step: <title>` shape. Single action, then why, then what
comes after.

### The work

**One pass over the five `agents-pi/*.md` files**, plus one canonical-side
change. All numbers below re-verified 2026-08-28 against the current tree.

- **Add `permission:` blocks** to the four read-only agents. None of the five
  has one today. Denied tools are removed before the agent starts and the
  `tools:` allowlist cannot restore them, so this is real enforcement.
  `knowledge-maintainer` is deliberately excluded — it is the sole write path by
  design — but takes `mcp: { "*": ask, "*delete*": deny }`. Six *other*
  installed agents already carry `permission:` blocks and are usable as
  worked precedent.
- **Fix the `tools:` lists**, on BOTH sides. `tools:` is a complete allowlist on
  the installed runtime, not a filter over the builtins. Current state:

  | agent | `tools:` today | missing |
  |---|---|---|
  | `knowledge-gardener` | `mcp, bash, find, ls` | `read`, `grep` |
  | `knowledge-primer` | `read, find, ls, mcp` | `grep`, `bash` |
  | `knowledge-maintainer` | `read, find, ls, mcp` | `grep`, `bash` |
  | `raindrop-gardener` | `mcp` | everything else |
  | `finding-verifier` | `mcp, bash, find, ls, grep, read` | — (complete) |

  Note what an earlier version of this entry got wrong: `knowledge-gardener`
  **can** read a file, because it has `bash`. And every one of these gaps is
  inherited from the canonical `agents/*.md` twin, so this is a change to
  `agents/` **and** `agents-pi/` together, not a port repair.
- **Fix `max_turns`.** All five carry `20`; `~/.pi/agent/subagents.json` sets
  `defaultMaxTurns: 40`, so the cap is genuinely below the default and cannot be
  raised per call. Enforcement is a wrap-up steer at the limit then a hard abort
  five turns later, surfacing as `steered`/`aborted` rather than an error — so a
  capped gardener returns a truncated audit that reads like a complete one. The
  installed `finding-verifier.md` already carries `40`, which is someone having
  hit this.

### Before writing a single block

Read [§6 of the findings record](docs/design/pi-runtime-findings-2026-08-28.md).
Its two traps are **confirmed at source in the currently-installed packages, but
never observed at runtime** — every cited line number resolves, and no test or
log shows the behaviour. Trust it for mechanism, not as proof:

- Never `"*": deny` on the `mcp` surface. Matching is whole-string against the
  literal `"*"` with no per-kind branch, so a deny strips the proxy tool entirely
  at `before_agent_start` — for `raindrop-gardener` that means **zero tools**.
  Use `"*": "ask"`.
- Never put a colon in a pattern key. The hand-rolled parser splits on the first
  colon and `continue`s with no error path, so the entry is discarded silently.

**Cheapest empirical confirmation before committing to four blocks:** apply
Trap 1 to `raindrop-gardener` alone and see whether it starts with no tools.
One agent, one run, and it converts the whole section from source-read to
observed.

### Two guards, in the same pass

Neither exists today, and **`check:agent-parity` will not catch either**: it
hashes only the canonical *body*, so changing `tools:` or adding `permission:`
in `agents-pi/` does not trip it. Nothing guards those fields at all.

- Assert every `agents-pi/` tool entry is one of the seven Pi builtins or the
  literal `mcp` — that encodes the portability decision, and it would catch the
  drift the *installed* copies already show (see Known-bad below).
- Assert `basename(file, '.md') === frontmatter.name`, because an unknown
  `subagent_type` falls back to **write-capable `general-purpose`** with no
  signal beyond a line of prose inside the child's own prompt.

Plant-and-revert both. This repo keeps shipping checks that cannot fail, the
most recent written inside the guard built to prevent that class.

**After it:** the MCP tool-name chain below, in order — runtime enumeration
first, then `directTools` coverage, then the generator that depends on both.

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
being published to npm — taking it is an ASK-FIRST dependency decision either
way. Checked 2026-08-28: `npm view @voxpelli/pi-logger` returns **404, not
published**, so the trigger has not fired. 0.34.1 *added* three more raw
`process.stderr.write` sites (five total in `extensions/index.js`), which raises
the value of the swap without changing its gate.

### Quality-check plumbing

#### An unreadable tool-call argument tells the human, not the model

When `normalizeBmToolCall` returns `params: null` the extension writes to
stderr. The fourth-wall *finding* path patches `tool_result.content`, which is
the model-visible channel — so the agent that just wrote a note whose quality
check was skipped is not told. Routing it into `patches.content` is arguably
the consistent choice, but it changes what the model sees on every write, so it
wants a deliberate decision rather than riding along in a fix commit.

**Revival trigger:** an observed case of a note landing with the check skipped
and nobody noticing, or a decision that advisory-to-model is right.

#### The schema_validate + fourth-wall pair is still unguarded

The two hosts implement it separately (`hooks/post-bm-write-validate.sh` vs
`extensions/index.js`) and `check:host-parity` does **not** cover the pair. One
real divergence was found and fixed in 0.34.1 — Pi flagged fourth-wall
violations on schema-definition notes that Claude Code exempts — and one
cosmetic difference remains: the two concatenate the fourth-wall and schema text
in opposite orders. Both messages appear either way.

**Revival trigger:** the next edit to either file. (The previous version of this
entry used the same trigger and it had already fired two commits before the
entry was written — check the log, not the prose.)

#### The two `[].every()` ranking gates pass vacuously on an empty set

`driftClassesRanked` and `unmeasuredReasonsRanked` in `lib/npm-triage.mjs`
filter to `intel`/`unmeasured` rows and then `.every()`, so a cohort with none
of those passes having checked nothing. Deliberately left: `every()` on an empty
set is *semantically correct* — with no intel rows there is genuinely nothing
unrankable — and the type-level fix that would delete them is the same shape as
a coverage check this repo already found vacuous by plant-and-revert, because
both its sides derived from one tuple.

**Revival trigger:** `ClassifiedRow.distance` becomes a union type for some
other reason, at which point both checks become statically provable and can go.

### Known-bad, carried so it is not rediscovered

#### `~/.pi/agent/mcp.json` `approveTools` has the retired underscore spelling

`basic_memory_move_note` and `basic_memory_delete_*` never match the real
`basic-memory_*` names, so that approval gate is partly inert. `*_delete_*` still
catches deletes by luck. Outside this repo, so not fixable from here.

**Revival trigger:** next time that file is edited for any reason.

#### The INSTALLED agent copies still carry the retired underscore spelling

`~/.pi/agent/agents/knowledge-gardener.md` lists `basic_memory_search_notes` and
siblings; the installed `finding-verifier.md` has `basic_memory_*` and
`hyper_mcp_context7-*`. The server keys in `mcp.json` are `basic-memory` and
`hyper-mcp`, so those names register nowhere and are **dropped silently** — the
0.34.0 defect, still live in the installed copies. The repo's own `agents-pi/`
files are clean (they carry no direct names at all), so this is install drift
rather than a source bug, and `/vpk-sync` overwrites them.

**Revival trigger:** it resolves itself the moment the Next-step pass runs and
the profiles are re-synced. Listed so it is not rediscovered as a source bug.

#### A stray frontmatter line silently truncates a tool list

`parseFrontmatter` in the port script flushes a pending block list when it meets
any line that is neither a list item nor a `key: value`, so a malformed file ports
a shorter `tools:` list with no complaint. Since `tools:` is a complete allowlist,
a dropped entry is a capability the agent silently does not have. Conservative,
but it fails in the quiet direction — this repo's recurring shape. Pinned by a
test rather than fixed.

Re-measured 2026-08-28 and unchanged: `tools:` with `- a`, a stray prose line,
`- b` yields `["a"]`. The 0.34.1 regex narrowing fixed only the separate problem
of `https://…` parsing as a key — the unconditional flush above it still
truncates, and the in-file comment claiming otherwise has been corrected, since
a comment saying a bug is fixed is worse than the bug.

**Revival trigger:** the parser gains a caller that does not hand-review its
output, or a real agent file acquires a wrapped frontmatter value.

---

## Standing constraints

Not tasks — rules that hold until upstream changes.

- **Never use `tools: none`.** An empty or `none` tool list resolves to **all
  seven builtins, including `write` and `edit`** — the exact opposite of the
  documented "no tools at all".

  The mechanism matters, because an earlier version of this entry cited the
  wrong pair of files. It named `agent-types.ts:98` and
  `create-subagent-session.ts:220` as disagreeing; they do not — `:220` passes
  `cfg.toolNames`, which is already `:98`'s resolved output, so there is one
  path, not two. The real disagreement is between `custom-agents.ts` (`none` or
  empty → `[]`, meaning "nothing") and `agent-types.ts:98`, which turns that
  `[]` into the full builtin set. Lifts when upstream reconciles those two.

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
