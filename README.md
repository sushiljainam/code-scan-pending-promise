# ESLint Plugin: Promise Rules

Custom ESLint rules for Promise constructor validation.

## Installation

```bash
npm install eslint-plugin-promise-rules --save-dev
```

## Usage

Add to your `.eslintrc.js`:

```javascript
module.exports = {
  plugins: ['promise-rules'],
  rules: {
    'promise-rules/promise-constructor-callbacks': 'error'
  }
};
```

Or use the recommended config:

```javascript
module.exports = {
  extends: ['plugin:promise-rules/recommended']
};
```

## Rules

### `promise-constructor-callbacks`

Ensures Promise constructors:
- Have both `resolve` and `reject` parameters
- Call at least one callback in all execution paths

## Testing

```bash
# Run rule tests
npm test

# Test against example files
npm run test:examples
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Test locally
npm run publish:local
```
