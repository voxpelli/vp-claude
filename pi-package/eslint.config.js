import { voxpelli } from '@voxpelli/eslint-config'

export default [
  ...voxpelli({
    noMocha: true,
    semi: false,
  }),
  {
    name: 'vp-knowledge-pi/repo-style',
    rules: {
      // Named imports for node builtins are consistent with the parent repo.
      'unicorn/import-style': 'off',
      // Extension reads its OWN bundled files by computed paths — never untrusted input.
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
]
