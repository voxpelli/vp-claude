/** @type {import('knip').KnipConfig} */
export default {
  entry: [
    'extensions/index.js',
    'extensions/config.js',
    'extensions/agent-sync.js',
    'extensions/settings-command.js',
    'extensions/update-agents-command.js',
    'test/*.test.js',
  ],
  ignore: [
    'coverage/**',
  ],
  ignoreBinaries: [],
  ignoreDependencies: [],
}
