module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:promise-rules/recommended'
  ],
  plugins: ['promise-rules'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'promise-rules/promise-constructor-callbacks': 'error',
    'no-unused-vars': 'warn',
  },
};
