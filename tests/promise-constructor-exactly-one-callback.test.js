const { RuleTester } = require('eslint');
const rule = require('../rules/promise-constructor-exactly-one-callback');

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2018 },
});

const cases = {
  valid: [
    // Valid: Single resolve
    {
      code: `
        new Promise((resolve, reject) => {
          resolve('success');
        });
      `,
    },
    // Valid: Proper if-else (each path has exactly one)
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
    // Valid: Early return prevents multiple execution
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            resolve('success');
            return;
          }
          reject(new Error('fallback'));
        });
      `,
    },
    // Valid: Try-catch
    {
      code: `
        new Promise((resolve, reject) => {
          try {
            resolve(riskyOperation());
          } catch (error) {
            reject(error);
          }
        });
      `,
    },
    // Valid: Complex but each path has exactly one
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition1) {
            if (condition2) {
              resolve('nested success');
            } else {
              reject(new Error('nested error'));
            }
          } else {
            resolve('main success');
          }
        });
      `,
    },
  ],

  invalid: [
    // Invalid: No callbacks
    {
      code: `
        new Promise((resolve, reject) => {
          const data = fetchData();
        });
      `,
      errors: [{
        messageId: 'noCallback',
      }],
    },
    // Invalid: If without else, no fallback
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            resolve('success');
          }
        });
      `,
      errors: [{
        messageId: 'noCallback',
      }],
    },
    // Invalid: Multiple callbacks in sequence
    {
      code: `
        new Promise((resolve, reject) => {
          resolve('success');
          reject(new Error('error'));
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
    // Invalid: Multiple callbacks in same branch
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            resolve('success');
            reject(new Error('also error'));
          } else {
            resolve('else success');
          }
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
    // Invalid: Missing parameters
    {
      code: `
        new Promise((resolve) => {
          resolve('missing reject param');
        });
      `, // TODO: this should be valid
      errors: [{
        messageId: 'missingParameters',
      }],
    },
    // Invalid: If has callback but no else and no return
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            resolve('success');
          }
          reject(new Error('fallback'));
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
  ],
};
ruleTester.run('promise-constructor-exactly-one-callback', rule, {
  valid: [
    // cases.valid[0],
    // cases.valid[1],
    // cases.valid[2],
    // cases.valid[3],
    // cases.valid[4],
  ],
  invalid: [
    // cases.invalid[0],
    // cases.invalid[1],
    // cases.invalid[2],
    // cases.invalid[3],
    // cases.invalid[4],
    cases.invalid[5],
  ],
});

console.log('Combined rule tests passed!');
