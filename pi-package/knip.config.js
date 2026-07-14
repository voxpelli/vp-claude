/** @type {import('knip').KnipConfig} */
export default {
  entry: [
    'extensions/index.js',
    'test/*.test.js',
  ],
  ignore: [
    'coverage/**',
  ],
  ignoreBinaries: [
    // System tool used for shell script formatting checks
    'shfmt',
  ],
  ignoreDependencies: [],
}
