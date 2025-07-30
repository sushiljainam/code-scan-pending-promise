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
        console.debug('callbackCount', callbackCount, 'terminated:', path.terminated);

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
        return [{ statements: [callbackBody], endNode: callbackBody, terminated: 'no' }];
      }

      return analyzeBlock(callbackBody.body);
    }

    function analyzeBlock(statements, currentPath = []) {
      const paths = [];
      let workingPath = [...currentPath];
      
      console.log('statements.length', statements.length);
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        
        // Handle control flow statements
        if (stmt.type === 'IfStatement') {
          const ifPaths = analyzeIfStatement(stmt, workingPath);
          
          // Find remaining statements after the if block
          const remainingStatements = statements.slice(i + 1);

          // Continue execution only for non-terminated paths
          const continuingPaths = [];
          for (const path of ifPaths) {
            if (path.terminated === 'no' && remainingStatements.length > 0) {
              // Continue with remaining statements for non-terminated paths
              const continuedPaths = analyzeBlock(remainingStatements, path.statements);
              continuingPaths.push(...continuedPaths);
            } else {
              // Terminated paths or no remaining statements
              continuingPaths.push(path);
            }
          }
          
          paths.push(...continuingPaths);
          return paths; // We've handled all remaining statements

        } else if (stmt.type === 'TryStatement') {
          const tryPaths = analyzeTryStatement(stmt, workingPath);
          
          // Find remaining statements after try block
          const remainingStatements = statements.slice(i + 1);
          
          const continuingPaths = [];
          for (const path of tryPaths) {
            if (path.terminated === 'no' && remainingStatements.length > 0) {
              const continuedPaths = analyzeBlock(remainingStatements, path.statements);
              continuingPaths.push(...continuedPaths);
            } else {
              continuingPaths.push(path);
            }
          }

          paths.push(...continuingPaths);
          return paths;

        } else if (stmt.type === 'SwitchStatement') {
          const switchPaths = analyzeSwitchStatement(stmt, workingPath);

          const remainingStatements = statements.slice(i + 1);

          const continuingPaths = [];
          for (const path of switchPaths) {
            if (path.terminated === 'no' && remainingStatements.length > 0) {
              const continuedPaths = analyzeBlock(remainingStatements, path.statements);
              continuingPaths.push(...continuedPaths);
            } else {
              continuingPaths.push(path);
            }
          }

          paths.push(...continuingPaths);
          return paths;

        } else if (stmt.type === 'ForStatement' || stmt.type === 'WhileStatement' || stmt.type === 'DoWhileStatement') {
          const loopPaths = analyzeLoopStatement(stmt, workingPath);

          const remainingStatements = statements.slice(i + 1);

          const continuingPaths = [];
          for (const path of loopPaths) {
            if (path.terminated === 'no' && remainingStatements.length > 0) {
              const continuedPaths = analyzeBlock(remainingStatements, path.statements);
              continuingPaths.push(...continuedPaths);
            } else {
              continuingPaths.push(path);
            }
          }

          paths.push(...continuingPaths);
          return paths;

        } else if (stmt.type === 'ReturnStatement') {
          // Path terminates here with return
          workingPath.push(stmt);
          paths.push({
            statements: workingPath,
            endNode: stmt,
            terminated: 'yes'
          });
          return paths; // No statements after return are reachable

        } else if (stmt.type === 'ThrowStatement') {
          // Path terminates here with throw
          workingPath.push(stmt);
          paths.push({
            statements: workingPath,
            endNode: stmt,
            terminated: 'thrown'
          });
          return paths; // No statements after throw are reachable

        } else {
          workingPath.push(stmt);
        }
      }

      // Add the main path if it doesn't terminate
      if (workingPath.length > 0) {
        paths.push({
          statements: workingPath,
          endNode: workingPath[workingPath.length - 1],
          terminated: 'no'
        });
      }
      
      return paths;
    }

    function analyzeIfStatement(ifStmt, currentPath) {
      const paths = [];
      
      // Analyze then branch
      const thenStatements = ifStmt.consequent.type === 'BlockStatement' 
        ? ifStmt.consequent.body 
        : [ifStmt.consequent];
      const thenPaths = analyzeBlock(thenStatements, [...currentPath]);
      
      // Analyze else branch (or create empty else path)
      let elsePaths;
      if (ifStmt.alternate) {
        const elseStatements = ifStmt.alternate.type === 'BlockStatement'
          ? ifStmt.alternate.body
          : [ifStmt.alternate];
        elsePaths = analyzeBlock(elseStatements, [...currentPath]);
      } else {
        // No else branch = empty path that continues after if
        elsePaths = [{
          statements: [...currentPath],
          endNode: ifStmt,
          terminated: 'no',
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
      const tryPaths = analyzeBlock(tryStatements, [...currentPath]);
      
      // Analyze catch block if present
      if (tryStmt.handler) {
        const catchStatements = tryStmt.handler.body.body;
        const catchPaths = analyzeBlock(catchStatements, [...currentPath]);
        paths.push(...catchPaths);
      }

      // Analyze finally block if present
      if (tryStmt.finalizer) {
        const finallyStatements = tryStmt.finalizer.body;
        // Finally block runs after both try and catch, so we need to handle this carefully
        const modifiedTryPaths = [];

        for (const tryPath of tryPaths) {
          if (tryPath.terminated === 'no') {
            // Continue with finally block
            const finallyPaths = analyzeBlock(finallyStatements, tryPath.statements);
            modifiedTryPaths.push(...finallyPaths);
          } else {
            // Try path terminated, but finally still runs
            const finallyPaths = analyzeBlock(finallyStatements, tryPath.statements);
            modifiedTryPaths.push(...finallyPaths);
          }
        }

        paths.push(...modifiedTryPaths);
      } else {
        paths.push(...tryPaths);
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
          const casePaths = analyzeBlock(caseStatements, [...currentPath]);
          paths.push(...casePaths);
        } else {
          // Empty case - fallthrough or missing implementation
          paths.push({
            statements: [...currentPath],
            endNode: caseNode,
            terminated: 'no',
            isEmpty: true
          });
        }
      }
      
      // If no default case, there's an implicit path that does nothing
      if (!hasDefault) {
        paths.push({
          statements: [...currentPath],
          endNode: switchStmt,
          terminated: 'no',
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
      const bodyPaths = analyzeBlock(bodyStatements, [...currentPath]);
      paths.push(...bodyPaths);

      // Path where loop doesn't execute or exits normally
      paths.push({
        statements: [...currentPath],
        endNode: loopStmt,
        terminated: 'no',
        isLoopSkip: true
      });
      
      return paths;
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
