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

| Note age | Sources to run | Sources to skip |
|----------|---------------|-----------------|
| Missing or >180 days | All (full pipeline) | None |
| 60–180 days | All except Raindrop | Raindrop |
| <60 days (**package** family) | DeepWiki + Context7 + changelog + Socket | Tavily, Raindrop, Readwise |
| <60 days (**tool** family) | DeepWiki + changelog | Tavily, Raindrop, Readwise |

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
   per the freshness table above (skip Tavily, Raindrop, Readwise). Do NOT
   re-run the full pipeline just because the audit said the note was stale.
4. If the audit's stated drift fact (e.g. "version X.Y.Z behind upstream
   A.B.C") no longer matches what the re-read reveals, abort with
   `"stale audit input — note already current at <version>; no refresh
   needed"` and return without writing. The calling agent
   (knowledge-maintainer Section 3b) will surface this as a skip in its
   summary.

This branch is a no-op for direct user invocations (`/intel brew:bat`
with no audit signal) — the freshness check above runs unchanged.
