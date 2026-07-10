# Decision: deep-intel epic shutdown (with harvest)

**Date:** 2026-07-10 · **Decided by:** user, on assessment · **Status:** decided;
bead closes pending the bd write-lock clearing (upstream Dolt panic — do NOT
attempt `bd` writes before the fix lands)

## Decision

The deep-intel epic (`vp-claude-vqow` + children; complete implementation on the
unmerged `voxpelli/deep-intel` branch) is **shut down as designed**. The
8-phase-workflow shape (Scope → Search → Fetch → Draft → per-claim Verify →
Critic → Finalize → Extend) will not be dogfooded, released, or remediated.

## Rationale

1. **Cost shape, now evidence-backed.** Same-day measured workflow runs in this
   repo: 5 recon agents ≈ 420k subagent tokens; 7 synthesis agents ≈ 560k.
   deep-intel's per-claim verification alone could spawn 20–40 agents per
   researched subject — high-hundreds-of-k to 1M+ tokens per note. Research
   gathered for the tool-intel redesign says the same: complexity gains carry
   steeply non-linear cost (<https://hf.co/papers/2508.02694>), homogeneous
   multi-agent wastes compute vs one well-run agent
   (<https://hf.co/papers/2601.12307>), and multi-agent research runs ~15× a
   normal chat
   (<https://www.zenml.io/llmops-database/building-a-multi-agent-research-system-for-complex-information-tasks>).
2. **Mechanism value superseded.** The tool-intel next-gen design
   (`docs/design/tool-intel-next-gen.md`) ships the same mechanisms leaner:
   ground-truth-fetch verification with fail-closed rules (`verify-claims.md`),
   two-gate write discipline, supervisor/worker haul orchestration, foreground
   curation. The "shared `--verify` for intel skills" future (vqow.6) is better
   served by extending that contract than by deep-intel's heavier topology.
3. **Its own escape hatch concedes the point.** deep-intel's `--quick` mode
   (skip verify/critic/extend) collapses to a foreground skill — the workflow
   machinery is dead weight for the common case even inside its own design.
4. **Remaining unique value is modest.** Type-targeted research for the six
   knowledge note types is a real gap, but `/deep-research`, `memory-research`,
   and `/session-reflect` cover most of it today.

## Harvest (what survives the shutdown)

- **Platform facts, already operational practice:** MCP-calling workflow agents
  must be Sonnet+ (Haiku cannot ToolSearch-load `mcp__*` tools); allowlist the
  exact live MCP tool names; foreground curation → `args.curatedResults` seam.
  All three were applied in the 2026-07-10 tool-intel workflows.
- **Reference material on the archived branch:** `verification-topology.md`
  (portable verdict contract), `synthesis-profiles.md` (per-type angle sets +
  observation shapes), `research-workflow.md` (schema catalog).
- **Branch disposition:** `voxpelli/deep-intel` is kept unmerged as a read-only
  archive. No deletion without explicit user approval.

## Revival recipe (drop-with-trigger, per plan hygiene)

**Trigger:** real recurring demand for knowledge-type research — e.g. repeatedly
reaching for `/deep-research` to create BM `service`/`concept`/`standard` notes.

**Shape on revival:** a LEAN FOREGROUND skill (people-intel shape: 5–6 sources,
single session, no workflow), taking its type-targeted angle sets from the
archived `synthesis-profiles.md`, with verification as an opt-in flag reusing
tool-intel's `verify-claims.md` contract. **Never revive the 8-phase workflow.**

## Bead dispositions (execute when bd write-lock clears; verify every close with `bd show`)

| Beads | Disposition | Close reason (template) |
|---|---|---|
| `vqow` (epic), `.2` `.3` `.4` `.5` (sprints/release), `.9` `.10` `.11` `.12` `.14` `.15` `.16` `.17` `.18` `.21` `.23` `.24` `.25` `.26` `.27` (workflow build + remediation chain) | Close | "Epic shut down 2026-07-10 — superseded by tool-intel next-gen design; cost shape unjustified. See docs/design/deep-intel-shutdown.md" |
| `.6` (shared --verify) | Close when tool-intel Wave 4 ships | "Fulfilled by skills/tool-intel/references/verify-claims.md (tool-intel next-gen Wave 4)" |
| `.7` `.13` (calibration harness / false-confirm rate) | Close | "Superseded by verify-claims.md's spot-check calibration discipline" |
| `.8` (in-place correction of contradicted observations) | Close | "Superseded by verify-claims.md's drifted→CORRECT action rule" |
| `.12` (source-quality stake bump) | Close | "Superseded — stake/escalation handled by verify-claims.md's escalation ladder" |
| `.19` `.20` (model-tier + allowlist platform facts) | Close | "Absorbed into operating practice + tool-intel design; facts recorded in docs/design/tool-intel-next-gen.md" |

Total: 26 open/in_progress beads dispositioned (epic + 25 children; `.1`/`.22`
were already closed).
