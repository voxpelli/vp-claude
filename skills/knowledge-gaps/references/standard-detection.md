# Domain Standard Detection — Reference

Use this reference during Steps 11–13 of the knowledge-gaps workflow to detect,
classify, and report domain standard dependencies.

### 11. Detect domain standard dependencies

Search BM for all notes with `type: standard`:

```
search_notes(search_type="text", query="type: standard", page_size=50)
```

If no standard notes exist in BM, report "No domain standards documented in
Basic Memory" and skip Steps 12–13.

Extract standard names from the results. **Skip ubiquitous standards** that are
too fundamental to be useful gaps. Maintain this hardcoded skiplist — do not
search the codebase for these:
`HTTP`, `HTML`, `CSS`, `JSON`, `XML`, `DNS`, `TLS`, `SSL`, `TCP`, `URL`, `URI`,
`UTF-8`, `REST`, `OAuth` (unless the project implements an OAuth server/client
directly).

For each non-skipped standard, grep the codebase for mentions (case-insensitive):

```
Grep(pattern="<standard-name>", glob="**/*.{js,ts,md,json}", output_mode="count", -i=true)
```

### 12. Classify standard dependencies

Based on grep counts from Step 11:

- **Key standard** (3+ mentions in code/config): core to the project — must be documented
- **Referenced standard** (1-2 mentions): used but not central
- **Undocumented key standard**: mentioned 3+ times in code but no BM note exists — gap

Standards with zero mentions are silently omitted from the report.

### 13. Add standards section to gap report

Append after the Tool Coverage section:

````markdown
---

## Domain Standard Coverage

### Key Standards (3+ references in code)

| Standard | References | BM Note |
|----------|-----------|---------|
| GraphQL | 47 | documented |
| gRPC | 12 | documented |

### Referenced Standards (1-2 references)

| Standard | References | BM Note |
|----------|-----------|---------|
| OpenAPI | 2 | documented |

### Undocumented Key Standards

| Standard | References |
|----------|-----------|
| AsyncAPI | 8 |

### Standard Summary

- Total documented standards: N
- Key standards (3+ refs): M
- Undocumented key standards: P (gaps)
````

If no standards are referenced in the codebase, report "No domain standards
detected in codebase" and skip this section.
