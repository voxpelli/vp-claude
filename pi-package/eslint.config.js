import { voxpelli } from '@voxpelli/eslint-config'

export default [
  ...voxpelli({
    noMocha: true,
    semi: false,
    // Agent sync and config modules perform intentional sync file operations
    // (copy, manifest write, config read). These are not performance-critical
    // and sync is the correct API for atomic/sequential file operations.
    cliFiles: ['extensions/agent-sync.js', 'extensions/config.js'],
  }),
  {
    name: 'vp-knowledge-pi/repo-style',
    rules: {
      // Named imports for node builtins are consistent with the parent repo.
      'unicorn/import-style': 'off',
      // Extension reads its OWN bundled files by computed paths — never untrusted input.
      'security/detect-non-literal-fs-filename': 'off',
      // null is the correct representation for JSON manifests and existence checks
      'unicorn/no-null': 'off',
      // Sorting manifest keys in place is intentional and harmless
      'unicorn/no-array-sort': 'off',
    },
  },
  {
    name: 'vp-knowledge-pi/tests',
    files: ['test/**/*.js'],
    rules: {
      // Tests use sync fs for setup/teardown — sequential and deterministic
      'n/no-sync': 'off',
    },
  },
]
