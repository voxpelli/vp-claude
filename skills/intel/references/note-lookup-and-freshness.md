# Check for Existing Note + Freshness

Shared by both `/intel` families. Loaded from Step 1 (check existing note). The
freshness fast-path differs by family — see the per-family `<60 days` rows.

Fast existence check first (no content loaded):
```
list_directory(dir_name="<ecosystem-dir>", file_name_glob="*<sanitized-name>*")
```
(Single-identifier calls use this per-name glob; batch mode replaces it with
one full directory listing per ecosystem — see the shared reference's
*Batch orchestration* in `upgrade-haul.md`.)
For `plugin:`/`skill:` two-part addresses, `<sanitized-name>` is the **leaf** segment —
the last `/`- or `#`-segment (e.g. `impeccable` for `plugin:pbakaus/impeccable#impeccable`) —
so the glob matches a note titled either with or without a namesake suffix.

If found, read the existing note to understand what's already documented:
```
read_note(identifier="<prefix>-<name>", include_frontmatter=true, output_format="json")
```

**Freshness check:** Scope research based on note age (check `updated_at`):

| Note age | Sources to run | Sources to maybe run | Sources to skip |
|----------|---------------|---------------------|-----------------|
| Missing or >180 days | All (full pipeline) | — | None |
| 60–180 days | All except Raindrop | DeepWiki | Raindrop |
| <60 days (**package** family) | Tavily + changelog + Socket | Context7, Readwise, DeepWiki | Raindrop |
| <60 days (**tool** family) | Tavily + changelog | Readwise, DeepWiki | Raindrop |

**"Maybe run" semantics.** A source in the "maybe run" column is not run by
default. Run it only when one of these conditions is met:

- **Changelog trigger:** the changelog step reveals a **major or minor version
  bump** since the last note (new API surface, new features, or breaking changes
  worth documenting).
- **Unresolved questions:** the existing note has `[gotcha]`, `[limitation]`,
  or `[security]` observations that need deeper investigation, or the research
  so far has unanswered questions.
- **Explicit user request:** the invocation is a deep-dive (e.g. the user asked
  for detailed research on a specific aspect), not a routine refresh.

If none of these conditions apply, skip the "maybe run" sources and proceed
with the "Sources to run" column only.

**The matrix models staleness, not WRONGNESS — and a wrong note overrides it.**
Every row above scales effort by how long ago the note was written, which assumes
the note was right when written and has merely aged. A note can instead be
*incorrect*: a mechanism described backwards, a capability it never had, a claim
whose version-gating has since inverted. Age says nothing about that, and a
recently-written note is no safer — it has simply been wrong for less time.

A four-note batch found two such notes, so treat this as the expected rate on a
mature graph, not an edge case.

**When any source contradicts an existing observation — not merely supersedes it
— stop treating the run as a refresh and run the full pipeline regardless of
age.** A refresh-tier run is scoped to confirm and extend; it will not look hard
enough to establish which of two conflicting claims is true. Then:

- **Verify against PRIMARY source before rewriting** — the implementation, the
  spec, the changelog entry at the relevant tag. Not a doc-AI summary, which is
  a plausible-sounding second opinion and may describe a different version than
  the one in play.
- **Correct the observation in place; do not append the correction beside it.**
  Two contradictory observations leave the reader to adjudicate, and the wrong
  one keeps getting cited.
- **Record what the claim was and why it was wrong**, not just the new value. A
  bare correction invites the same wrong conclusion to be re-derived from the
  same evidence.

Always run the changelog step — version history moves fast. **(package family)**
Always fetch download counts too — they change weekly and stale numbers mislead.

Note any previous `[gotcha]`, `[limitation]`, or `[security]` observations —
these should guide which sources to prioritize and what edge cases to look for
in new research.

Append new observations rather than overwriting.

**Audit-context stale-handling branch:** If this invocation was triggered
from an audit-driven workflow (signaled by the caller — e.g. an audit
context arg like `audit-source=gardener-drift`, an `AUDIT_CONTEXT` env
var, or an explicit "from audit findings" annotation in the user
message), the audit's notion of freshness may already be stale by the
time research begins. Before launching enrichment:

1. Re-read the existing note as above (`read_note(..., output_format="json")`).
2. Recompute the freshness tier from the *current* `updated_at`, not the
   value the audit captured. Audits have a ~30-minute wall-clock
   staleness window in practice — another agent or a manual `/intel`
   run may have refreshed the note between audit and this invocation.
3. If the recomputed freshness is `<60 days`, narrow the source pipeline
   per the freshness table above (run Tavily + changelog + Socket for package,
   Tavily + changelog for tool; "maybe run" sources only if conditions are
   met). Do NOT re-run the full pipeline just because the audit said the note
   was stale.
4. If the audit's stated drift fact (e.g. "version X.Y.Z behind upstream
   A.B.C") no longer matches what the re-read reveals, abort with
   `"stale audit input — note already current at <version>; no refresh
   needed"` and return without writing. The calling agent
   (knowledge-maintainer Section 3b) will surface this as a skip in its
   summary.

This branch is a no-op for direct user invocations (`/intel brew:bat`
with no audit signal) — the freshness check above runs unchanged.
