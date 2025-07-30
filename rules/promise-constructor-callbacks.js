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

      // Analyze all execution paths to ensure each path calls resolve or reject
      return analyzeAllPaths(executorFn.body, targetCalls);
    }

    function analyzeAllPaths(node, targetCalls) {
      if (!node) return false;

      // For a block statement, analyze the execution flow
      if (node.type === 'BlockStatement') {
        return analyzeBlockStatement(node, targetCalls);
      }

      // For other node types, check if they contain target calls
      return containsTargetCall(node, targetCalls);
    }

    function analyzeBlockStatement(blockNode, targetCalls) {
      const statements = blockNode.body;
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        
        // If we find a direct call to resolve/reject, this path is valid
        if (containsTargetCall(stmt, targetCalls)) {
          return true;
        }
        
        // Handle control flow statements
        if (stmt.type === 'IfStatement') {
          const thenHasCall = analyzeAllPaths(stmt.consequent, targetCalls);
          const elseHasCall = stmt.alternate ? 
            analyzeAllPaths(stmt.alternate, targetCalls) : 
            false; // No else branch means this path doesn't call resolve/reject
          
          // Both branches must have calls for the if statement to be valid
          if (thenHasCall && elseHasCall) {
            return true;
          }
          // If only one branch has a call, we need to continue checking
          // the rest of the block to see if there's a fallback
        }
        
        if (stmt.type === 'TryStatement') {
          const tryHasCall = analyzeAllPaths(stmt.block, targetCalls);
          const catchHasCall = stmt.handler ? 
            analyzeAllPaths(stmt.handler.body, targetCalls) : 
            false;
          
          // Both try and catch should have calls
          if (tryHasCall && catchHasCall) {
            return true;
          }
        }
        
        // Handle return statements - they end execution
        if (stmt.type === 'ReturnStatement') {
          return containsTargetCall(stmt, targetCalls);
        }
        
        // Handle throw statements - they end execution
        if (stmt.type === 'ThrowStatement') {
          return false; // Throwing without calling resolve/reject is invalid
        }
      }
      
      // If we reach here, no statement in the block called resolve/reject
      return false;
    }

    function containsTargetCall(node, targetCalls) {
      if (!node) return false;
      
      // Direct call check
      if (node.type === 'CallExpression' && 
          node.callee && 
          node.callee.type === 'Identifier' &&
          targetCalls.includes(node.callee.name)) {
        return true;
      }
      
      // Expression statement wrapper
      if (node.type === 'ExpressionStatement') {
        return containsTargetCall(node.expression, targetCalls);
      }
      
      // Recursively check child nodes
      for (const key in node) {
        if (key === 'parent' || key === 'range' || key === 'loc') continue;
        
        const child = node[key];
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item && typeof item === 'object' && item.type) {
              if (containsTargetCall(item, targetCalls)) {
                return true;
              }
            }
          }
        } else if (child && typeof child === 'object' && child.type) {
          if (containsTargetCall(child, targetCalls)) {
            return true;
          }
        }
      }
      
      return false;
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
