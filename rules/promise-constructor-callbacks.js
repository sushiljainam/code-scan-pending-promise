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

      // Check if there's at least one execution path that doesn't call resolve/reject
      const hasUncoveredPath = hasPathWithoutCallback(executorFn.body, targetCalls);
      
      // If there's an uncovered path, the Promise is invalid
      return !hasUncoveredPath;
    }

    function hasPathWithoutCallback(node, targetCalls) {
      if (!node) return true; // Empty path = no callback called

      if (node.type === 'BlockStatement') {
        return analyzeBlock(node, targetCalls);
      }

      // For single statements, check if they guarantee a callback
      return !guaranteesCallback(node, targetCalls);
    }

    function analyzeBlock(blockNode, targetCalls) {
      const statements = blockNode.body;
      
      if (statements.length === 0) {
        return true; // Empty block = no callback called
      }

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        
        // If this statement guarantees a callback, no uncovered path from here
        if (guaranteesCallback(stmt, targetCalls)) {
          return false;
        }
        
        // Handle control flow that might create uncovered paths
        if (stmt.type === 'IfStatement') {
          const thenHasUncovered = hasPathWithoutCallback(stmt.consequent, targetCalls);
          const elseHasUncovered = stmt.alternate ? 
            hasPathWithoutCallback(stmt.alternate, targetCalls) : 
            true; // No else branch = uncovered path
          
          // If either branch has an uncovered path, there's a problem
          if (thenHasUncovered || elseHasUncovered) {
            // But continue checking the rest of the block - maybe there's a 
            // callback after the if statement that covers all paths
            continue;
          } else {
            // Both branches are covered, no uncovered path
            return false;
          }
        }
        
        if (stmt.type === 'TryStatement') {
          const tryHasUncovered = hasPathWithoutCallback(stmt.block, targetCalls);
          const catchHasUncovered = stmt.handler ? 
            hasPathWithoutCallback(stmt.handler.body, targetCalls) : 
            true; // No catch = uncovered error path
          
          if (tryHasUncovered || catchHasUncovered) {
            continue; // Keep checking rest of block
          } else {
            return false; // Both try and catch are covered
          }
        }
        
        // Return and throw statements end execution
        if (stmt.type === 'ReturnStatement' || stmt.type === 'ThrowStatement') {
          // If we reach a return/throw without calling resolve/reject, that's an uncovered path
          return !containsTargetCall(stmt, targetCalls);
        }
      }
      
      // If we get through all statements without finding a guaranteed callback,
      // there's an uncovered path (the "fall-through" path)
      return true;
    }

    function guaranteesCallback(node, targetCalls) {
      if (!node) return false;
      
      // Direct callback call
      if (containsTargetCall(node, targetCalls)) {
        return true;
      }
      
      // If statement guarantees callback only if both branches do
      if (node.type === 'IfStatement') {
        const thenGuarantees = guaranteesCallback(node.consequent, targetCalls);
        const elseGuarantees = node.alternate ? 
          guaranteesCallback(node.alternate, targetCalls) : 
          false; // No else = doesn't guarantee
        
        return thenGuarantees && elseGuarantees;
      }
      
      // Try statement guarantees callback if both try and catch do
      if (node.type === 'TryStatement') {
        const tryGuarantees = guaranteesCallback(node.block, targetCalls);
        const catchGuarantees = node.handler ? 
          guaranteesCallback(node.handler.body, targetCalls) : 
          false;
        
        return tryGuarantees && catchGuarantees;
      }
      
      // Block guarantees callback if any statement in it does
      if (node.type === 'BlockStatement') {
        return node.body.some(stmt => guaranteesCallback(stmt, targetCalls));
      }
      
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
      
      // Recursively check child nodes (but not into nested functions)
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
