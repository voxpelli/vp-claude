# Two September 2025 npm incidents, conflated across 7 Basic Memory notes

**Status:** verified 2026-08-13, **not yet applied**. Read-only investigation; no note was
edited. This file is the paste-ready remedy.

**Found by:** the `stale-npm-triage` Phase 10 run. A `/intel npm:supports-color` refresh
noticed that the hub note `npm Supply Chain Security and CVE Landscape` attributed the
supports-color compromise to the Shai-Hulud worm, while the leaf note said phishing.

## The finding

`npm Supply Chain Security and CVE Landscape` merges the **2025-09-08 Qix / Josh Junon
phishing wave** (chalk / debug / supports-color) into the **Shai-Hulud worm**
(2025-09-14 → 16). Different tradecraft, different mechanism, different victim set, six days
apart, **zero package overlap**.

Two of the hub's own sibling notes already have it right — `Critical Perspective on
Supply-Chain Security Vendors and FUD` lists them as separate rows, and `Bus-Factor and
Account-Takeover Risk Inventory` as incidents #9 and #10. **The hub contradicts its own
siblings**, which is how a hub error stays invisible: the neighbours look fine.

**Likely propagation path:** `Cobenian/shai-hulud-detect`'s `compromised-packages.txt` uses
"Shai-Hulud" as an umbrella brand in its *filename and repo*, while internally sectioning
`supports-color:10.2.1` under an explicit `# SEPTEMBER 8, 2025 - CHALK/DEBUG CRYPTO THEFT
ATTACK` header. Anyone citing the file by name inherits the wrong label. AI summarizers do
it too — one produced the exact conflation live during this research.

## Verified timeline

### A — Qix / chalk-debug phishing, 2025-09-08 · HIGH confidence

- Phishing domain `npmjs.help` registered 2025-09-05; fake npm 2FA-reset mail from
  `support@npmjs.help` harvested username + password + live TOTP.
- Victim: **Josh Junon**, npm handle `Qix-`, chalk co-maintainer.
- First malicious publish `debug@4.4.2` **13:12:39 UTC**; `chalk@5.6.1` 13:13:05;
  `supports-color@10.2.1` **13:13:28** *(npm registry `time` field — primary)*. ~16 minutes
  from account access (Sygnia, "16 Minutes to Impact").
- **18–20 packages** — sources genuinely disagree (Socket 19, StepSecurity/Qualys 18). Use
  the range, never a single number.
- **Mechanism: a browser-side crypto-clipper injected into the module SOURCE** — chalk#656:
  *"Malicious payload is on line 11 of `src/index.js`"*. Hooks `fetch`, `XMLHttpRequest`,
  `window.ethereum`, Solana signing; swaps wallet addresses by Levenshtein-nearest match.
  **No install/postinstall script. Inert in pure Node/server contexts.**
- Fixed same day: `chalk@5.6.2` 14:47:54 UTC, `supports-color@10.2.2` **14:49:55 UTC** — 96
  minutes after the compromise. npm confirmed full takedown 19:59 UTC *(Sygnia, single
  source — medium confidence)*. `debug@4.4.3` 2025-09-13.
- Advisory **CVE-2025-59144 / GHSA-4x49-vf9v-38px**: *"the npm publishing account for
  `debug` was taken over after a phishing attack"* — no mention of Shai-Hulud.
- Confirmed on-chain loss ~$925–1,000 *(Arkham via Kaspersky; not re-verified at source)*.

### B — Shai-Hulud first wave, 2025-09-14 → 16 · HIGH confidence

- Patient zero `rxnt-authentication`, **2025-09-14 17:58:50 UTC** (Arctic Wolf). Namesake
  `@ctrl/tinycolor@4.1.1` **2025-09-15 19:52:46 UTC** (registry; now unpublished).
- **Mechanism: ~3.6 MB `bundle.js` run from a `postinstall` script** → TruffleHog +
  AWS/GCP/Azure metadata endpoints → exfil to a public GitHub repo named `Shai-Hulud` →
  `shai-hulud.yaml` Actions workflow for persistence → force-publishes up to 20 of the
  maintainer's own packages.
- Scale ~180 (Aikido/Cycode) to 500+ (StepSecurity, CISA) — all snapshots at different times.
- **CISA responded with a plain Alert**, *"Widespread Supply Chain Compromise Impacting npm
  Ecosystem"*, 2025-09-23, at `/alerts/2025/09/23/…`. **It has no AA number.**

### C — Shai-Hulud 2.0, 2025-11-21 → 24 · HIGH confidence

"Sha1-Hulud: The Second Coming". PostHog CI patient zero 2025-11-24 04:11 UTC. Moved to
**`preinstall`**, payload run under Bun (`setup_bun.js` → `bun_environment.js`); deletes
`$HOME` when no credentials are found. 500–780+ packages, 25,000+ repos.
**Trigger.dev's post-mortem describes THIS wave, not September.**

### Overlap: none

Zero package overlap (StepSecurity's 195-row table contains no chalk-org package; Unit 42
never mentions `supports-color`). First Shai-Hulud publish is 6 days after the last Qix
publish. Browser-runtime clipper vs. postinstall credential worm. **No credible source links
`supports-color` to Shai-Hulud.**

## A second, independent error: the CISA advisory ID

**`AA25-266A` is not the npm alert.** It is *"CISA Shares Lessons Learned from an Incident
Response Engagement"* — GeoServer CVE-2024-36401 at an FCEB agency — published the same day,
2025-09-23. Three notes carry the mislabel: the hub, `Critical Perspective…` § Sources, and
`Bus-Factor…` incident #10 plus its `[source]` line. In the latter two, **drop the ID; the
URLs are correct.**

## Do NOT assert these

The hub's whole problem is a confident wrong claim. Do not replace it with another.

| Claim | Status |
|---|---|
| `proto-tinker-wc` version | **Unestablished** — Socket's own post says `1.8.7` in one place, `0.1.87` circulates elsewhere. State no version |
| `CVE-2025-59145` covers chalk | **Unverified.** Plausible as debug's counterpart; do not assert |
| The two campaigns share an actor | **Unverified.** Unit 42 hedges that Shai-Hulud "may originate from a credential-harvesting phishing campaign spoofing npm". Do not write that they are linked **or** that they are definitively unrelated actors — only that they are separate *incidents* |
| npm's 19:59 UTC full takedown | Single source (Sygnia) — medium confidence |
| Package counts | Ranges only: 18–20 (Qix), ~180–500+ (Shai-Hulud) |

## The edits

### Hub — `npm Supply Chain Security and CVE Landscape`

**Edit 1 · § Attack Taxonomy → Account Hijacking. Remove verbatim:**

> - **Shai-Hulud worm (2025-09-08)**: Self-replicating worm compromised 500+ packages including chalk, debug, strip-ansi, color-convert, has-ansi, supports-color (~18 chalk-org packages total). Stolen npm tokens used to authenticate as compromised maintainers and automatically inject malware into other packages they owned. Targeted GitHub PATs, AWS/GCP/Azure API keys. CISA issued alert AA25-266A. Affected packages had ~2.6 billion weekly downloads collectively

**Replace with two bullets:**

> - **Qix / chalk-debug phishing wave (2025-09-08)**: Maintainer Josh Junon (npm handle `Qix-`) was phished by a fake npm 2FA-reset mail from `support@npmjs.help` (domain registered 2025-09-05). ~16 minutes after account access the attacker published malicious versions of 18-20 chalk-org and adjacent packages — ansi-styles@6.2.2, debug@4.4.2, chalk@5.6.1, supports-color@10.2.1, strip-ansi@7.1.1, ansi-regex@6.2.1, wrap-ansi@9.0.1, color-convert@3.1.1, color-name@2.0.1 and others — with ~2.6 billion weekly downloads collectively. The payload was a browser-side crypto-clipper injected into the module *source* (chalk#656: "line 11 of `src/index.js`"), **not** an install script: it wraps `fetch`, `XMLHttpRequest` and `window.ethereum`/Solana signing and swaps wallet addresses for visually-similar attacker ones, staying inert in pure Node contexts. First malicious publish 13:12 UTC, chalk@5.6.2 and supports-color@10.2.2 out by 14:50 UTC, npm confirmed full takedown 19:59 UTC (registry publish times; Sygnia timeline). Confirmed on-chain loss ~$925-1,000. **This is a separate incident from Shai-Hulud** — different mechanism, different packages, six days earlier
> - **Shai-Hulud worm (2025-09-14 → 09-16)**: The first successful self-replicating worm on npm, and a distinct campaign from the 09-08 phishing wave above. Patient zero was `rxnt-authentication` (published 2025-09-14 17:58:50 UTC); `@ctrl/tinycolor@4.1.1`/`4.1.2` followed on 2025-09-15 (19:52 / 20:13 UTC) and gave the campaign its public name. A ~3.6 MB `bundle.js` ran from a **postinstall** script, used TruffleHog plus AWS/GCP/Azure metadata endpoints to harvest npm tokens, GitHub PATs and cloud keys, dumped them to a public GitHub repo named `Shai-Hulud`, installed a `shai-hulud.yaml` Actions workflow for persistence, then force-published up to 20 of the compromised maintainer's own packages to spread. ~180 (Aikido) to 500+ (StepSecurity, CISA) packages, including CrowdStrike's npm org. CISA responded with an Alert, "Widespread Supply Chain Compromise Impacting npm Ecosystem" (2025-09-23) — note this Alert carries **no AA number**; AA25-266A is an unrelated GeoServer incident-response advisory published the same day. **No chalk-org package (chalk, debug, supports-color, strip-ansi, ansi-styles) was affected by this wave**

**Edit 2 · same section. Remove:**

> - **debug CVE-2025-59144**: npm account takeover, malicious v4.4.2 published with crypto-wallet malware targeting browser environments. Part of the Shai-Hulud campaign. Fixed in v4.4.3

**Replace with:**

> - **debug CVE-2025-59144**: npm account takeover via the 2025-09-08 `npmjs.help` phishing; malicious v4.4.2 published with crypto-wallet malware targeting browser environments. Part of the Qix wave, **not** Shai-Hulud — GHSA-4x49-vf9v-38px says plainly "the npm publishing account for `debug` was taken over after a phishing attack". Fixed in v4.4.3 (2025-09-13), a clean rebuild of 4.4.1

**Edit 3 · same section. Remove:**

> - **chalk v5.6.1 (2025-09-08)**: Cryptostealer malware via stolen maintainer credentials. Pulled within hours. Documented in GitHub issue #656

**Replace with:**

> - **chalk v5.6.1 (2025-09-08)**: Cryptostealer malware published from Josh Junon's phished account in the `npmjs.help` wave above. Unpublished and superseded by 5.6.2 within 95 minutes. Documented in GitHub issue #656

**Edit 4 · § Self-Propagating Worms. Remove both bullets:**

> - **Shai-Hulud (2025-09)**: Used stolen npm tokens to self-replicate across maintainer accounts. Each compromised package became a new propagation vector. Stole GitHub PATs, then used them to force-push to repos and exfiltrate secrets via public `Shai-Hulud` repos created on victims' GitHub accounts. Trigger.dev post-mortem documented 669 repo clones, 199 force-pushed branches, 42 closed PRs across their org — but no npm packages compromised (2FA on npm publishing saved them)
> - **Shai-Hulud 2.0 (2025-11)**: Second wave affecting PostHog, Zapier, AsyncAPI, Postman, ENS and 25,000+ repositories

**Replace with:**

> - **Shai-Hulud (2025-09-14 → 09-16)**: Used stolen npm tokens to self-replicate across maintainer accounts. Each compromised package became a new propagation vector. Harvested credentials with TruffleHog and exfiltrated them via public `Shai-Hulud` repos created on victims' GitHub accounts
> - **Shai-Hulud 2.0 / "Sha1-Hulud: The Second Coming" (2025-11-21 → 11-24)**: Second wave affecting PostHog (CI patient zero, 2025-11-24 04:11 UTC), Zapier, AsyncAPI, Postman and ENS — 500-780+ packages and 25,000+ repositories. Moved from `postinstall` to `preinstall` and ran the payload under Bun (`setup_bun.js` spawning a detached `bun_environment.js`), with home-directory deletion as the fallback when no credentials were found. **Trigger.dev's post-mortem documents this wave, not the September one**: 669 repo clones, 199 force-pushed branches, 42 closed PRs across their org — but no npm packages compromised (2FA on npm publishing saved them)

**Edit 5 · § Historical Timeline. Remove:**

> \| 2025-09 \| Shai-Hulud worm \| 500+ packages, 2.6B weekly downloads, CISA alert \|
> \| 2025-11 \| Shai-Hulud 2.0 \| 25,000+ repositories, PostHog/Zapier/ENS affected \|

**Replace with:**

> \| 2025-09-08 \| Qix / chalk-debug phishing \| 18-20 packages, ~2.6B weekly downloads; browser crypto-clipper; ~$925 confirmed stolen \|
> \| 2025-09-14 \| Shai-Hulud worm \| First self-replicating npm worm; ~180-500+ packages; CISA Alert 2025-09-23 \|
> \| 2025-11-24 \| Shai-Hulud 2.0 \| 500-780+ packages, 25,000+ repositories, PostHog/Zapier/ENS affected \|

**Leave unchanged** (verified correct): the `[pattern]` crediting Sygnia's 16 minutes to
"the Sep 2025 attack" (Sygnia's report *is* 09-08); the picocolors immunity line; the
"left-pad → … → Shai-Hulud → CISA alert" hardening pattern.

### The other six notes

| Note | Wrong | Fix |
|---|---|---|
| `npm/npm-debug` § Security | "Part of the September 2025 npm supply chain attack (Shai-Hulud worm)" | "Part of the 2025-09-08 Qix/npmjs.help phishing wave (chalk, supports-color, strip-ansi et al.) — a separate incident from the Shai-Hulud worm, which began 2025-09-14 and affected no chalk-org package" |
| `npm/npm-debug` § Observations | "~25 packages including chalk" | `~25` → **18-20** |
| `engineering/security/npm-install-scripts-as-attack-surface` | "### Shai-Hulud Worm (2025-09) … 500+ packages including chalk, debug, strip-ansi, and supports-color. Each compromised package's install script exfiltrated…" | **Doubly wrong** — those packages were never in this wave, *and* the 09-08 payload used no install script at all, so citing them in a note about install scripts inverts the lesson. Use: "compromised ~180-500+ packages starting from rxnt-authentication and @ctrl/tinycolor. Each compromised package's postinstall script ran a ~3.6 MB bundle.js that…" |
| `npm/npm-npm` § Security | "18 popular packages compromised via stolen npm tokens (Shai-Hulud worm…)" | "September 2025 saw two distinct attacks: the 2025-09-08 Qix phishing wave (18-20 packages incl. chalk/debug, browser crypto-clipper, no install script) and the Shai-Hulud worm from 2025-09-14 (postinstall credential worm, ~180-500+ packages, self-propagating via stolen author tokens). The '18 packages' figure belongs to the former." |
| `npm/npm-semver` | "The September 2025 npm supply chain attack (Shai-Hulud) targeted other packages (chalk, debug) but did not compromise semver" | "Neither September 2025 npm attack touched semver — not the 2025-09-08 Qix phishing wave (chalk, debug, supports-color) nor the Shai-Hulud worm from 2025-09-14" |
| `npm/npm-chalk` § Relations | "the Shai-Hulud worm (2025-09-08) used compromised chalk packages as propagation vectors via install scripts" | Wrong campaign **and** wrong mechanism. Replace with: `relates_to [[npm Install Scripts as Attack Surface]] — contrast case: the 2025-09-08 chalk compromise used no install script at all; the payload sat in the module source and executed in the browser` |

### Already correct — do not touch

`npm/npm-supports-color` · `npm/npm-strip-ansi` ·
`engineering/security/critical-perspective-on-supply-chain-security-vendors-and-fud` ·
`engineering/security/bus-factor-and-account-takeover-risk-inventory` ·
`engineering/security/npm-package-provenance-and-supply-chain-attestation` ·
`casks/cask-codex` · `organizations/ataraxy-labs` and three others with generic or 2026
"Mini Shai-Hulud" references.

## Out of scope, flagged

- `Lockfile Security and Dependency Pinning Strategies` says *"Sygnia measured 16 minutes
  from the axios account compromise to first malicious publish (2026)."* Sygnia's "16
  Minutes to Impact" is the **2025-09-08 chalk/debug** incident, not axios 2026.
- Every "Trigger.dev / Shai-Hulud" citation in `npm Install Scripts`, `Lockfile Security`
  and `npm Package Provenance` is really **Shai-Hulud 2.0 (Nov 2025)** — harmless where the
  year is unstated, imprecise where "2025-09" is implied.

## Why this is worth the words

A **hub note is a force multiplier in both directions.** This one had two independent
defects (the conflation, and the CISA ID) and had already propagated the wrong attribution
into six leaves — while two sibling hubs sat next to it with the correct version. A
version-drift sweep cannot see any of this: every affected note's `[version]` slot is fine.
This is the second wrong-security-claim class found in the same hub; the first, a withdrawn
CVE attributed to `@npmcli/arborist`, was corrected during Phase 10.
