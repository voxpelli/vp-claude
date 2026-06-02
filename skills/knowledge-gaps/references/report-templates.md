# Knowledge-gaps — output report templates

Full output-format reference for `/knowledge-gaps` standard mode. The skill body
(Step 4 "Generate gap report" and Step 9 "Add tools section to gap report")
produces these; the verbose format lives here so the body stays lean
(progressive disclosure).

## Contents

- [Package coverage report](#package-coverage-report) — emitted by Step 4
- [Tool coverage report](#tool-coverage-report) — appended by Step 9
- [Plugin/skill coverage report](#pluginskill-coverage-report) — appended by Step 9 under `--plugins`

## Package coverage report

A `## Knowledge Gap Report — <project>` header, one `### <eco> Coverage: X/Y (Z%)`
section per package ecosystem (each with Tier 1 / Tier 2 / Tier 3 / Already
Documented subsections, packages ranked by import count), then an
`### Overall Summary`.

```
## Knowledge Gap Report — <project-name>

### npm Coverage: X/Y packages documented (Z%)

#### Tier 1 — Must Document (3+ imports)
| Package | Import Count |
|---------|-------------|
| fastify | 12 |

#### Tier 2 — Should Document (1-2 imports)
...

#### Tier 3 — Optional (dev only)
...

#### Already Documented
...

---

### crates Coverage: X/Y packages documented (Z%)

#### Tier 1 — Must Document (3+ imports)
| Package | Import Count |
|---------|-------------|
| serde   | 28 |

...

---

### Overall Summary
- Total packages across all ecosystems: N
- Documented: M (Z%)
- Undocumented Tier 1: P packages
```

## Tool coverage report

Appended after the package sections. One `### <type>: X/Y documented` section per
tool type (no import-count tiering — all manifest entries are equally "used";
group by type, show documented vs undocumented). The Homebrew Formulae section
gains a Brewfile ↔ installed reconciliation sub-section only when Step 7b ran
(the `brew leaves` command was available); otherwise omit it and add the
"Brewfile-only mode" note.

```
---

## Tool Coverage Report

### Homebrew Formulae: X/Y documented
| Tool | Status |
|------|--------|
| brew-ripgrep | ✓ documented |
| brew-jq | ✗ undocumented |

#### Brewfile ↔ installed reconciliation

Include this sub-section only when Step 7b ran successfully (the `brew leaves`
command was available).

##### Installed but not Brewfile-declared (silent leaves worth documenting)
| Formula | BM coverage |
|---------|-------------|
| jq      | ✗ undocumented |
| fd      | ✓ documented |

##### Brewfile-declared but not installed (dead declarations)
| Formula | BM coverage |
|---------|-------------|
| pandoc  | ✓ documented |

If `brew leaves` was unavailable, omit the reconciliation sub-section and add
the note "Brewfile-only mode — `brew` CLI not available; install reconciliation
skipped" below the Homebrew Formulae table.

### Homebrew Casks: X/Y documented
...

### GitHub Actions: X/Y documented
...

### Docker Images: X/Y documented
...

### VSCode Extensions: X/Y documented
...

### Tool Summary
- Total tools across all types: N
- Documented: M (Z%)
- Undocumented: P
```

## Plugin/skill coverage report

Appended after the Tool Coverage Report only when Step 7c ran (`--plugins`). Both
populations are USER-GLOBAL (the operator's machine, not the project) — label the
section so. Plugins and skill-bundles both resolve to `claude_plugin` notes: one
note per plugin, and one note per skill-bundle SOURCE REPO (many skill dirs from
one repo share a note). No tiering — every installed item is equally "used".

```
---

## Plugin/Skill Coverage Report (user-global)

### Claude Code Plugins: X/Y documented
| Plugin | /tool-intel address | BM coverage |
|--------|---------------------|-------------|
| vp-knowledge (voxpelli/vp-claude) | plugin:voxpelli/vp-claude#vp-knowledge | ✓ documented |
| context7 (anthropics/claude-plugins-official) | plugin:anthropics/claude-plugins-official#context7 | ✗ undocumented |
| code-review@claude-plugins-official | resolve manually (source unresolved) | ✗ undocumented |

### Agent Skills (skills.sh): X/Y documented
One row per source repo (skill dirs sharing a repo collapse to one note).
| Skill bundle | /tool-intel address | Skills installed | BM coverage |
|--------------|---------------------|------------------|-------------|
| basicmachines-co/basic-memory-skills | skill:basicmachines-co/basic-memory-skills | memory-research, memory-notes (+7) | ✗ undocumented |
| vercel-labs/skills | skill:vercel-labs/skills | find-skills | ✓ documented |

### Plugin/Skill Summary
- Installed plugins: N total, M documented (Z%)
- Installed skill bundles: P total, Q documented (Z%)
```

`--stale plugin` is deferred (no registry API); `--stale skill` is unsupported
(no comparable version) — this section is coverage-only.
