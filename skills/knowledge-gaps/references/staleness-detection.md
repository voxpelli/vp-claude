# Staleness Detection — Reference

Use this reference when `/knowledge-gaps` is invoked with the `--stale` flag.
The mode replaces the normal manifest-driven coverage workflow with a focused
upstream-drift check for documented Homebrew formulae. Other ecosystems
(npm, crates, actions, docker, vscode, gh) are Phase 2.

**BM access is via MCP only.** The script `scripts/fetch-brew-upstream.sh`
does the *external* API work (formulae.brew.sh + optional `gh release list`)
and never reads `~/basic-memory/`. This skill collects BM-side data via the
MCP tools and pipes formula names to the script.

The bucket names in S4/S6 below are the same canonical strings the
`knowledge-gardener` Step 5b-iv uses, so a user-invoked staleness report and
an autonomous gardener report are interchangeable as input to the
`knowledge-maintainer` Section 3b.

## Workflow

### S1. Enumerate documented brew notes (MCP)

```
list_directory(dir_name="brew", depth=1)
```

From the returned listing, **keep only titles starting with `brew-`** (filter
out drafts and non-prefixed notes).

If the filtered list is empty, report "No brew notes documented in Basic
Memory yet — nothing to check" and stop. Suggest the user run
`/tool-intel brew:<name>` to seed at least one note first.

### S2. Extract documented version per note (MCP)

For each filtered title (e.g., `brew-bat`), call:

```
read_note(identifier="<title>", include_frontmatter=true, output_format="json")
```

Issue up to 5 concurrent `read_note` calls per turn to keep latency bounded.
Reason about the `content` field to extract the documented version. Three
formats currently coexist in the corpus:

| Priority | Pattern | Example | Cohort |
|---|---|---|---|
| 1 | Formula Details table row | `\| Version \| 0.26.1 \|` | older /tool-intel output |
| 2 | Inline header pipe | `Homepage: ... \| v1.39.0 \| <license>` | newer /tool-intel output |
| 3 | Registry Metadata bullet | `- **Version**: 0.11.13 (Homebrew, ...)` | brew-uv style |

If multiple patterns match in the same note, **use the lowest-priority-number
match.** If none match, record `bm_version="<unparseable>"` and continue.

### S3. Fetch upstream facts via the script

**Strip the `brew-` prefix** from each filtered title before piping — the
script expects bare formula names:

```
Bash("printf '%s\\n' <bare-name1> <bare-name2> ... | bash scripts/fetch-brew-upstream.sh")
```

The script emits NDJSON per name with these fields:

| Field | Type | Meaning |
|---|---|---|
| `name` | string | Formula name (matches input) |
| `upstream_version` | string | `.versions.stable` from formulae.brew.sh; `""` if not in API |
| `homepage` | string | Upstream homepage URL |
| `deprecated` | bool | `true` if formulae.brew.sh marks the formula deprecated |
| `disabled` | bool | `true` if formulae.brew.sh marks the formula disabled |
| `tier` | `"1"` \| `"2"` | API-only vs API + GitHub release timing |
| `days_stale` | int \| null | Days since latest GitHub release (Tier 2 only) |
| `upstream_state` | enum | `ok` \| `deprecated` \| `disabled` \| `not-in-api` \| `api-unavailable` |

`upstream_state` describes the *upstream fact* only — drift is computed by
this skill, in S4, by comparing `upstream_version` against `bm_version`.

### S4. Compute drift and bucket

For each filtered note, combine its `bm_version` (from MCP) with the
script's NDJSON record. **Strip a leading `v`** from either value before
comparison (`v1.39.0` and `1.39.0` are equivalent). Assign to one of these
canonical buckets (same names as gardener Step 5b-iv):

| Canonical bucket | Trigger |
|---|---|
| `Drifted >30d` | versions differ, `days_stale > 30` |
| `Archive candidates` | script `upstream_state="deprecated"` or `"disabled"` |
| `Drifted <30d` | versions differ, `days_stale ≤ 30` |
| `Drifted, age unknown` | versions differ, `days_stale == null` |
| `Unparseable` | `bm_version == "<unparseable>"` (S2 found no pattern) |
| `Tap-only` | script `upstream_state="not-in-api"` |

Within `Drifted >30d` and `Drifted <30d`, sub-sort by `days_stale`
descending so the most overdue refreshes surface first. Records in
`Drifted, age unknown` sort to the end of the drifted section.

### S5. Handle edge cases

- If the script's only NDJSON line has `upstream_state="api-unavailable"`,
  report "Could not reach `formulae.brew.sh` — staleness check skipped" and
  stop.
- If every note resolves to current+OK (no entries in any bucket), report
  "All N documented brew notes are current with upstream." and skip S6.

### S6. Render the report

The bucket names below match the gardener's canonical names exactly. Use
them as `####` sub-headings under a `## Brew Note Staleness` top-level
section:

````markdown
## Brew Note Staleness — N documented notes checked

#### Drifted >30d (M notes — refresh recommended)

| Note | Documented | Upstream | Released | Refresh command |
|------|-----------|----------|----------|-----------------|
| brew-bat | 0.24.0 | 0.25.1 | 47d ago | `/tool-intel brew:bat` |
| brew-deno | 1.45.5 | 2.4.1 | 31d ago | `/tool-intel brew:deno` |

#### Drifted <30d (P notes — recent upstream release)

| Note | Documented | Upstream | Released | Refresh command |
|------|-----------|----------|----------|-----------------|
| brew-uv | 0.11.13 | 0.11.14 | 1d ago | `/tool-intel brew:uv` |

#### Drifted, age unknown (Q notes)

| Note | Documented | Upstream | Refresh command |
|------|-----------|----------|-----------------|
| brew-eza | 0.18.0 | 0.20.5 | `/tool-intel brew:eza` |

#### Archive candidates (R notes)

| Note | Documented | Upstream status | Suggested action |
|------|-----------|-----------------|------------------|
| brew-foo | 1.2.3 | deprecated | `move_note(identifier="brew-foo", new_path="archive/brew-foo")` |

#### Unparseable (S notes)

These notes don't match any of the three known version patterns. Run
`/tool-intel brew:<name>` to refresh and restore the metadata layer.

- brew-bar
- brew-baz

#### Tap-only (T notes — drift check skipped)

These are tap-installed formulae not present in the central Homebrew API.
Drift cannot be checked automatically.

- brew-arm-none-eabi-gcc (likely armmbed tap)
- brew-mcp-netutils (likely patrickdappollonio tap)

#### Summary

- Drifted >30d: M notes — top 5 by overdue days: brew-bat (47d), brew-deno (31d), ...
- Drifted <30d: P notes
- Drifted, age unknown: Q notes
- Archive candidates: R notes
- Unparseable: S notes
- Tap-only: T notes
- Current (no action needed): K notes
````

### S7. Offer batched refresh

If 2 or more notes are in the `Drifted >30d` bucket, offer to run
`/tool-intel` against the top 5 in parallel:

> Want me to refresh the top 5 stale notes (released >30 days ago) now?
> I can run them as parallel `/tool-intel` calls — they're file-disjoint
> so this is safe.

For notes in `Drifted <30d` or `Drifted, age unknown`, ask which to refresh
individually rather than auto-batching — recent releases may be pre-stable
or short-lived. This matches the `knowledge-maintainer` Section 3b routing.

If the user accepts the batch:
```
Skill(skill: "tool-intel", args: "brew:bat")
Skill(skill: "tool-intel", args: "brew:deno")
Skill(skill: "tool-intel", args: "brew:eza")
Skill(skill: "tool-intel", args: "brew:jq")
Skill(skill: "tool-intel", args: "brew:difftastic")
```

For more than 5 `Drifted >30d` items, ask which to prioritize rather than
launching a larger fan-out. Track partial failures: if any `tool-intel`
invocation fails, report which succeeded vs failed in the summary rather
than claiming the whole batch succeeded.

### S8. Phase 2 cross-ecosystem note

After the report, include a one-line footnote acknowledging scope:

> *Staleness detection currently covers Homebrew formulae only. npm, crates,
> Go modules, GitHub Actions, Docker images, and VSCode extensions are
> Phase 2 — they'll plug into the same `--stale` flag once their upstream
> registries are wired up.*
