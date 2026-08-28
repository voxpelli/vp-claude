# Vision: vp-knowledge

> A personal knowledge graph is only worth what you can trust in it. This plugin
> exists to keep a Basic Memory graph *correct* as it grows — researched from
> primary sources, cross-linked, and audited — rather than merely large.

## The problem

Note-taking tools optimise for capture. Capture is the easy half. The hard half
is what happens over the following two years:

- A note records `rmcp` at v1.6.0. The crate is at 3.1.4. Nothing says so.
- A note asserts a mechanism confidently. The mechanism was inferred from a
  doc-AI summary, and the actual source says the opposite.
- Two notes describe the same package under different titles, and a third links
  to neither.
- A link points at a note that was never written. There are hundreds of them.

None of this is visible from inside a single note. It is only visible in
aggregate, and only if something goes looking. An LLM assistant reading a wrong
note does not hesitate — it acts on it, and then cites it, and the error
compounds through reciprocation into other notes and other projects.

So the durable risk is not a sparse graph. It is a **confidently wrong** one.

## What this plugin is

The skills, agents and hooks that do the going-looking (CLAUDE.md's Components
index carries the current counts, and a check guards them there). They divide
along one axis that matters more than any other:

- **Read-only surveyors** — `knowledge-gardener` (a multi-dimension audit),
  `knowledge-primer`, `raindrop-gardener`, `finding-verifier`. They report.
  They never write.
- **The one writer** — `knowledge-maintainer`. It acts on what the surveyors
  found, and confirms before any content-level change.

That split is load-bearing, not stylistic. An agent that can both diagnose and
mutate will quietly mutate to make its diagnosis true. Keeping the shears in
one pair of hands means every change has an author and a reason.

`/intel` is the research front door: a package or tool name goes in, a
structured, cross-linked, source-cited note comes out. It reads existing notes
first, then enriches from the sources listed in `skills/intel/SKILL.md` —
consulting what is already on this machine before anything that costs a network
round-trip.

## The product is markdown that an agent executes

This is the fact that shapes everything else. The plugin *content* is prose an
LLM follows — no build step, no runtime, just markdown and JSON. (There is real
code alongside it: the Pi extension, and the `lib/`+`scripts/` validation
tooling. The bug that prompted this section lived in exactly that layer, so it
is worth naming rather than waving away.) So:

**A wrong sentence is a behavioural bug.** Not a typo, not a doc nit. If
`/intel` tells an agent that `replace_section` replaces a whole section, the
agent duplicates every sub-heading in a real note in a real graph. Guidance
corrections belong in the changelog under **Fixed**, because that is what they
are.

**Therefore: verify before you persist.** Vet any non-trivial mechanism,
attribution, version or licence claim against *primary source* — the package's
own code, the registry API, the live behaviour — before it goes into a note or
a doc. Not a summary of the source. The source.

## What we got wrong, kept here on purpose

Two failure modes have recurred often enough to be part of the design rather
than a footnote.

**A check that cannot fail is worse than no check.** Several have shipped here,
and the count keeps rising because each review finds another. The shapes
repeat: a comparison against a value derived from the same tuple it is
checking; a guard whose early return leaves its error list empty; an assertion
that survives deleting the code it asserts. They pass, they cost CI time, and
they buy confidence that was never earned. **The countermeasure is
plant-and-revert** — a new guard is not trusted until a deliberately planted
defect has made it fail. Writing the check is not the work; making it fail is.

**Most guards here verify that two documents agree, and not one of them talked
to the Pi runtime.** (The absolute version of that sentence is wrong and worth
correcting rather than quietly softening: several checks *are* behavioural —
they exercise real code, load the skills tree through Pi's own loader, or
resolve paths on disk. The true claim is narrower and still damning.) That gap
had a name before it had a victim: in 2026-08 the Pi agent port was found to
target a runtime that had been swapped out weeks earlier, and the extension was
injecting MCP tool names that resolved to nothing — silently, because unknown
tool names are dropped rather than refused. Every check green, all of them
agreeing with each other about a world that had moved.

The fix was a fixture captured from the live registry: **data, not a
derivation**, so it cannot drift in sympathy with the code it checks. Prefer
that shape wherever reality is reachable — and note it took a second review to
make the fixture's own guard bite, because the first version of it passed
happily on a forged fixture. A guard protecting a guard is still a guard.

## Principles

1. **Read-only means enforced, not promised.** An agent documented as read-only
   must be structurally unable to write — via its tool allowlist, a host
   permission layer, or a blocking hook. Prose is not a boundary. Where the
   host cannot enforce it, say so plainly rather than implying a guarantee.
2. **Absence of evidence is not evidence.** A sub-agent's "couldn't find it"
   and a search that returned nothing are the same claim, and neither is proof.
   Check the authoritative source before acting on a doubt.
3. **Ask rather than route around.** Adding a dependency, changing a public
   surface, a large refactor — these are the user's calls. Do not quietly pick
   the conservative option to avoid asking.
4. **Cheapest authoritative source first.** Local notes, then offline docsets,
   then a repo-aware API, then the web, then scraping HTML. Never fetch a page
   to learn what a local note already records.
5. **Record the trigger, not just the decision.** Deferred work without a
   revival condition is not deferred, it is lost. See [ROADMAP.md](ROADMAP.md).
6. **One host is not the world.** The same `skills/` tree serves Claude Code,
   Pi and skills.sh. Committed files stay portable; anything host-shaped is
   resolved on the host, not baked in at author time.

## Where it fits

The upstream `basicmachines-co/basic-memory-skills` package provides the core
`memory-*` skills — notes, schema, tasks, lifecycle. This plugin depends on
those conventions and deliberately does not duplicate them; it adds the layer
above: research pipelines, coverage and drift audits, and graph maintenance.

Its sibling `vp-beads` tracks work. The seam between them is capture versus
synthesis — `/session-reflect` writes discoveries into the graph during a
sprint; `/retrospective` reads them back at sprint close.

See [ROADMAP.md](ROADMAP.md) for what is deferred and what would revive it, and
`docs/design/` for the decision records that outlive a sprint.
