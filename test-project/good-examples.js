// These examples should pass linting

console.log('Testing good Promise examples...');

// ✅ Basic resolve
const promise1 = new Promise((resolve, reject) => {
  resolve('success');
});

// ✅ Basic reject
const promise2 = new Promise((resolve, reject) => {
  reject(new Error('failed'));
});

// ✅ Conditional with both paths
const promise3 = new Promise((resolve, reject) => {
  const condition = Math.random() > 0.5;
  if (condition) {
    resolve('success');
  } else {
    reject(new Error('failed'));
  }
});

// ✅ Try-catch pattern
const promise4 = new Promise((resolve, reject) => {
  try {
    const result = JSON.parse('{"valid": "json"}');
    resolve(result);
  } catch (error) {
    reject(error);
  }
});

// ✅ Async operation
const promise5 = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('delayed success');
  }, 100);
});

// ✅ Complex logic with multiple paths
const promise6 = new Promise((resolve, reject) => {
  const data = { status: 'ok' };
  
  if (data.status === 'ok') {
    resolve(data);
  } else if (data.status === 'error') {
    reject(new Error('Status error'));
  } else {
    reject(new Error('Unknown status'));
  }
});

console.log('All good examples are valid!');
