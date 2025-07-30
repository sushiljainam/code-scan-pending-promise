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
    // Valid: return resolve()
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            return resolve('success');
          }
          reject(new Error('fallback'));
        });
      `,
    },
    // Valid: resolve then return on same line
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            resolve('success'); return;
          }
          reject(new Error('fallback'));
        });
      `,
    },
    // Valid: Try-catch-finally with callbacks only in try/catch
    {
      code: `
        new Promise((resolve, reject) => {
          try {
            resolve(riskyOperation());
          } catch (error) {
            reject(error);
          } finally {
            cleanup();
          }
        });
      `,
    },
    // Valid: Return in if only, callback after
    {
      code: `
        new Promise((resolve, reject) => {
          if (shouldReturn) {
            return;
          }
          resolve('success');
        });
      `,
    },
    // Valid: Return in else only, callback after
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            resolve('success');
          } else {
            return;
          }
        });
      `,
    },
    // Valid: Return in both if/else, no code after
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            resolve('success');
            return;
          } else {
            reject(new Error('error'));
            return;
          }
        });
      `,
    },
    // Valid: Return in both if/else, code after (unreachable)
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            resolve('success');
            return;
          } else {
            reject(new Error('error'));
            return;
          }
          console.log('unreachable');
        });
      `,
    },
    // Valid: Nested if-else with returns
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition1) {
            if (condition2) {
              return resolve('nested success');
            }
            reject(new Error('nested error'));
          } else {
            resolve('main success');
          }
        });
      `,
    },
    // Valid: Switch statement with returns
    {
      code: `
        new Promise((resolve, reject) => {
          switch (status) {
            case 'success':
              return resolve('ok');
            case 'error':
              return reject(new Error('fail'));
            default:
              resolve('default');
          }
        });
      `,
    },
    // Valid: Arrow function with implicit return
    {
      code: `
        new Promise((resolve, reject) => resolve('immediate'));
      `,
    },
    // Valid: Async operations with proper control flow
    {
      code: `
        new Promise((resolve, reject) => {
          setTimeout(() => {
            if (condition) {
              resolve('delayed success');
            } else {
              reject(new Error('delayed error'));
            }
          }, 100);
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
      `,
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
    // Invalid: resolve then return on new line, then another callback
    {
      code: `
        new Promise((resolve, reject) => {
          resolve('success');
          return;
          reject(new Error('unreachable but still invalid'));
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
    // Invalid: return on new line after resolve, then another callback
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            resolve('success');
            return;
          }
          resolve('fallback'); // This creates a potential second callback
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
    // Invalid: Try-catch-finally with callback in finally
    {
      code: `
        new Promise((resolve, reject) => {
          try {
            resolve(riskyOperation());
          } catch (error) {
            reject(error);
          } finally {
            resolve('finally callback'); // Invalid
          }
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
    // Invalid: Return in if only, multiple callbacks after
    {
      code: `
        new Promise((resolve, reject) => {
          if (shouldReturn) {
            return;
          }
          resolve('success');
          reject(new Error('error'));
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
    // Invalid: Return in else only, callback in if and after
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            resolve('success');
          } else {
            return;
          }
          reject(new Error('fallback'));
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
    // Invalid: Callback after try-catch when both have callbacks
    {
      code: `
        new Promise((resolve, reject) => {
          try {
            resolve(riskyOperation());
          } catch (error) {
            reject(error);
          }
          resolve('extra callback');
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
    // Invalid: Multiple callbacks in nested conditions
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition1) {
            if (condition2) {
              resolve('nested success');
              resolve('duplicate in nested');
            } else {
              reject(new Error('nested error'));
            }
          } else {
            resolve('main success');
          }
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
    // Invalid: Switch statement with fallthrough causing multiple callbacks
    {
      code: `
        new Promise((resolve, reject) => {
          switch (status) {
            case 'success':
              resolve('ok');
            case 'partial': // No break, falls through
              resolve('partial ok');
              break;
            default:
              reject(new Error('fail'));
          }
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
    // Invalid: Callback in loop (potential multiple executions)
    {
      code: `
        new Promise((resolve, reject) => {
          for (let i = 0; i < items.length; i++) {
            if (items[i].isValid()) {
              resolve(items[i]);
            }
          }
          reject(new Error('no valid items'));
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
    // Invalid: Both sync and async callbacks
    {
      code: `
        new Promise((resolve, reject) => {
          resolve('immediate');
          setTimeout(() => {
            resolve('delayed');
          }, 100);
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
    // Invalid: No callback in complete if-else structure
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            console.log('condition true');
          } else {
            console.log('condition false');
          }
        });
      `,
      errors: [{
        messageId: 'noCallback',
      }],
    },
    // Invalid: Callback only in some branches of switch
    {
      code: `
        new Promise((resolve, reject) => {
          switch (status) {
            case 'success':
              resolve('ok');
              break;
            case 'error':
              // No callback here
              break;
            default:
              reject(new Error('default'));
          }
        });
      `,
      errors: [{
        messageId: 'noCallback',
      }],
    },
    // Invalid: Return resolve with additional callback
    {
      code: `
        new Promise((resolve, reject) => {
          if (condition) {
            return resolve('success');
          }
          resolve('fallback');
          reject(new Error('extra'));
        });
      `,
      errors: [{
        messageId: 'multipleCallbacks',
      }],
    },
  ],
};

ruleTester.run('promise-constructor-exactly-one-callback', rule, {
  // valid: [
  //   // cases.valid[0],
  //   // cases.valid[1],
  //   // cases.valid[2],
  //   // cases.valid[3],
  //   // cases.valid[4],
  //   // cases.valid[5],
  //   // cases.valid[6],
  //   // cases.valid[7],
  //   cases.valid[8],
  //   // cases.valid[9],
  // ],
  // invalid: [
  //   // cases.invalid[0],
  //   // cases.invalid[1],
  //   // cases.invalid[2],
  //   // cases.invalid[3],
  //   // cases.invalid[4],
  //   // cases.invalid[5],
  // ],
  valid: cases.valid,
  invalid: cases.invalid,
});

console.log('All rule tests passed!');
