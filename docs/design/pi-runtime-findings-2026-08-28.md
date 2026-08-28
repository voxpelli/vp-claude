# Pi runtime findings — the port targets a runtime that was replaced

**Date:** 2026-08-28
**Status:** findings verified against installed source; remediation not yet scoped
**Trigger:** a wrap-up review of `voxpelli/link-integrity` before releasing 0.34.0

`agents-pi/` and the `extensions/` MCP-mapping guidance were designed and
verified against `@narumitw/pi-subagents`. That package was replaced on this
machine on **2026-08-21** by `@gotgenes/pi-subagents` (a hard fork of the
`@tintinweb` lineage, not of narumitw) plus `@gotgenes/pi-permission-system`.
Installed version confirmed here: **`@gotgenes/pi-subagents` 19.3.5**.

Nothing in `npm run check` could have caught this. Every guard in this repo
verifies that two *documents* agree; none of them talks to the runtime.

## 1. The flattened MCP names are wrong for most servers — VERIFIED

`extensions/mcp-mapping.js`'s `flattenMcpToolName()` derives a direct-tool name
by replacing hyphens in the server segment with underscores. The live registry
at `~/.pi/agent/tool-registry.json` (written 2026-08-28) shows the adapter does
**not** do that: it preserves the server key verbatim.

Measured against the live `mcpDirect` list, 6 of 10 sampled derivations miss:

| Claude name | derived | actually registered |
|---|---|---|
| `mcp__basic-memory__search_notes` | `basic_memory_search_notes` | `basic-memory_search_notes` |
| `mcp__basic-memory__read_note` | `basic_memory_read_note` | `basic-memory_read_note` |
| `mcp__basic-memory__build_context` | `basic_memory_build_context` | `basic-memory_build_context` |
| `mcp__basic-memory__list_directory` | `basic_memory_list_directory` | `basic-memory_list_directory` |
| `mcp__socket-mcp__depscore` | `socket_mcp_depscore` | `socket-mcp_depscore` |
| `mcp__hyper-mcp__context7-query_docs` | `hyper_mcp_context7-query_docs` | `hyper-mcp_context7-query_docs` |

`deepwiki`, `raindrop`, `readwise` and `huggingface` happen to match, because
those server keys contain no hyphen. **Every `basic-memory` tool is wrong** —
the server this entire plugin is built around.

The derived names are not merely unused: `extensions/index.js`'s
`buildMappingGuidance()` states the transform rule as fact in the injected
system prompt, and `docs/pi-setup.md` repeats it. So the extension actively
tells the model to call tools that do not exist.

**The adapter exports the real function.** `pi-mcp-adapter@2.30.0` publishes
`formatToolName(tool, server, prefix)` and `resolveToolPrefix(...)` from its
`pi-mcp-adapter/types` subpath — so the mapping never needed reimplementing.
Its `sanitizeServerPrefix` keeps `-` in the valid-character class under the
default `"server"` prefix mode, which is why the hyphen survives. The local
JSDoc asserting the underscore behaviour is wrong in the same way the code is.

For enumeration rather than derivation, the authority is `pi.getAllTools()` at
runtime. The sibling repo reached that from the other direction and recorded it
in `extensions/pi-agent-definition-refiner/lib/registry.js`: the convention is
not a simple rule (`readwise_readwise_search_highlights` double-prefixes;
`hyper-mcp` keeps hyphens), and `mcp-cache.json` goes stale.

## 2. `tools:` is a complete allowlist, not a filter — VERIFIED at source

`@gotgenes/pi-subagents` 19.3.5 `docs/configuration.md`: `tools` is "the agent's
**complete tool allowlist**", and omitting it grants the seven builtins and no
extension tools. The seven builtins per the live registry are
`read, write, edit, bash, grep, find, ls`.

Consequences for what is currently shipped:

| Agent | `tools:` | consequence |
|---|---|---|
| `knowledge-gardener` | `mcp, bash, find, ls` | **no `read`, no `grep`** — cannot read a file |
| `raindrop-gardener` | `mcp` | proxy only; no filesystem tools at all |
| `knowledge-primer` | `read, find, ls, mcp` | no `grep` |
| `knowledge-maintainer` | `read, find, ls, mcp` | no `grep` |
| `finding-verifier` | `mcp, bash, find, ls, grep, read` | complete |

`mcp` **is** a registered extension tool here, so **every name in every
committed `agents-pi/` file resolves** — nothing is dropped and no agent is
inert. The port dodged the flattener bug precisely because it names the proxy
rather than direct tools. They are under-equipped, not broken.

The same cannot be said of the **installed copies**. `~/.pi/agent/agents/*.md`
has drifted from the repo: `knowledge-gardener.md` there lists four dead
`basic_memory_*` names out of eight entries, and `finding-verifier.md` seven
dead of fifteen — the flattener's output, applied at some point and never
validated. `check:agent-parity` compares the canonical *body* hash and never
looks at tool names, so it cannot see this. The same wrong forms appear in
`~/.pi/agent/mcp.json`'s `approveTools`, making that approval gate silently
inert too.

The drop is genuinely silent: `setActiveToolsByName` skips any name absent from
the registry with no warning, and an all-unknown list yields `state.tools = []`
— an agent that launches and can do nothing. One separate hazard is *not*
silent: `parseFrontmatter` is unguarded in `loadFromDir`, so malformed YAML in
one agent file throws and takes the whole agent registry down.

## 3. `mcp` is a write channel, so "read-only" is unenforced on Pi

The `mcp` proxy reaches every configured server, including every Basic Memory
write tool. Four agents that this repo documents as read-only
(`knowledge-gardener`, `knowledge-primer`, `raindrop-gardener`,
`finding-verifier`) therefore have an unrestricted write path under Pi. The
Claude-side guarantee is a `tools` allowlist plus a `PreToolUse` Bash-blocking
hook; neither exists in Pi. `knowledge-gardener` additionally carries `bash`.

`../pi-extensions` had already reached this conclusion independently —
`extensions/pi-plan-bridge/DESIGN.md` §5 names these four agents and calls for
`permission: { "*": deny, ... }` plus dropping `mcp` before they may join its
bridge allowlist. That review is dated 2026-08-24 and this repo was unaware of it.

## 4. Dead and mis-sized frontmatter keys

- **`thinkingLevel: high` is ignored** by the gotgenes lineage; only `thinking`
  is read. Harmless here only because both are present.
- **`name:` is ignored** — gotgenes derives the agent type from the *filename*.
- **`max_turns: 20` is authoritative and locked**: `invocation-config.ts` reads
  `agentConfig?.maxTurns ?? params.max_turns`, so a caller cannot raise it.
  Enforcement is a wrap-up steer at turn 20 and a hard abort at 25
  (`graceTurns: 5`), surfacing only as `steered`/`aborted` in the lifecycle
  event — not as an error to the caller. This machine's `subagents.json` sets
  `defaultMaxTurns: 40`, so the file caps *below* the default it would
  otherwise inherit. For `knowledge-gardener` (a ten-check graph-wide audit)
  and `knowledge-maintainer` (heavy remediation) that is a live truncation
  risk. The installed `finding-verifier.md` already carries `max_turns: 40`,
  so someone has hit this before.
- **`portedFrom` is silently ignored**, which is what makes it safe as a drift
  marker.

## 5. There is no `ext:` selector

Checked against `docs/configuration.md` §Tool selection: the accepted forms are
comma-separated names, a YAML flow sequence, a block sequence, or `none`. No
wildcard, no `all`, no `ext:<extension>`. A declarative "give this agent the MCP
adapter's tools" is therefore not available — names must be enumerated.

## What this means for the runtime-resolution proposal

Resolving names per host is the right direction, but the input must be
`pi.getAllTools()`, not `~/.pi/agent/mcp.json`. Reading mcp.json alone is
strictly worse than the status quo: it is four-file precedence-ordered, supports
an `imports` key that adopts config from other hosts, and `directTools: true` is
not a name list. Two guards the sibling repo learned the hard way apply:

- **Do not write a degenerate enumeration over a good one.** At `session_start`
  the adapter may not have registered yet; an empty result must be rejected,
  not cached.
- **Do not let a subagent write the shared cache.** A child enumerates only its
  own restricted allowlist. `PI_SUBAGENT_DEPTH` is the detector.

## Corrections to earlier assumptions in this repo

- `session_start` **does** fire in subagent workers. The sibling repo's code
  guards against exactly that, which would be dead code otherwise. The
  `startupMaintenanceDone` latch in `extensions/index.js` is per-process and so
  does not prevent a worker from re-running the sync.
- The superset-frontmatter approach is a deliberate choice, not a default. The
  sibling repo explicitly disowns it for a single-flavor environment.

## 6. The permission system, verified at source

Read from the installed `@gotgenes/pi-permission-system` 27.1.1 before designing
against it, because the obvious block shape turned out to be wrong twice.

**`permission:` frontmatter IS read from `~/.pi/agent/agents/`.**
`permission-manager.ts:177-190` loads four scopes unconditionally and merges them
lowest-to-highest: `global → project → agent → project-agent`. The global-agents
scope reads `join(getAgentDir(), "agents")/<name>.md`. The agent is identified by
the `<active_agent name="…"/>` tag, which `@gotgenes/pi-subagents`
(`src/session/prompts.ts:45`) really emits using `basename(file, ".md")` — the
exact string the policy loader joins. A per-agent block **does** override a
global `"*": "allow"`. So the blocks enforce; they are not decorative.

**Trap 1 — `mcp: {"*": deny}` deletes the tool rather than narrowing it.**
`before_agent_start` filters the tool set through `getToolPermission(toolName)`,
which evaluates the surface against the **literal pattern `"*"`**
(`permission-manager.ts:263-268`). Matching is anchored whole-string, so
`"*recent_activity*"` does not match the string `"*"` — the only rule that fires
is `"*": deny`, the `mcp` proxy is stripped before the agent starts, and every
sibling `allow` becomes unreachable. For `raindrop-gardener`, whose entire
`tools:` is `mcp`, that is an agent with zero tools. **Use `"*": "ask"`.**

**Trap 2 — a colon in a pattern key is silently discarded.** Agent frontmatter
goes through a hand-rolled parser that splits on the FIRST colon
(`yaml-frontmatter.ts:15-24`), so `"basic-memory:recent_activity": allow` parses
to `{"basic-memory": "recent_activity\": allow"}` and is then dropped as an
invalid decision value. No error. Never write a `server:tool` pattern in
frontmatter — use the underscore form or a `*…*` glob. It works in `config.json`,
which is real JSON.

**Grammar facts to build on:**

- An `mcp` call matches against a candidate *list*, most-specific first:
  `server_tool`, `server:tool`, `server`, `tool`, `mcp_call`, `mcp`.
- Patterns are anchored whole-string globs — `*` → `.*` under the dotAll flag,
  `?` → one character. Not minimatch, not prefix matching. A pattern ending
  `" *"` makes the argument tail optional, so `"bm *"` also matches bare `bm`.
- `bash` is decomposed before matching: tree-sitter splits `bm x; rm -rf /` into
  units and the most restrictive wins, so `"bm *": allow` cannot be ridden by
  chaining, and a `sudo`/`eval` wrapper is floored to `ask`.
- Decisions are exactly `allow` / `deny` / `ask` (plus `{action:"deny",reason}`).
  Anything else — `"Allow"`, `"warn"` — is dropped silently.
- Never write a per-agent `"*": "allow"` inside a surface map: it lands last, and
  last-match-wins defeats lower-scope specific denies.

**Flattened direct tools are gated, but not by `mcp:`.** `classifyToolKind`
returns `"mcp"` only for the literal name `mcp`; a flattened name is `"extension"`
kind and normalizes to `{surface: <toolName>, values: ["*"]}`, so it falls to the
universal `"*"` fallback. That is real enforcement — the unclaimed
`tool-approval-request` broker slot does not matter, because every registered tool
passes this extension's `tool_call` hook. To allow specific ones, use their own
name as a top-level surface key; surface keys are themselves wildcards, so
`"basic-memory_*": allow` works.

**Budget consequence:** `"*": deny` also hides `write`, `skill`, `todo_write` and
every flattened MCP tool. Each agent's allow-list must enumerate everything it
actually needs, or it starts crippled.
