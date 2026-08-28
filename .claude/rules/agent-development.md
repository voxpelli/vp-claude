---
paths:
  - "agents/**/*.md"
  - "agents-pi/**/*.md"
---

# Agent development rules

Loads when editing an `agents/**` file. The root `CLAUDE.md` keeps only a
one-line index of the five agents; the full detail and the frontmatter rules
live here.

## Agent inventory (full detail)

- **knowledge-gardener** — Read-only autonomous auditor: inventory, schema validation, orphan detection, relation integrity, stale/duplicate notes (step 5), version drift (step 5b — MCP enumeration + per-ecosystem `fetch-<eco>-upstream.sh` for API facts across brew/npm/cask/crate/vscode, emits `### Version Drift — <eco>` report sections; 2-D age×semver-distance bucketing, tap routing brew-only), cross-project consistency, tag alignment (step 8), fourth-wall note quality (step 10), source-URL provenance nudge (step 11 — informational, emerging-convention). Preloads `vp-note-quality` skill for audit guidance. **Never writes or modifies notes.**
- **knowledge-maintainer** — All-in-one write agent (`effort: high`, `model: inherit`) that acts on audit findings. Auto-fixes structural issues (missing sections, broken frontmatter, orphan linking, tag alignment, fourth-wall violations). Confirms before content changes (merging duplicates, rewriting prose, archiving). Auto-runs `/intel` for Tier 1 undocumented packages (3+ imports) and `/intel` for undocumented tools from detected manifests. For gardener-flagged version drift, section 3b is a **queue, not an actor**: it never invokes `/intel` itself — every `Drifted >30d` target (and any target with a prior `[security]` observation, regardless of bucket) is emitted as one line in a Refresh Queue report (Routine lane, or a HIGH PRIORITY / IMMEDIATE ACTION lane for the security-flagged override) for a human to action afterward; `Archive candidates`, `Drifted <30d`, `Drifted, age unknown`, and `Unparseable` surface under the approval queue instead. Since nothing executes automatically, there is no partial-failure handling to speak of — the only failure mode is a stale queue entry, guarded by a mandatory pre-enqueue re-read of each target. Preloads `vp-note-quality` skill. `delete_note` and `write_note` intentionally excluded — use `move_note` to `archive/`, delegate new notes to `/intel` via `Skill`. For maximum quality, invoke from an Opus session — `model: inherit` propagates the parent model. Reactive only — user must explicitly invoke.
- **knowledge-primer** — Autonomous read-only agent that surfaces project-relevant BM knowledge before work begins. Scans project manifests, cross-references deps against BM, scores relevance, produces a context brief with key gotchas, and sweeps graph-wide observations for critical warnings from non-dependency notes. The "before work" counterpart to `/session-reflect`.
- **raindrop-gardener** — Read-only Raindrop tag auditor: library dashboard, tag inventory, naming violations, near-duplicates, mistagged bookmarks (via `find_mistagged_bookmarks`), orphan tags, legacy tag identification, co-occurrence analysis, non-primary-language tag detection, taxonomy gaps. Produces a structured report with exact `update_tags`/`delete_tags` tool calls as copy-paste recommendations. **Never modifies tags or bookmarks.**
- **finding-verifier** — Read-only adversarial claim verifier: takes a set of claims/findings (from notes, research, or port decisions) and checks each against the strongest primary source — registry APIs, GitHub source, live behavior, official docs, web, user-library prior art — returning APPROVE/REFUTE/PARTIAL/UNVERIFIABLE verdicts with evidence, a verified-vs-inferred distinction, and a prioritized note-tweak list. Tool selection is claim-type-driven (the tool-list-hygiene rule applies per claim type, not per invocation). **Never writes or modifies notes.**

## The `agents-pi/` port

`agents-pi/` holds the same five agents in **pi-subagents** frontmatter. It is a
separate directory rather than a build artifact because the body adaptation is
semantic and hand-reviewed; only the frontmatter is mechanical.

**Why it has to exist.** The canonical `agents/` files are Claude-Code-shaped and
produce a **zero-tool agent** if handed to pi verbatim. Pi's loader reads only
`name`/`description`/`tools`/`model`/`thinkingLevel`; it does not understand
`mcp__server__tool` names or capitalized builtins (`Bash`, `Glob`), and
`model: inherit` breaks it outright. So a copy silently yields an agent that can
do nothing — the failure is quiet, which is exactly why it needs a guard.

**The port pipeline.**

- `scripts/port-agent-frontmatter.mjs agents/<name>.md` — frontmatter only, to stdout.
- `scripts/port-agent-to-pi.mjs agents/<name>.md` — frontmatter plus mechanical body
  adaptation, and stamps `portedFrom: <sha256-prefix>` of the canonical body.
- `npm run check:agent-parity` — fails when a canonical agent has no port, or when a
  port's `portedFrom` no longer matches the canonical body.

**`agents/` is the source of truth.** Change an agent there, re-run the port, then
re-apply the hand fixes — never edit an `agents-pi/` file to diverge from its
canonical twin, or the parity guard will keep flagging it forever.

**The parity guard hashes the BODY only.** Frontmatter is outside the hash on
purpose: `tools:` is host-shaped, not content. Do not "fix" this by extending the
hash to the whole file.

**Keep `tools:` portable.** Every MCP reference ports to the `mcp` proxy, which
exists on any pi install. Flattened direct names (`basic-memory_read_note`) exist
only when a host sets `directTools`, so baking this machine's names into a
committed file ships a config that is wrong for everyone else. Resolving them per
host belongs at sync time in `extensions/`, not at port time.

**The Pi extension syncs from `agents-pi/`, not `agents/`** — see
`extensions/agent-sync.js` and `docs/pi-setup.md`.

## Agent frontmatter

Required fields: `name`, `description`, `model`, `color`, `tools`. Optional fields: `skills` (preloaded skill content), `effort` (`low`/`medium`/`high`/`max`). The `tools` field is a YAML list of allowed tool names. The knowledge-gardener must remain read-only — never add `write_note`, `edit_note`, or `delete_note` to its tools list. The knowledge-maintainer has write access (`effort: high`) but must confirm before content-level changes.

### Description field: prose triggers, not `<example>` XML

The Claude Code spec documents an escaped `<example>...</example>` XML-in-YAML
convention for agent frontmatter `description` fields. **This project deviates
from that spec convention** and uses prose triggers instead — a single quoted
YAML string, no embedded XML:

```yaml
description: "Use this agent when <the general trigger condition>. Typical
  triggers include: <comma or semicolon list of trigger phrases, quoted or
  paraphrased from real user requests>. <One sentence stating any safety-
  relevant routing contrast — e.g. read-only vs write-capable — if the agent
  has a sibling agent it could be confused with>. See \"When to invoke\" in
  the agent body for worked scenarios."
```

Precedent for this shape already exists in the installed-plugin ecosystem —
`pr-review-toolkit`'s agents (e.g. `code-reviewer`) use a single-line prose
description ending with a pointer to a body `## When to invoke` section;
`vp-beads`'s `sprint-review` uses a quoted single-line "Use this agent
when... Also trigger proactively when... Do NOT trigger during..." prose
form. This project's convention combines both: a quoted prose description in
frontmatter, plus a `## When to invoke` section in the body.

`VOICE.md` at the plugin root governs the *tone* of the description's first
sentence (garden-metaphor framing where a fitting verb exists) — consult it
whenever a description is rewritten, not just when adding a fifth agent.
`VOICE.md` is silent on the frontmatter *structure* (prose vs. `<example>`
XML); this section is the structural authority.

**Body companion section:** every agent's body must include a `## When to
invoke` section (placed early, right after the introductory paragraph(s) and
before the agent's procedural sections) that expands the frontmatter
description into the fuller scenario detail an `<example>` block used to
hold — typically 3-4 bullets, each naming a representative user request and
what distinguishes it from a sibling agent's scenarios. This is where the
detail that prose frontmatter can't hold lives, without polluting the
frontmatter itself.

**Preserve routing contrasts.** Where two agents in this plugin could be
confused for one another on a given request (e.g. knowledge-gardener
read-only auditor vs knowledge-maintainer sole writer), both the frontmatter
description AND the `## When to invoke` section must make the distinction
unambiguous — this is a safety-relevant signal, not just a style
preference, since a caller must not launch a write-capable agent when a
read-only one was intended, or vice versa.

Color assignments and the agent description-tone conventions live in `VOICE.md` at the plugin root. Consult it before adding an agent or rewriting an existing description.

## See also

- Tool-list hygiene (every tool in `tools` must be called; phantom-tool audit) also applies to agents → `skill-development.md`.
- The read-only enforcement for gardener agents combines the `tools` allowlist with the `PreToolUse` Bash-blocking hook → `hook-development.md`.
