# Roadmap: vp-knowledge

> What this plugin is for: higher-level Basic Memory workflows — package and
> tool research, graph maintenance, coverage and drift audits — built on top of
> the upstream `memory-*` skills rather than duplicating them. The product is
> markdown an agent executes, so a wrong sentence is a behavioural bug.

Deferred work lives here with the trigger that would revive it. A drop without
a trigger loses its revival path and becomes accidental debt, so every entry
below says what would bring it back.

`bd` is this repo's tracker, but its write path is unreliable (see
[CLAUDE.md](CLAUDE.md#task-tracking)) and `.beads/` is gitignored, so the
backlog does not travel with a clone. This file is the durable, committed
counterpart for work that must survive a session.

---

## ▶ Next step (2026-08-28): verify the hardening, then ship 0.34.0

The 0.34.0 wrap-up found that `agents-pi/` and the extension's MCP-mapping
guidance were built against `@narumitw/pi-subagents`, replaced on 2026-08-21 by
`@gotgenes/pi-subagents` 19.3.5 — a hard fork of a different lineage. No check
here could notice: every guard verified that two *documents* agreed, and not one
talked to the runtime. The verified record is
[docs/design/pi-runtime-findings-2026-08-28.md](docs/design/pi-runtime-findings-2026-08-28.md).

**How to update this section** — when the next step is started or completed, or
when a state change makes it stale, replace the title and date (keeping the
`## ▶ Next step (date): <title>` shape), rewrite the content, and re-derive the
sequence. Keep the structure — single action, then why, then what comes after.

**Done, 2026-08-28:** the naming rule was corrected in all four places that
carried it (`flattenMcpToolName`, the injected guidance, the recovery message,
and the port generator's own second implementation), pinned against a captured
registry fixture whose authenticity guard is itself plant-and-revert tested; six
paths where a real Basic Memory write bypassed the quality checks were closed;
and a CLI entry guard that exited 0 without running was fixed in three scripts.

**The single next action is the Pi-side permission hardening** — `permission:`
blocks on the four read-only agents, so their read-only claim is enforced by the
host rather than promised in prose. Verification is complete and the block shape
is settled: `permission:` frontmatter *is* read from `~/.pi/agent/agents/` as a
merge scope above global and project config, but `mcp: {"*": deny}` strips the
proxy tool entirely at `before_agent_start` (use `ask`), and a pattern key
containing a colon is silently discarded by a hand-rolled parser.

**Why this next:** four agents documented as read-only currently reach every
write tool on every server through the `mcp` proxy. That is the largest gap
between what this plugin says about itself and what it enforces.

**After it, in order:** the deferred items below, starting with runtime tool-name
enumeration (#1), which is also the trigger for the generator redesign (#11).

---

## Deferred

### 1. Resolve MCP tool names at runtime, not by transform

Read `pi.getAllTools()` and inject a table of the host's real names instead of
a rule the model must apply. This is the correct long-run answer: the adapter's
naming convention has been renegotiated repeatedly (`readwise_*` double-prefixes,
`hyper-mcp` keeps hyphens), so any local transform is a snapshot of a moving
target.

Two guards are mandatory, both learned the hard way in `../pi-extensions`:
reject a degenerate enumeration rather than caching it over a good one (at
`session_start` the adapter may not have registered yet), and never let a
subagent write the shared cache — a child enumerates only its own restricted
allowlist. `PI_SUBAGENT_DEPTH` is the detector.

**Revival trigger:** the transform breaks again, or a second host with
different `directTools` needs supporting.

### 2. Widen `mcp.json` `directTools` so `mcp` can be dropped

Both `../pi-extensions` and the knowledge graph recommend removing the `mcp`
proxy from the read-only agents, since it reaches every write tool on every
server. They are right about the shape and wrong about the order: on this
machine `raindrop-gardener` needs four raindrop tools that are not
`directTools`, and `knowledge-gardener` needs `recent_activity` and the three
`schema_*` calls, none of which are either. Dropping `mcp` first makes three
agents non-functional.

**Revival trigger:** `directTools` covers every call the read-only agents make,
**and** V3 confirms the permission system actually gates direct tools — the
adapter's `tool-approval-request` broker slot appears unclaimed.

### 3. `prompt_mode: replace` for the ported agents

The gotgenes default (`append`) wraps the agent body in `<agent_instructions>`
and injects a parent-twin bridge. These bodies are self-contained, so `replace`
is plausibly the better fit — but it changes prompt composition for all five at
once.

**Revival trigger:** an agent's output shows it is confused about its own role;
test on one agent before touching the set.

### 4. `~/.pi/agent/mcp.json` `approveTools` carries the same underscore bug

`basic_memory_move_note` and `basic_memory_delete_*` never match the real
`basic-memory_*` names, so that approval gate is partly inert. `*_delete_*`
still catches deletes by luck. Outside this repo, so not fixable from here.

**Revival trigger:** next time that file is edited for any reason.

### 5. A `general-purpose.md` override as fallback defence

An unknown `subagent_type` falls back to write-capable `general-purpose`, and
the only signal is a line of prose inside the child's own prompt. Shipping a
`general-purpose.md` carrying `permission: { "*": ask }` would turn that silent
downgrade into a visible one.

**Revival trigger:** user decision — it changes behaviour for legitimate
`general-purpose` use, so it is not a default we can pick.

### 6. Move the extension config to the ecosystem convention

`extensions/config.js` reads `~/.pi/agent/extensions/vp-knowledge.json`. That
subdirectory is where pi scans for *extensions*; the convention across the
ecosystem is `~/.pi/agent/<package-name>.json`.

**Revival trigger:** the next breaking release — moving a config path strands
anyone who has written one, so it wants its own version bump and a migration
note.

### 7. `tools: none` is unsafe — do not use it

`agent-types.ts:98` falls back to all seven builtins on an empty list, while
`create-subagent-session.ts:220` passes the empty list straight through. The
two paths disagree, and the documented behaviour ("no tools at all") matches
only one of them.

**Revival trigger:** upstream resolves the disagreement. Until then this is a
standing prohibition, not a task.

### 8. Adopt `@voxpelli/pi-logger` for caught faults

The extension writes three raw `process.stderr.write('[vp-knowledge] …')`
calls. The sibling repo publishes a frozen, dependency-free JSONL logger with
session scoping and a durable `fallbackDir`.

**Revival trigger:** a fault we cannot diagnose from stderr, or that package
being published to npm — taking it is an ASK-FIRST dependency decision either
way.

### 9. `agents-pi/*.md` `tools:` lists are under-provisioned

`tools:` is a *complete allowlist* on the installed runtime, not a filter over
the builtins. `knowledge-gardener` ships without `read` or `grep` — it cannot
read a file; `knowledge-primer` and `knowledge-maintainer` lack `grep`;
`raindrop-gardener` has only `mcp`. They are under-equipped rather than broken,
since `mcp` still reaches everything they currently call.

**Revival trigger:** land with the permission hardening — same files, same pass.

### 10. `max_turns: 20` caps below the machine default

All five files set it. `spawn-config.ts` reads `agentConfig?.maxTurns ??
settings.defaultMaxTurns`, and this machine's `subagents.json` sets
`defaultMaxTurns: 40`, so the file caps *below* what it would otherwise inherit,
and a caller cannot raise it. Enforcement is a wrap-up steer at the limit then a
hard abort five turns later, surfacing as `steered`/`aborted` rather than an
error — so a capped gardener returns a truncated audit that reads like a
complete one. The installed `finding-verifier.md` already carries `40`, which is
someone having hit this before.

**Revival trigger:** same pass as #9, or the first time a gardener run visibly
truncates.

### 11. Generate the Pi agent files at sync time instead of committing them

An architecture review concluded **BUILD-LATER**, having verified the premise:
every `agents-pi/*.md` is its canonical twin's body byte-for-byte plus one
verbatim boilerplate header plus mechanically-derived frontmatter. Nothing in
them is hand-authored, and `.claude/rules/agent-development.md` already forbids
the divergence a committed port would enable — so the artifact's one selling
point is a capability the project has denied itself. Collapsing `agents-pi/`,
both port scripts and `check:agent-parity` into one sync-time generator would
delete more code than it adds and let the tool list be *derived* against the
host's live registry rather than collapsed to the unrestricted `mcp` proxy.

Not now, because a generator built today would have to hardcode another static
server table — relocating the bug this release just fixed rather than removing
it — and because dropping `mcp` first breaks three agents (#2).

**Revival trigger:** runtime enumeration (#1) is wired in with both its guards,
**and** `directTools` covers every call the read-only agents make (#2). Deleting
the port machinery is an ASK-FIRST large removal even once that fires.

### 12. `flattenMcpToolName` is a partial mirror of the adapter's `formatToolName`

It handles the default `"server"` prefix mode for the character set every known
tool name uses. It does not replicate `formatToolName`'s `.`→`_` replacement in
the tool segment, `sanitizeServerPrefix`'s `_<hex>_` escaping for server
characters outside `[A-Za-z0-9_-]`, or the `"short"`/`"none"`/`"mcp"` modes.
`docs/pi-setup.md` telling users to leave `toolPrefix` at `"server"` is the
standing workaround, not incidental advice. The adapter exports
`getToolNameCandidates`, which handles all of it.

**Revival trigger:** a live tool name contains a dot, a server name falls
outside `[A-Za-z0-9_-]`, or taking `pi-mcp-adapter` as a dependency is
reconsidered — it was offered and declined.

### 13. A stray frontmatter line silently truncates a tool list

`parseFrontmatter` in the port script flushes a pending block list when it meets
any line that is neither a list item nor a `key: value` — so a malformed
frontmatter file ports with a shorter `tools:` list and no complaint. Since
`tools:` is a complete allowlist on the installed runtime, a dropped entry is a
capability the agent silently does not have. Conservative behaviour, but it
fails in the quiet direction, which is this repo's recurring shape.

**Revival trigger:** the parser gains any caller that does not hand-review its
output, or a real agent file acquires a wrapped/continued frontmatter value.

---

## Parked elsewhere

Not restated here, to avoid two records drifting apart:

- The **bd-unlock queue** — the deep-intel epic shutdown closes, the tool-intel
  next-gen breakdown, and the adversarial-skill-corrections deferrals. Tracked
  in the local Dolt store and in `docs/design/`; blocked on bd's write path.
- **`docs/design/`** holds the decision records that outlive a sprint. They are
  indexed nowhere else, so a decision recorded there is invisible unless you go
  looking — [intel-corrections-2026-07-28.md](docs/design/intel-corrections-2026-07-28.md)
  has the widest reach.
