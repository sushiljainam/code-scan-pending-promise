// FILE: rules/promise-constructor-exactly-one-callback.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure Promise constructor calls exactly one callback (resolve or reject) in each execution path',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      missingParameters: 'Promise constructor must have both resolve and reject parameters',
      noCallback: 'Execution path must call exactly one callback (resolve or reject)',
      multipleCallbacks: 'Execution path calls multiple callbacks - each path should call exactly one',
      unreachableCallback: 'Callback is unreachable after return statement',
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

    function getParameterNames(executorFn) {
      const params = executorFn.params;
      if (params.length < 2) return null;
      
      return {
        resolve: params[0] ? params[0].name : null,
        reject: params[1] ? params[1].name : null,
      };
    }

    function analyzeExecutionPaths(callbackBody, resolveParam, rejectParam) {
      const issues = [];
      
      // Analyze all possible execution paths
      const paths = findAllExecutionPaths(callbackBody);
      console.debug('paths.length', paths.length);
      
      for (const path of paths) {
        const callbackCount = countCallbacksInPath(path, resolveParam, rejectParam);
        console.debug('callbackCount', callbackCount);
        
        if (callbackCount === 0) {
          issues.push({
            node: path.endNode || callbackBody,
            messageId: 'noCallback',
          });
        } else if (callbackCount > 1) {
          issues.push({
            node: path.endNode || callbackBody,
            messageId: 'multipleCallbacks',
          });
        }
      }
      
      return issues;
    }

    function findAllExecutionPaths(callbackBody) {
      if (callbackBody.type !== 'BlockStatement') {
        return [{ statements: [callbackBody], endNode: callbackBody }];
      }

      return analyzeBlock(callbackBody.body);
    }

    function analyzeBlock(statements) {
      const paths = [];
      let currentPath = [];
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        
        // Handle control flow statements
        if (stmt.type === 'IfStatement') {
          const ifPaths = analyzeIfStatement(stmt, currentPath);
          paths.push(...ifPaths);
          
          // If both branches return/throw, no continuation
          const allBranchesTerminate = ifPathsTerminate(stmt);
          if (allBranchesTerminate) {
            return paths;
          }
          
          // Continue with statements after if
          currentPath = [...currentPath, stmt];
        } else if (stmt.type === 'TryStatement') {
          const tryPaths = analyzeTryStatement(stmt, currentPath);
          // TODO: what about try/catch/finally block terminating or not-terminating?
          paths.push(...tryPaths);
          currentPath = [...currentPath, stmt];
        } else if (stmt.type === 'SwitchStatement') {
          const switchPaths = analyzeSwitchStatement(stmt, currentPath);
          paths.push(...switchPaths);
          
          // If all cases have return/break, no continuation
          const allCasesTerminate = switchCasesTerminate(stmt);
          if (allCasesTerminate) {
            return paths;
          }
          
          currentPath = [...currentPath, stmt];
        } else if (stmt.type === 'ForStatement' || stmt.type === 'WhileStatement' || stmt.type === 'DoWhileStatement') {
          const loopPaths = analyzeLoopStatement(stmt, currentPath);
          paths.push(...loopPaths);
          currentPath = [...currentPath, stmt];
        } else if (stmt.type === 'ReturnStatement' || stmt.type === 'ThrowStatement') {
          // Path terminates here
          paths.push({
            statements: [...currentPath, stmt],
            endNode: stmt,
            terminates: true
          });
          return paths; // No statements after return/throw are reachable
        } else {
          currentPath.push(stmt);
        }
      }
      
      // Add the main path if it doesn't terminate
      if (currentPath.length > 0) {
        paths.push({
          statements: currentPath,
          endNode: currentPath[currentPath.length - 1]
        });
      }
      
      return paths;
    }

    function analyzeSwitchStatement(switchStmt, currentPath) {
      const paths = [];
      const cases = switchStmt.cases;
      let hasDefault = false;
      
      for (const caseNode of cases) {
        if (caseNode.test === null) { // default case
          hasDefault = true;
        }
        
        const caseStatements = caseNode.consequent;
        if (caseStatements.length > 0) {
          const casePaths = analyzeBlock([...currentPath, ...caseStatements]);
          paths.push(...casePaths);
        } else {
          // Empty case - fallthrough or missing implementation
          paths.push({
            statements: currentPath,
            endNode: caseNode,
            isEmpty: true
          });
        }
      }
      
      // If no default case, there's an implicit path that does nothing
      if (!hasDefault) {
        paths.push({
          statements: currentPath,
          endNode: switchStmt,
          isImplicitDefault: true
        });
      }
      
      return paths;
    }

    function analyzeLoopStatement(loopStmt, currentPath) {
      const paths = [];
      
      // Analyze loop body
      const bodyStatements = loopStmt.body.type === 'BlockStatement' 
        ? loopStmt.body.body 
        : [loopStmt.body];
      
      // Loop body paths (may execute 0 or more times)
      const bodyPaths = analyzeBlock([...currentPath, ...bodyStatements]);
      paths.push(...bodyPaths);
      
      // Path where loop doesn't execute or exits normally
      paths.push({
        statements: currentPath,
        endNode: loopStmt,
        isLoopSkip: true
      });
      
      return paths;
    }

    function switchCasesTerminate(switchStmt) {
      const cases = switchStmt.cases;
      let hasDefault = false;
      
      for (const caseNode of cases) {
        if (caseNode.test === null) hasDefault = true;
        
        // Check if this case terminates
        const caseTerminates = caseNode.consequent.some(stmt => 
          stmt.type === 'ReturnStatement' || 
          stmt.type === 'ThrowStatement' ||
          stmt.type === 'BreakStatement'
        );
        
        if (!caseTerminates) return false;
      }
      
      return hasDefault; // All cases terminate only if we also have default
    }

    function analyzeIfStatement(ifStmt, currentPath) {
      const paths = [];
      
      // Analyze then branch
      const thenStatements = ifStmt.consequent.type === 'BlockStatement' 
        ? ifStmt.consequent.body 
        : [ifStmt.consequent];
      const thenPaths = analyzeBlock([...currentPath, ...thenStatements]);
      
      // Analyze else branch (or create empty else path)
      let elsePaths;
      if (ifStmt.alternate) {
        const elseStatements = ifStmt.alternate.type === 'BlockStatement'
          ? ifStmt.alternate.body
          : [ifStmt.alternate];
        elsePaths = analyzeBlock([...currentPath, ...elseStatements]);
      } else {
        // No else branch = empty path that continues after if
        elsePaths = [{
          statements: currentPath,
          endNode: ifStmt,
          continuesAfterIf: true
        }];
      }
      
      paths.push(...thenPaths, ...elsePaths);
      return paths;
    }

    function analyzeTryStatement(tryStmt, currentPath) {
      const paths = [];
      
      // Analyze try block
      const tryStatements = tryStmt.block.body;
      const tryPaths = analyzeBlock([...currentPath, ...tryStatements]);
      
      // Analyze catch block
      if (tryStmt.handler) {
        const catchStatements = tryStmt.handler.body.body;
        const catchPaths = analyzeBlock([...currentPath, ...catchStatements]);
        paths.push(...catchPaths);
      } // TODO: handler present handled, not present?
      // TODO: what about optional finally block?
      
      paths.push(...tryPaths);
      return paths;
    }

    function ifPathsTerminate(ifStmt) {
      const thenTerminates = pathTerminates(ifStmt.consequent);
      const elseTerminates = ifStmt.alternate ? pathTerminates(ifStmt.alternate) : false;
      
      return thenTerminates && elseTerminates;
    }

    function pathTerminates(node) {
      if (!node) return false;
      
      if (node.type === 'ReturnStatement' || node.type === 'ThrowStatement') {
        return true;
      }
      
      if (node.type === 'BlockStatement') {
        return node.body.some(stmt => pathTerminates(stmt));
      }
      
      return false;
    }

    function countCallbacksInPath(path, resolveParam, rejectParam) {
      let count = 0;
      
      for (const stmt of path.statements) {
        count += countCallbacksInStatement(stmt, resolveParam, rejectParam);
      }
      
      return count;
    }

    function countCallbacksInStatement(stmt, resolveParam, rejectParam) {
      let count = 0;
      
      function traverse(node) {
        if (!node || typeof node !== 'object') return;
        
        if (node.type === 'CallExpression' && 
            node.callee && 
            node.callee.type === 'Identifier') {
          const callName = node.callee.name;
          if (callName === resolveParam || callName === rejectParam) {
            count++;
          }
        }
        
        // Recursively traverse child nodes
        for (const key in node) {
          if (key === 'parent' || key === 'range' || key === 'loc') continue;
          
          const child = node[key];
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
      
      traverse(stmt);
      return count;
    }

    return {
      NewExpression(node) {
        if (!isPromiseConstructor(node)) return;

        const executorFn = getExecutorFunction(node);
        if (!executorFn) return;

        const params = getParameterNames(executorFn);
        if (!params) {
          context.report({
            node: executorFn,
            messageId: 'missingParameters',
          });
          return;
        }

        const { resolve, reject } = params;
        if (!resolve || !reject) {
          context.report({
            node: executorFn,
            messageId: 'missingParameters',
          });
          return;
        }

        // Analyze execution paths
        const issues = analyzeExecutionPaths(executorFn.body, resolve, reject);
        
        issues.forEach(issue => {
          context.report({
            node: issue.node,
            messageId: issue.messageId,
          });
        });
      },
    };
  },
};
