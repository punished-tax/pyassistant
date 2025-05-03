import type { PyodideInterface } from 'pyodide';
import type { TestCase, TestExecutionResult } from '@/lib/test-result'; // Import the types


let pyodideInstance: PyodideInterface | null = null;
let pyodideLoadingPromise: Promise<PyodideInterface> | null = null;
// getPyodide function remains the same...
declare global {
  interface Window {
    loadPyodide: (config?: { indexURL?: string }) => Promise<PyodideInterface>;
  }
}
export async function getPyodide(): Promise<PyodideInterface> { 
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (pyodideLoadingPromise) {
    return pyodideLoadingPromise;
  }

  //start loading
  pyodideLoadingPromise = new Promise((resolve, reject) => {
    const indexURL = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/'; // Use latest version
    const scriptUrl = `${indexURL}pyodide.js`;

    // Check if the script is already loaded (e.g., by a previous attempt or another part of the app)
    if (window.loadPyodide) {
        console.log('Pyodide script already loaded, initializing...');
        window.loadPyodide({ indexURL })
            .then(loadedPyodide => {
                console.log('Pyodide initialized successfully (pre-loaded script)!');
                pyodideInstance = loadedPyodide;
                resolve(loadedPyodide);
            })
            .catch(error => {
                 console.error('Pyodide initialization failed (pre-loaded script):', error);
                 pyodideLoadingPromise = null; // Reset promise on failure
                 reject(error);
            });
        return; // Exit early
    }

    // If script not loaded, create and append a script tag
    console.log(`Loading Pyodide script from ${scriptUrl}...`);
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;

    script.onload = () => {
      console.log('Pyodide script loaded, initializing...');
      // Now window.loadPyodide should be available
      if (!window.loadPyodide) {
          const loadError = new Error("window.loadPyodide not found after script load.");
          console.error(loadError);
          pyodideLoadingPromise = null; // Reset promise on failure
          reject(loadError);
          return;
      }
      window.loadPyodide({ indexURL })
        .then(loadedPyodide => {
          console.log('Pyodide initialized successfully!');
          pyodideInstance = loadedPyodide;
          resolve(loadedPyodide);
        })
        .catch(error => {
          console.error('Pyodide initialization failed:', error);
          pyodideLoadingPromise = null; // Reset promise on failure
          reject(error);
        });
    };

    script.onerror = (error) => {
      console.error(`Failed to load Pyodide script from ${scriptUrl}:`, error);
      pyodideLoadingPromise = null; // Reset promise on failure
      reject(new Error(`Failed to load script: ${scriptUrl}`));
    };

    document.body.appendChild(script);
  });

  return pyodideLoadingPromise;
}

// Type for the result of running the reference solution for one input
export interface ReferenceRunResult {
  outputRepr: string | null; // The repr() string of the output, or null on error
  error: string | null;      // Error message if execution failed
  stdout?: string;           // Captured stdout/stderr during the run
}





// --- New Function: runReferenceSolution ---
export async function runReferenceSolution(
  pyodide: PyodideInterface,
  referenceSolutionCode: string,
  rawInput: string
): Promise<ReferenceRunResult> {

  let setupComplete = false;
  let capturedOutput = ''; // Combined stdout/stderr

  console.log(`Running reference solution for input: ${rawInput}`);

  try {
      // 1. Setup unique environment (minimal globals)
       pyodide.runPython(`
          import sys, io, traceback, ast
          # Store original stdout/stderr if they exist
          if '_ref_orig_stdout' not in globals():
              _ref_orig_stdout = sys.stdout
          if '_ref_orig_stderr' not in globals():
              _ref_orig_stderr = sys.stderr

          _ref_stdout_buffer = io.StringIO()
          _ref_stderr_buffer = io.StringIO()
          sys.stdout = _ref_stdout_buffer
          sys.stderr = _ref_stderr_buffer

          # Use the same safe_eval helper
          def safe_eval_ref(literal_str):
               try: return ast.literal_eval(literal_str)
               except Exception as e: return f"EVAL_ERROR: {e.__class__.__name__}: {e}"
      `);
      setupComplete = true;

      // 2. Load the reference solution code
      // Use different global names to avoid potential clashes if called concurrently (though unlikely)
      pyodide.globals.set('js_ref_solution_code', referenceSolutionCode);
      console.log("[runReferenceSolution] Executing Reference Code:\n", referenceSolutionCode); // LOG
      try {
           // Execute in a temporary scope to avoid polluting globals too much, although 'solve' needs to be global
           await pyodide.runPythonAsync(`
            # Define solve in the global scope from the reference code
            print("[PYTHON REF DEBUG] Executing reference code...")
            exec(js_ref_solution_code, globals())
            print("[PYTHON REF DEBUG] Reference code executed.")
        
            # Check if 'solve' exists and is callable from Python's perspective
            if 'solve' in globals():
                print(f"[PYTHON REF DEBUG] 'solve' found in Python globals. Type: {type(globals()['solve'])}")
                if callable(globals()['solve']):
                     print("[PYTHON REF DEBUG] 'solve' is callable in Python.")
                else:
                     print("[PYTHON REF DEBUG] WARNING: 'solve' found but is NOT callable in Python.")
            else:
                print("[PYTHON REF DEBUG] ERROR: 'solve' NOT found in Python globals after exec.")
                # Optional: print list of globals to see what *is* there
                # print("[PYTHON REF DEBUG] Globals:", list(k for k in globals().keys() if not k.startswith('_')) )
        
            del js_ref_solution_code
          `);
           // Clean up the temp global immediately
          // pyodide.runPython("del js_ref_solution_code")
      } catch (loadError: any) {
           console.error("Error loading reference solution code:", loadError);
           const loadStderr = pyodide.runPython("_ref_stderr_buffer.getvalue()") || "";
           throw new Error(`Syntax Error in Reference Solution: ${loadError.message}${loadStderr ? `\nDetails:\n${loadStderr}`:''}`);
      }

      // 3. Check if 'solve' exists NOW (defined by reference code)
      if (!pyodide.globals.has('solve') || typeof pyodide.globals.get('solve') !== 'function') {
           throw new Error("Reference solution code did not define a callable 'solve' function.");
      }

      // 4. Prepare input and execute
      pyodide.globals.set('js_ref_raw_input', rawInput);
      await pyodide.runPythonAsync(`
          _ref_actual_result_local = None
          _ref_error_occurred_str_local = None
          _ref_actual_repr_local = None

          try:
              _ref_input_val_local = safe_eval_ref(js_ref_raw_input)
              if isinstance(_ref_input_val_local, str) and _ref_input_val_local.startswith("EVAL_ERROR:"):
                  raise ValueError(f"Reference solution failed to evaluate input: {_ref_input_val_local}")

              if isinstance(_ref_input_val_local, tuple):
                   _ref_actual_result_local = solve(*_ref_input_val_local)
              else:
                   _ref_actual_result_local = solve(_ref_input_val_local)
              _ref_actual_repr_local = repr(_ref_actual_result_local)

          except Exception as e:
              _ref_error_occurred_str_local = traceback.format_exc()

          # Assign to globals
          js_ref_actual_repr_result = _ref_actual_repr_local
          js_ref_error_occurred_result = _ref_error_occurred_str_local
      `);

      // 5. Retrieve results
      const actualRepr = pyodide.globals.get('js_ref_actual_repr_result');
      const errorOccurred = pyodide.globals.get('js_ref_error_occurred_result');

      // Capture output *after* execution
      const currentStdout = pyodide.runPython("_ref_stdout_buffer.getvalue()") || "";
      const currentStderr = pyodide.runPython("_ref_stderr_buffer.getvalue()") || "";
      capturedOutput = (currentStdout + (currentStderr ? `\nSTDERR:\n${currentStderr}` : "")).trim() // || undefined; --> variable string not assignable to undefined or something

      if (errorOccurred) {
           console.error(`Reference solution failed for input "${rawInput}":\n${errorOccurred}`);
           return { outputRepr: null, error: errorOccurred, stdout: capturedOutput };
      }

      if (actualRepr === undefined || actualRepr === null) {
           console.error(`Reference solution returned invalid representation for input "${rawInput}". Got: ${actualRepr}`);
           return { outputRepr: null, error: "Reference solution produced an invalid result representation.", stdout: capturedOutput };
      }
      console.log(`Reference solution success for input "${rawInput}": Output = ${actualRepr}`);
      return { outputRepr: String(actualRepr), error: null, stdout: capturedOutput };

  } catch (error: any) {
      // Catch errors during setup, loading, or execution
      console.error(`Critical error running reference solution for input "${rawInput}":`, error);
       let errorStderr = '';
       try { if(setupComplete) errorStderr = pyodide.runPython("_ref_stderr_buffer.getvalue()") || ""; } catch(e) {/*ignored*/}
      return {
          outputRepr: null,
          error: `Execution Error: ${error.message}${errorStderr ? `\nDetails:\n${errorStderr}`:''}`,
          stdout: undefined // Stdout might not be reliable here
      };
  } finally {
      // Cleanup
      if (setupComplete) {
          try {
              pyodide.runPython(`
                  if '_ref_orig_stdout' in globals(): sys.stdout = _ref_orig_stdout
                  if '_ref_orig_stderr' in globals(): sys.stderr = _ref_orig_stderr
                  g = globals()
                  for name in ['_ref_orig_stdout', '_ref_orig_stderr', '_ref_stdout_buffer', '_ref_stderr_buffer', 'safe_eval_ref', 'js_ref_raw_input', 'js_ref_actual_repr_result', 'js_ref_error_occurred_result', 'solve']: # Clean up solve too
                      if name in g: del g[name]
              `);
          } catch (cleanupError) {
              console.warn("Error during reference solution cleanup:", cleanupError);
          }
      }
  }
}


// --- runPythonCodeWithTests function remains the same as the last working version ---
// It will receive the TestCase[] generated using runReferenceSolution
export async function runPythonCodeWithTests(
  pyodide: PyodideInterface,
  userCode: string,
  testCases: TestCase[] // These are the dynamically generated ones
): Promise<TestExecutionResult> {
  // ... (Keep the implementation from the previous step)
   // ... (uses _orig_stdout, _global_stdout_buffer etc internally - separate from _ref_ ones)
    let setupComplete = false;
  let initialStderr = ''; // Capture initial stderr
  let accumulatedStdout = ''; // Capture setup stdout

  try {
      // --- 1. Setup Environment & Load User Code ---
      console.log("Setting up USER test environment...");
      pyodide.runPython(`
          import sys
          import io
          import traceback
          import ast

          # Store original stdout/stderr if they exist (might run multiple times)
          if '_orig_stdout' not in globals():
              _orig_stdout = sys.stdout
          if '_orig_stderr' not in globals():
              _orig_stderr = sys.stderr

          _global_stdout_buffer = io.StringIO()
          _global_stderr_buffer = io.StringIO()
          sys.stdout = _global_stdout_buffer
          sys.stderr = _global_stderr_buffer

          # Use the same safe_eval helper
          def safe_eval(literal_str):
              try:
                  return ast.literal_eval(literal_str)
              except Exception as e:
                  return f"EVAL_ERROR: {e.__class__.__name__}: {e}"
      `);
      setupComplete = true; // Mark setup as done for finally block

      console.log("Loading user code...");
      try {
          await pyodide.runPythonAsync(userCode);
      } catch (loadError: any) {
           console.error("Syntax Error or loading issue:", loadError);
           initialStderr = pyodide.runPython("_global_stderr_buffer.getvalue()") || "";
           // Throw specific error for outer catch
           throw new Error(`Syntax Error: ${loadError.message}${initialStderr ? `\nDetails:\n${initialStderr}`:''}`);
      }

      // Capture and clear buffers after successful load
      accumulatedStdout = pyodide.runPython("_global_stdout_buffer.getvalue()") || "";
      initialStderr = pyodide.runPython("_global_stderr_buffer.getvalue()") || ""; // May contain warnings even on success
      pyodide.runPython("_global_stdout_buffer.seek(0); _global_stdout_buffer.truncate(0)");
      pyodide.runPython("_global_stderr_buffer.seek(0); _global_stderr_buffer.truncate(0)");
      if (initialStderr) {
           accumulatedStdout += `\nINITIAL STDERR:\n${initialStderr}`; // Append warnings if any
      }


      // --- 2. Check if 'solve' function exists ---
      const solveExists = pyodide.globals.has('solve');
      if (!solveExists || typeof pyodide.globals.get('solve') !== 'function') {
          throw new Error("Function 'solve' not defined in your code or is not callable.");
      }
      console.log("'solve' function found in user code.");

      // --- 3. Run Test Cases ---
      if (!testCases || testCases.length === 0) {
           throw new Error("No test cases provided to run against user code.");
      }
      console.log(`Running ${testCases.length} generated test cases against user code...`);
      for (let i = 0; i < testCases.length; i++) {
          const testCase = testCases[i]; // This now contains the generated expected output
          const testCaseNum = i + 1;
          console.log(`Running User Test Case ${testCaseNum}: Input = ${testCase.input}`);

          // Prepare inputs for Python side
          pyodide.globals.set('js_input_str', testCase.input);

          let actualRepr: string | null | undefined = undefined;
          let errorOccurred: string | null | undefined = undefined;
          let currentCombinedOutput: string | undefined = undefined;

          try {
               // Execute user's solve function
               await pyodide.runPythonAsync(`
                  _actual_result_local = None
                  _error_occurred_str_local = None
                  _actual_repr_local = "DEFAULT_REPR_NOT_SET" # Use a distinct default string

                  try:
                      _input_val_local = safe_eval(js_input_str)
                      if isinstance(_input_val_local, str) and _input_val_local.startswith("EVAL_ERROR:"):
                          # This should ideally not happen if input eval worked for reference solution
                          raise ValueError(f"Internal Error: Failed to evaluate test input for user run: {_input_val_local}")

                      # Call USER'S solve function
                      if isinstance(_input_val_local, tuple):
                           _actual_result_local = solve(*_input_val_local)
                      else:
                           _actual_result_local = solve(_input_val_local)
                      _actual_repr_local = repr(_actual_result_local)

                  except Exception as e:
                      _error_occurred_str_local = traceback.format_exc()

                  js_actual_repr_result = _actual_repr_local
                  js_error_occurred_result = _error_occurred_str_local
              `);

              // Retrieve results
              actualRepr = pyodide.globals.get('js_actual_repr_result');
              errorOccurred = pyodide.globals.get('js_error_occurred_result');

               // Capture stdout/stderr for this specific run
               const currentStdout = pyodide.runPython("_global_stdout_buffer.getvalue()") || "";
               const currentStderr = pyodide.runPython("_global_stderr_buffer.getvalue()") || "";
               currentCombinedOutput = (currentStdout + (currentStderr ? `\nSTDERR:\n${currentStderr}` : "")).trim() || undefined;

               // Reset buffers
               pyodide.runPython("_global_stdout_buffer.seek(0); _global_stdout_buffer.truncate(0)");
               pyodide.runPython("_global_stderr_buffer.seek(0); _global_stderr_buffer.truncate(0)");


          } catch (runError: any) {
               console.error(`Critical error during User Test Case ${testCaseNum} execution:`, runError);
               throw new Error(`Execution Error in User Test Case ${testCaseNum}: ${runError.message}`);

          } finally {
                // Clean up python globals for this iteration
                 try {
                   pyodide.runPython("if 'js_actual_repr_result' in globals(): del js_actual_repr_result");
                   pyodide.runPython("if 'js_error_occurred_result' in globals(): del js_error_occurred_result");
                   pyodide.runPython("if 'js_input_str' in globals(): del js_input_str");
                 } catch(e) { console.warn("Minor error cleaning up user test globals", e); }
          }

           // Check results
          if (errorOccurred) {
              //console.error(`User Test Case ${testCaseNum} failed with runtime error.`); //error logging
              return { status: 'failed', testCaseNumber: testCaseNum, input: testCase.input,
                  expectedOutput: testCase.output, actualOutput: "Runtime Error",
                  error: String(errorOccurred), stdout: currentCombinedOutput };
          }

          if (actualRepr === "DEFAULT_REPR_NOT_SET" || actualRepr === undefined || actualRepr === null) {
               console.error(`User Test Case ${testCaseNum} processing: Failed to get valid actual output representation. Got: ${actualRepr}`);
               return { status: 'failed', testCaseNumber: testCaseNum, input: testCase.input,
                  expectedOutput: testCase.output, actualOutput: "Internal Error (Invalid Result)",
                  error: "Could not determine the actual output from the user's code execution.", stdout: currentCombinedOutput };
          }

          // Compare user's actualRepr with the generated expected output
          if (actualRepr !== testCase.output) {
               //console.error(`User Test Case ${testCaseNum} failed. Expected: ${testCase.output}, Got: ${actualRepr}`); error logging
               return { status: 'failed', testCaseNumber: testCaseNum, input: testCase.input,
                  expectedOutput: testCase.output, actualOutput: String(actualRepr),
                  error: null, stdout: currentCombinedOutput };
          }
          console.log(`User Test Case ${testCaseNum} Passed.`);
      } // End for loop

      // --- 4. All Test Cases Passed ---
      console.log("All user test cases passed successfully!");
      const finalStdout = pyodide.runPython("_global_stdout_buffer.getvalue()") || "";
      const finalStderr = pyodide.runPython("_global_stderr_buffer.getvalue()") || "";
      const finalCombinedOutput = (accumulatedStdout + (finalStdout ? `\nFINAL STDOUT:\n${finalStdout}` : "") + (finalStderr ? `\nFINAL STDERR:\n${finalStderr}` : "")).trim() || undefined;

      return {
          status: 'success',
          passedCount: testCases.length,
          stdout: finalCombinedOutput
      };

  } catch (error: any) {
      // --- Catch errors from setup, loading, solve check, or test execution ---
      console.error("Error during user test execution pipeline:", error);
      let errorStdout = accumulatedStdout;
      let errorStderr = initialStderr;
       try {
           if(setupComplete) {
              errorStdout += (pyodide.runPython("_global_stdout_buffer.getvalue()") || "");
              errorStderr += (pyodide.runPython("_global_stderr_buffer.getvalue()") || "");
           }
       } catch(e) { /* Ignore */ }
      const errorCombinedOutput = (errorStdout + (errorStderr ? `\nSTDERR:\n${errorStderr}` : "")).trim() || undefined;

      return {
          status: 'error',
          message: error.message || String(error),
          stdout: errorCombinedOutput
      };
  } finally {
      // --- Cleanup: Always runs for user test environment ---
      if (setupComplete) {
          console.log("Cleaning up user Pyodide environment...");
          try {
              pyodide.runPython(`
                  if '_orig_stdout' in globals(): sys.stdout = _orig_stdout
                  if '_orig_stderr' in globals(): sys.stderr = _orig_stderr
                  g = globals()
                  # Clean up USER test specific vars + solve if defined by user
                  for name in ['_orig_stdout', '_orig_stderr', '_global_stdout_buffer', '_global_stderr_buffer', 'safe_eval', 'solve', 'js_input_str', 'js_actual_repr_result', 'js_error_occurred_result']:
                      if name in g: del g[name]
              `);
          } catch (cleanupError) {
              console.warn("Error during user Pyodide cleanup:", cleanupError);
          }
      } else {
           console.log("Skipping user Pyodide cleanup as setup did not complete.");
      }
  } 
}

// Original runPythonCode function can be kept or removed if no longer needed
// export async function runPythonCode( ... ) { ... }