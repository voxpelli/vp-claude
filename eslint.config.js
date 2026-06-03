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
//   - cliFiles:  scripts/ + validate-plugin.mjs ARE CLI tools, so process.exit(),
//                console, and sync I/O are correct there — relax those rules for
//                them only (lib/ stays library-strict).
export default [
  ...voxpelli({
    noMocha: true,
    semi: false,
    cliFiles: ['scripts/**/*.mjs', 'validate-plugin.mjs'],
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
    },
  },
]
