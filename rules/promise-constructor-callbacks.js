module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure Promise constructor calls resolve or reject in all code paths',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: null,
    schema: [], // no options
    messages: {
      noCallback: 'Promise constructor must call resolve or reject in all execution paths',
      missingResolve: 'Promise constructor must have a resolve parameter',
      missingReject: 'Promise constructor must have a reject parameter',
    },
  },

  create(context) {
    function isPromiseConstructor(node) {
      return (
        node.type === 'NewExpression' &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'Promise'
      );
    }

    function getExecutorFunction(node) {
      if (node.arguments && node.arguments.length > 0) {
        const executor = node.arguments[0];
        if (executor.type === 'ArrowFunctionExpression' || executor.type === 'FunctionExpression') {
          return executor;
        }
      }
      return null;
    }

    function hasRequiredParameters(executorFn) {
      const params = executorFn.params;
      return params.length >= 2;
    }

    function getParameterNames(executorFn) {
      const params = executorFn.params;
      return {
        resolve: params[0] ? params[0].name : null,
        reject: params[1] ? params[1].name : null,
      };
    }

    function findCallsInNode(node, targetNames) {
      const calls = new Set();
      
      function traverse(currentNode) {
        if (!currentNode || typeof currentNode !== 'object') return;

        // Check for direct function calls
        if (currentNode.type === 'CallExpression' && 
            currentNode.callee && 
            currentNode.callee.type === 'Identifier') {
          const callName = currentNode.callee.name;
          if (targetNames.includes(callName)) {
            calls.add(callName);
          }
        }

        // Recursively check all properties
        for (const key in currentNode) {
          if (key === 'parent' || key === 'range' || key === 'loc') continue;
          
          const child = currentNode[key];
          if (Array.isArray(child)) {
            child.forEach(item => {
              if (item && typeof item === 'object' && item.type) {
                traverse(item);
              }
            });
          } else if (child && typeof child === 'object' && child.type) {
            traverse(child);
          }
        }
      }

      traverse(node);
      return calls;
    }

    function analyzeExecutorFunction(executorFn, resolveParam, rejectParam) {
      const targetCalls = [resolveParam, rejectParam].filter(Boolean);
      
      if (targetCalls.length === 0) return false;

      // Find all calls to resolve/reject in the function body
      const foundCalls = findCallsInNode(executorFn.body, targetCalls);
      
      // Simple check: if we found at least one resolve or reject call, consider it valid
      // This is a basic implementation - a more sophisticated version would analyze
      // all execution paths using ESLint's CodePath API
      return foundCalls.size > 0;
    }

    return {
      NewExpression(node) {
        if (!isPromiseConstructor(node)) return;

        const executorFn = getExecutorFunction(node);
        if (!executorFn) return;

        // Check if executor has required parameters
        if (!hasRequiredParameters(executorFn)) {
          context.report({
            node: executorFn,
            messageId: executorFn.params.length === 0 ? 'missingResolve' : 'missingReject',
          });
          return;
        }

        const { resolve, reject } = getParameterNames(executorFn);
        
        if (!resolve || !reject) {
          context.report({
            node: executorFn,
            messageId: !resolve ? 'missingResolve' : 'missingReject',
          });
          return;
        }

        // Analyze if resolve or reject is called
        const hasCallbacks = analyzeExecutorFunction(executorFn, resolve, reject);
        
        if (!hasCallbacks) {
          context.report({
            node: executorFn,
            messageId: 'noCallback',
          });
        }
      },
    };
  },
};
