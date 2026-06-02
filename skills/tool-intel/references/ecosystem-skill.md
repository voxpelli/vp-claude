# Ecosystem reference: agent-skill bundles (`skill:`)

Fetch + research recipe for `/tool-intel skill:<owner>/<repo>` (optionally
`#<skill-name>`). A skills.sh / agentskills.io skill bundle is a pure
`owner/repo` git artifact with no central registry and frequently no version
tags — its closest analog is `gh:`. Writes a `claude_plugin` note (the
`claude_plugin` type covers both Claude plugins and skills.sh bundles, which are
installable agent-extension collections; see `note-template-plugin.md`).

## Step 2: discover skills + fetch manifest

GitHub IS the registry — `npx skills add <owner>/<repo>` clones the repo and
copies its `SKILL.md` folders. Walk the tree, then read the target `SKILL.md`:

```bash
# discover skills in the repo (no registry — walk the tree)
gh api repos/<owner>/<repo>/git/trees/<default-branch>?recursive=1 \
  --jq '.tree[] | select(.path | endswith("SKILL.md")) | .path'
# fetch the target SKILL.md frontmatter
gh api repos/<owner>/<repo>/contents/<skill-path>/SKILL.md --jq .content | base64 -d
#   -> name, description, license?, compatibility?, allowed-tools?, + CC extensions (version?, user-invocable?)
```

Extract: `name`, `description`, `license`, `compatibility`, the `source` repo,
default branch. Record the skills the repo bundles as `[components]`.

## Popularity (optional enrichment, NOT a version)

`skills.sh` exposes a discovery endpoint that returns install counts (no
version):

```bash
curl -s "https://skills.sh/api/search?q=<skill-name>" \
  | jq '.skills[] | select(.source=="<owner>/<repo>") | .installs'
```

Record as a `[popularity]` observation (mirrors the Homebrew-MCP analytics
pattern). Note `install_mode` includes `npx skills add <owner>/<repo>`.

## Trust ladder (security)

Same 4-state `[security]` ladder + `relates_to [[Publisher Verification Gradient]]`
as `ecosystem-plugin.md`. For a skill bundle, "marketplace" maps to the
skills.sh directory listing vs a direct-repo install.

## Changelog / version drift

Skill bundles usually have NO tags/releases — they ship off a moving `main`.
The only version surrogate is the folder tree SHA + last-commit date:

```bash
gh api "repos/<owner>/<repo>/commits?path=<skill-path>" --jq '.[0].commit.committer.date'
```

`--stale skill` is NOT supported (no comparable version — same exclusion bucket
as `action`/`gh`). Research only.
