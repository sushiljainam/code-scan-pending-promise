module.exports = {
  rules: {
    'promise-constructor-callbacks': require('./rules/promise-constructor-callbacks'),
  },
  configs: {
    recommended: {
      plugins: ['promise-rules'],
      rules: {
        'promise-rules/promise-constructor-callbacks': 'error',
      },
    },
  },
};
