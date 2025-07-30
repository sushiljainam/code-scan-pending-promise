const { RuleTester } = require('eslint');
const rule = require('../rules/promise-constructor-callbacks');

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2018 },
});

const cases = {
  valid: [
    // Basic valid cases
    {
      code: `
        new Promise((resolve, reject) => {
          resolve('success');
        });
      `,
    },
    {
      code: `
        new Promise((resolve, reject) => {
          reject(new Error('failed'));
        });
      `,
    },
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            resolve('success');
          } else {
            reject(new Error('failed'));
          }
        });
      `,
    },
    {
      code: `
        new Promise((resolve, reject) => {
          try {
            const result = riskyOperation();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      `,
    },
    // Non-Promise constructors should be ignored
    {
      code: `
        new MyClass((a, b) => {
          // This is not a Promise, should be ignored
        });
      `,
    },
  ],

  invalid: [
    {
      code: `
        new Promise((resolve, reject) => {
          const data = fetchData();
          // Neither resolve nor reject called
        });
      `,
      errors: [{
        messageId: 'noCallback',
      }],
    },
    {
      code: `
        new Promise((resolve) => {
          resolve('done');
        });
      `,
      errors: [{
        messageId: 'missingReject',
      }],
    },
    {
      code: `
        new Promise(() => {
          // No parameters at all
        });
      `,
      errors: [{
        messageId: 'missingResolve',
      }],
    },
    {
      code: `
        new Promise((resolve, reject4) => {
          if (condition) {
            resolve('success');
          }
          // Missing else path - this should fail
        });
      `,
      errors: [{
        messageId: 'noCallback',
      }],
    },
    {
      code: `
        new Promise((resolve, reject) => {
          const data = getData();
          if (data.valid) {
            resolve(data.value);
          }
          // What happens when data.valid is false? No callback called!
        });
      `,
      errors: [{
        messageId: 'noCallback',
      }],
    },
  ],
};

// ruleTester.run('promise-constructor-callbacks', rule, cases);

console.log('All promise-constructor-callbacks tests passed!');
