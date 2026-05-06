# Voice

A short note on how this plugin's agents identify themselves — what they look
like, what they sound like, and what to check before adding a fifth one. Not a
brand bible. Edit freely when the metaphor stops fitting the work.

## The metaphor

vp-knowledge is the **gardener with a notebook**. Two of the four agents are
already called "gardener"; the metaphor isn't decoration, it's the spine. The
plugin cultivates a personal Basic Memory graph rather than constructing one —
it walks the beds before work, notes which relations have gone leggy, and
(when asked) prunes. Sibling plugin **vp-beads** runs the foreman's clipboard:
sprints, retrospectives, deadlines. vp-knowledge keeps the notebook.

The framing shows up in the README ("actively maintained knowledge graph"), in
skill names (`/wander`, `/session-reflect`, `/knowledge-prime`), and in the
agent roster.

## Colors

The Claude Code agent `color` field is a closed enum: `blue, cyan, green,
yellow, magenta, red` — see `VALID_AGENT_COLORS` in `validate-plugin.mjs`.
`purple` and `orange` work at runtime but fall outside the allowlist and
trigger plugin-validator warnings — don't use them.

| Agent                  | Color   | Encodes                                          |
| ---------------------- | ------- | ------------------------------------------------ |
| `knowledge-gardener`   | green   | growth, observation; the central gardener       |
| `knowledge-maintainer` | magenta | the only writer; creation, grafting             |
| `knowledge-primer`     | blue    | calm; a pre-work briefing                       |
| `raindrop-gardener`    | yellow  | Raindrop's droplet; signals a different domain  |

The assignments encode two axes a user can read at a glance:

- **Domain** — yellow = Raindrop bookmarks; the others = Basic Memory graph.
- **Action** — magenta = writes (with confirmation); blue/green/yellow = read-only.

### Why not the other obvious choices

- **`cyan`** is reserved by sibling `vp-beads:sprint-review`. Claude Code
  tolerates per-plugin collisions, but the two plugins ship together via the
  `vp-plugins` marketplace and users see both rosters in one session. Avoid.
- **`red`** conventionally signals destructive or critical work across
  installed plugins. `knowledge-maintainer` is consequential but always
  confirms before content changes, so red over-signals danger. Magenta is
  the unclaimed slot in the legal enum and fits the maintainer's
  grafting-and-joining role on its own merits — no semantic authority is
  built into the enum, only validity.
- **`yellow`** for the BM-graph trio would dilute the Raindrop domain anchor
  and lose a free piece of brand grounding (Raindrop's logo is a yellow drop).

## Description tone

**Scope: agents only.** Skill `description:` fields are pure routing surface —
keep them as trigger-phrase lists in the canonical "This skill should be used
when the user asks to…" form. Voice work belongs in agent descriptions and
prose, not skill frontmatter, because skills route on dense quoted-phrase
matching that a literary opener would starve.

Agent `description` fields are functional first — Claude reads them to route
work, so trigger phrases stay machine-readable. The first sentence can carry
voice without compromising routing.

The house style is **dry, observational, slightly literary** — closer to a
botanist's field notes than a SaaS landing page. Short sentences. Verbs do
most of the work. Adjectives rationed. Avoid corporate hype ("powerful,"
"seamless," "robust"), self-praise, and exclamation marks.

When a description rewrite is on the table, the four agents can be thought of
as roles within one garden:

- **knowledge-primer** — walks the beds before work begins; reports what is
  already known.
- **knowledge-gardener** — surveys the graph; notes what has gone leggy or
  stale; never prunes.
- **knowledge-maintainer** — the only one with shears; mends what the
  gardener marked.
- **raindrop-gardener** — tends the bookmark annex; same discipline,
  different soil.

These are framings, not slugs. The agent `name` values stay stable for
muscle memory.

## When adding a fifth agent

1. Two colours are unused in vp-knowledge after the current four: `cyan` and
   `red`. Use `red` if the agent does destructive work. Use `cyan` only if
   the collision with `vp-beads:sprint-review` is acceptable. Otherwise
   prefer reusing one of the existing four if the new agent shares a domain
   or read/write character with an existing one.
2. The first sentence of `description` describes what the agent does in
   garden vocabulary if a fitting verb exists; otherwise plain English.
   Don't force the metaphor.
3. If the new agent operates outside both the BM graph and Raindrop, the
   axis breaks and this file needs revising.
