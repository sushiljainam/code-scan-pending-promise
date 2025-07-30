// These examples should fail linting

console.log('Testing bad Promise examples (these will show ESLint errors)...');

// ❌ No callbacks called
const badPromise1 = new Promise((resolve, reject) => {
  const data = fetchSomeData();
  console.log('Data fetched but no callback called');
});

// ❌ Missing reject parameter
const badPromise2 = new Promise((resolve) => {
  resolve('missing reject param');
});

// ❌ No parameters
const badPromise3 = new Promise(() => {
  console.log('No parameters provided');
});

// ❌ Conditional without else
const badPromise4 = new Promise((resolve, reject) => {
  const condition = true;
  if (condition) {
    resolve('success');
  }
  // Missing else case - what if condition is false?
});

// ❌ Only setting up listeners without calling callbacks
const badPromise5 = new Promise((resolve, reject) => {
  process.on('exit', () => {
    console.log('Process exiting');
  });
  // Neither resolve nor reject called
});

function fetchSomeData() {
  return { data: 'sample' };
}
