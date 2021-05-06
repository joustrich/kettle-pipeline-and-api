module.exports = {
  env: {
    es6: true,
    node: true,
    jest: true,
  },
  extends: ['eslint:recommended', 'plugin:jest/recommended', 'plugin:jest/style', 'plugin:prettier/recommended'],
  ignorePatterns: ['test/dev/**'],
  parserOptions: {
    ecmaVersion: 2019,
    sourceType: 'module',
  },
};
