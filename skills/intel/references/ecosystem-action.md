# GitHub Actions Ecosystem — Registry Resolution

Use this reference file during Step 2 (Fetch registry data) when the detected
ecosystem is `action`.

## No Formal Registry API

GitHub Actions have no dedicated registry API. The authoritative source is the
`action.yml` (or `action.yaml`) file at the root of the action's GitHub repo.

## Fetch action.yml

```
tavily_extract(
  urls=["https://github.com/<owner>/<repo>/blob/main/action.yml"],
  query="inputs outputs runs using permissions secrets"
)
```

If `action.yml` returns nothing (file not found), try `action.yaml`:
```
tavily_extract(
  urls=["https://github.com/<owner>/<repo>/blob/main/action.yaml"],
  query="inputs outputs runs using permissions secrets"
)
```

### Key fields in action.yml

| Field | Description |
|-------|-------------|
| `name` | Display name of the action |
| `description` | Brief description |
| `inputs.<name>.description` | What this input controls |
| `inputs.<name>.required` | Whether the input is mandatory |
| `inputs.<name>.default` | Default value if not specified |
| `outputs.<name>.description` | What this output provides |
| `outputs.<name>.value` | Expression that resolves to the output value |
| `runs.using` | Runtime: `node20`, `node16`, `composite`, or `docker` |
| `runs.main` | Entry point JS file (for node runtime) |
| `runs.steps` | Steps to execute (for composite actions) |

## Fetch README for Usage Examples

```
tavily_extract(
  urls=["https://github.com/<owner>/<repo>/blob/main/README.md"],
  query="usage example inputs outputs permissions token secrets"
)
```

The README typically documents which GITHUB_TOKEN permissions the action
requires, what secrets it accesses, and usage examples. This is the primary
source for the `## Permissions` section of the note.

## Permissions Model

GitHub Actions do not declare required permissions in `action.yml` itself.
Instead, the calling workflow grants permissions via the `permissions:` key.
The action's README should document what scopes are needed. Common scopes:

| Scope | Common reason |
|-------|---------------|
| `contents: read` | Checkout code |
| `contents: write` | Push commits, create tags |
| `packages: write` | Publish to GHCR |
| `id-token: write` | OIDC token for cloud auth |
| `pull-requests: write` | Comment on PRs |
| `issues: write` | Comment on issues |

## Security: Pin-to-Hash vs Pin-to-Tag

A key security consideration for all GitHub Actions:

**Pin to tag** (common but risky):
```yaml
uses: actions/checkout@v4
```
The tag `v4` can be moved by the action author — supply-chain attack surface.

**Pin to commit SHA** (recommended for security-sensitive workflows):
```yaml
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
```
The SHA is immutable. Note in `[security]` observations whether the action's
maintainer recommends SHA pinning and whether Dependabot can update it.

Always note the recommended pinning strategy in the `[version]` observation.
