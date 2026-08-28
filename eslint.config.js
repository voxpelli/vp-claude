import { voxpelli } from '@voxpelli/eslint-config'

// vp-knowledge ships pure markdown + JSON plus the .mjs validation tooling
// (scripts/, lib/, validate-plugin.mjs). neostandard via @voxpelli/eslint-config
// lints that tooling; type-checking rules are deactivated by the config (the
// types-in-JS workflow delegates those to tsc), so JSDoc @typedef/@property style
// is preserved.
//
// Options chosen to fit the repo rather than reshape it:
//   - noMocha:   the check-*.mjs use a hand-rolled test() harness, not Mocha.
//   - semi:false keep the existing no-semicolon style (neostandard's own default).
//   - cliFiles:  scripts/, validate-plugin.mjs and the .claude/workflows/ sweep
//                drivers ARE CLI tools, so process.exit(), console, and sync I/O
//                are correct there — relax those rules for them only. lib/ stays
//                library-strict apart from two files that are CLI PLUMBING
//                rather than business logic, and would otherwise force every
//                caller to reimplement what they exist to share:
//                  lib/check-harness.mjs — PASS/FAIL logging + process.exit(1)
//                    on failure ARE its job for the scripts/check-*.mjs suite.
//                  lib/ndjson.mjs — the shared NDJSON reader/writer for the
//                    sweep drivers, all of which are one-shot processes where
//                    sequential sync I/O is the point; making it async would
//                    infect four call sites for no concurrency gain.
export default [
  {
    // Only the top-level `.claude/workflows/*.js` orchestrators are ignored. They
    // run in the Workflow sandbox against injected globals (agent, pipeline,
    // parallel, phase, args, budget) that no config here declares, so they are
    // agent-runtime scripts rather than source. tsconfig excludes them for the
    // same reason.
    //
    // Their `<name>/*.mjs` DRIVERS are a different thing and are deliberately NOT
    // ignored: plain Node CLI programs, no injected globals, and the place every
    // measurement in the report comes from. They are linted, type-checked and
    // ast-grep'd like the rest of the source tree.
    ignores: ['.claude/workflows/*.js'],
  },
  ...voxpelli({
    noMocha: true,
    semi: false,
    // extensions/ is the Pi extension (JS with JSDoc types); agent-sync + config
    // do intentional sync file I/O (atomic copy, manifest/config read-write), so
    // they get the same CLI relaxation as scripts/.
    cliFiles: ['scripts/**/*.mjs', '.claude/workflows/**/*.mjs', 'validate-plugin.mjs', 'lib/check-harness.mjs', 'lib/ndjson.mjs', 'extensions/agent-sync.js', 'extensions/config.js'],
  }),
  {
    name: 'vp-knowledge/repo-style',
    rules: {
      // This toolkit parses and emits JSON manifests + NDJSON wire formats where
      // `null` is the correct (and only) representation — `undefined` drops keys
      // from JSON.stringify and would break the fixture-tested NDJSON contract.
      'unicorn/no-null': 'off',
      // The repo uses uniform NAMED imports for node builtins (node:fs, node:path).
      // import-style would force node:path alone to a default import, making the
      // codebase internally inconsistent across ~70 call sites for pure style churn.
      'unicorn/import-style': 'off',
      // This is file-validation tooling: it reads the plugin's OWN files by paths
      // computed from CLAUDE_PLUGIN_ROOT / argv — never untrusted external input.
      // The non-literal-fs/regexp "taint" warnings are inherent noise here.
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
      // Keep no-warning-comments (fixme) on — a `// fixme` is the only warning we
      // intentionally surface; everything else is resolved or off.
      //
      // agent-sync sorts manifest keys in place — intentional and harmless.
      'unicorn/no-array-sort': 'off',
    },
  },
  {
    name: 'vp-knowledge/tests',
    files: ['test/**/*.js'],
    rules: {
      // Tests use sync fs for setup/teardown — sequential and deterministic.
      'n/no-sync': 'off',
    },
  },
]
