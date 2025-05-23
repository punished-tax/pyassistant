// src/lib/pyodide-service.ts
import type { PyodideInterface } from 'pyodide';
import type { TestCase, TestExecutionResult } from '@/lib/test-result'; // Import the types


let pyodideInstance: PyodideInterface | null = null;
let pyodideLoadingPromise: Promise<PyodideInterface> | null = null;

// Helper function to clean stdout from internal debug messages
function cleanStdout(rawStdout: string | undefined | null): string | undefined {
    if (!rawStdout) {
        return undefined;
    }
    const lines = rawStdout.split('\n');
    // Filter out specific Python debug print lines
    const pythonDebugPrefixes = [
        "[PYTHON REF DEBUG]",
        "[PYTHON USER DEBUG]", // Add this if you plan to use it for user code debugging prints
        // Add other specific print prefixes from your Python helpers if they are not for the end-user
    ];
    const filteredLines = lines.filter(line =>
        !pythonDebugPrefixes.some(prefix => line.trim().startsWith(prefix))
    );
    const cleaned = filteredLines.join('\n').trim();
    return cleaned === '' ? undefined : cleaned;
}


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
  let capturedOutput: string | undefined = undefined; 

  console.log(`Running reference solution for input: ${rawInput}`);

  try {
      // 1. Setup unique environment (minimal globals)
       pyodide.runPython(`
          import sys, io, traceback, ast
          if '_ref_orig_stdout' not in globals():
              _ref_orig_stdout = sys.stdout
          if '_ref_orig_stderr' not in globals():
              _ref_orig_stderr = sys.stderr

          _ref_stdout_buffer = io.StringIO()
          _ref_stderr_buffer = io.StringIO()
          sys.stdout = _ref_stdout_buffer
          sys.stderr = _ref_stderr_buffer

          def safe_eval_ref(literal_str):
               try: return ast.literal_eval(literal_str)
               except Exception as e: return f"EVAL_ERROR: {e.__class__.__name__}: {e}"
      `);
      setupComplete = true;

      // 2. Load the reference solution code
      pyodide.globals.set('js_ref_solution_code', referenceSolutionCode);
      try {
           await pyodide.runPythonAsync(`
            exec(js_ref_solution_code, globals())
            # Optional: Add debug prints here if needed, e.g., print("[PYTHON REF DEBUG] Ref code executed")
            del js_ref_solution_code
          `);
      } catch (loadError: any) {
           const loadStderr = pyodide.runPython("_ref_stderr_buffer.getvalue()") || "";
           const cleanedStderr = cleanStdout(loadStderr);
           throw new Error(`Syntax Error in Reference Solution: ${loadError.message}${cleanedStderr ? `\nDetails:\n${cleanedStderr}`:''}`);
      }

      // 3. Check if 'solve' exists
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
          js_ref_actual_repr_result = _ref_actual_repr_local
          js_ref_error_occurred_result = _ref_error_occurred_str_local
      `);

      // 5. Retrieve results
      const actualRepr = pyodide.globals.get('js_ref_actual_repr_result');
      const errorOccurred = pyodide.globals.get('js_ref_error_occurred_result');

      const currentStdout = pyodide.runPython("_ref_stdout_buffer.getvalue()") || "";
      const currentStderr = pyodide.runPython("_ref_stderr_buffer.getvalue()") || "";
      let rawCombinedOutput = currentStdout;
      if (currentStderr) rawCombinedOutput += `\nSTDERR:\n${currentStderr}`;
      capturedOutput = cleanStdout(rawCombinedOutput);

      if (errorOccurred) {
           return { outputRepr: null, error: errorOccurred, stdout: capturedOutput };
      }
      if (actualRepr === undefined || actualRepr === null) {
           return { outputRepr: null, error: "Reference solution produced an invalid result representation.", stdout: capturedOutput };
      }
      return { outputRepr: String(actualRepr), error: null, stdout: capturedOutput };

  } catch (error: any) {
      let errorStderrDetails = '';
      let errorStdoutDetails: string | undefined = undefined;
       try { 
           if(setupComplete) {
                errorStderrDetails = pyodide.runPython("_ref_stderr_buffer.getvalue()") || "";
                errorStdoutDetails = cleanStdout(pyodide.runPython("_ref_stdout_buffer.getvalue()") || "");
           }
       } catch(e) {/*ignored*/}
      const cleanedErrorStderr = cleanStdout(errorStderrDetails);
      return {
          outputRepr: null,
          error: `Execution Error: ${error.message}${cleanedErrorStderr ? `\nDetails:\n${cleanedErrorStderr}`:''}`,
          stdout: errorStdoutDetails 
      };
  } finally {
      if (setupComplete) {
          try {
              pyodide.runPython(`
                  if '_ref_orig_stdout' in globals(): sys.stdout = _ref_orig_stdout
                  if '_ref_orig_stderr' in globals(): sys.stderr = _ref_orig_stderr
                  g = globals()
                  for name in ['_ref_orig_stdout', '_ref_orig_stderr', '_ref_stdout_buffer', '_ref_stderr_buffer', 'safe_eval_ref', 'js_ref_raw_input', 'js_ref_actual_repr_result', 'js_ref_error_occurred_result', 'solve']:
                      if name in g: del g[name]
              `);
          } catch (cleanupError) {
              console.warn("Error during reference solution cleanup:", cleanupError);
          }
      }
  }
}


export async function runPythonCodeWithTests(
  pyodide: PyodideInterface,
  userCode: string,
  testCases: TestCase[]
): Promise<TestExecutionResult> {
    let setupComplete = false;
    let accumulatedStdout = ''; 
    let initialStderrContent = '';

    try {
      console.log("Setting up USER test environment...");
      pyodide.runPython(`
          import sys, io, traceback, ast
          if '_orig_stdout' not in globals(): _orig_stdout = sys.stdout
          if '_orig_stderr' not in globals(): _orig_stderr = sys.stderr
          _global_stdout_buffer = io.StringIO()
          _global_stderr_buffer = io.StringIO()
          sys.stdout = _global_stdout_buffer
          sys.stderr = _global_stderr_buffer
          def safe_eval(literal_str):
              try: return ast.literal_eval(literal_str)
              except Exception as e: return f"EVAL_ERROR: {e.__class__.__name__}: {e}"
      `);
      setupComplete = true;

      console.log("Loading user code...");
      try {
          await pyodide.runPythonAsync(userCode);
      } catch (loadError: any) {
           const rawLoadStderr = pyodide.runPython("_global_stderr_buffer.getvalue()") || "";
           const cleanedLoadStderr = cleanStdout(rawLoadStderr);
           throw new Error(`Syntax Error: ${loadError.message}${cleanedLoadStderr ? `\nDetails:\n${cleanedLoadStderr}`:''}`);
      }

      const rawSetupStdout = pyodide.runPython("_global_stdout_buffer.getvalue()") || "";
      const rawSetupStderr = pyodide.runPython("_global_stderr_buffer.getvalue()") || "";
      pyodide.runPython("_global_stdout_buffer.seek(0); _global_stdout_buffer.truncate(0)");
      pyodide.runPython("_global_stderr_buffer.seek(0); _global_stderr_buffer.truncate(0)");
      
      accumulatedStdout = cleanStdout(rawSetupStdout) || '';
      initialStderrContent = cleanStdout(rawSetupStderr) || '';
      if (initialStderrContent) {
           accumulatedStdout += (accumulatedStdout ? '\n' : '') + `INITIAL STDERR:\n${initialStderrContent}`;
      }
      accumulatedStdout = accumulatedStdout.trim() === '' ? '' : accumulatedStdout.trim();


      const solveExists = pyodide.globals.has('solve');
      if (!solveExists || typeof pyodide.globals.get('solve') !== 'function') {
          throw new Error("Function 'solve' not defined in your code or is not callable.");
      }

      if (!testCases || testCases.length === 0) {
           throw new Error("No test cases provided to run against user code.");
      }

      for (let i = 0; i < testCases.length; i++) {
          const testCase = testCases[i];
          const testCaseNum = i + 1;
          pyodide.globals.set('js_input_str', testCase.input);
          let actualRepr: string | null | undefined = undefined;
          let errorOccurred: string | null | undefined = undefined;
          let currentCombinedOutput: string | undefined = undefined;

          try {
               await pyodide.runPythonAsync(`
                  _actual_result_local = None; _error_occurred_str_local = None; _actual_repr_local = "DEFAULT_REPR_NOT_SET"
                  try:
                      _input_val_local = safe_eval(js_input_str)
                      if isinstance(_input_val_local, str) and _input_val_local.startswith("EVAL_ERROR:"):
                          raise ValueError(f"Internal Error: Failed to evaluate test input: {_input_val_local}")
                      if isinstance(_input_val_local, tuple): _actual_result_local = solve(*_input_val_local)
                      else: _actual_result_local = solve(_input_val_local)
                      _actual_repr_local = repr(_actual_result_local)
                  except Exception as e: _error_occurred_str_local = traceback.format_exc()
                  js_actual_repr_result = _actual_repr_local
                  js_error_occurred_result = _error_occurred_str_local
              `);
              actualRepr = pyodide.globals.get('js_actual_repr_result');
              errorOccurred = pyodide.globals.get('js_error_occurred_result');

               const rawCurrentStdout = pyodide.runPython("_global_stdout_buffer.getvalue()") || "";
               const rawCurrentStderr = pyodide.runPython("_global_stderr_buffer.getvalue()") || "";
               let tempCombined = rawCurrentStdout;
               if (rawCurrentStderr) tempCombined += `\nSTDERR:\n${rawCurrentStderr}`;
               currentCombinedOutput = cleanStdout(tempCombined);

               pyodide.runPython("_global_stdout_buffer.seek(0); _global_stdout_buffer.truncate(0)");
               pyodide.runPython("_global_stderr_buffer.seek(0); _global_stderr_buffer.truncate(0)");
          } catch (runError: any) {
               throw new Error(`Execution Error in User Test Case ${testCaseNum}: ${runError.message}`);
          } finally {
                 try {
                   pyodide.runPython("if 'js_actual_repr_result' in globals(): del js_actual_repr_result");
                   pyodide.runPython("if 'js_error_occurred_result' in globals(): del js_error_occurred_result");
                   pyodide.runPython("if 'js_input_str' in globals(): del js_input_str");
                 } catch(e) { console.warn("Minor error cleaning up user test globals", e); }
          }

          if (errorOccurred) {
              return { status: 'failed', testCaseNumber: testCaseNum, input: testCase.input,
                  expectedOutput: testCase.output, actualOutput: "Runtime Error", // actualOutput is convention
                  error: String(errorOccurred), stdout: currentCombinedOutput };
          }
          if (actualRepr === "DEFAULT_REPR_NOT_SET" || actualRepr === undefined || actualRepr === null) {
               return { status: 'failed', testCaseNumber: testCaseNum, input: testCase.input,
                  expectedOutput: testCase.output, actualOutput: "Internal Error (Invalid Result)",
                  error: "Could not determine the actual output from the user's code execution.", stdout: currentCombinedOutput };
          }
          if (actualRepr !== testCase.output) {
               return { status: 'failed', testCaseNumber: testCaseNum, input: testCase.input,
                  expectedOutput: testCase.output, actualOutput: String(actualRepr),
                  error: null, stdout: currentCombinedOutput };
          }
      }

      let finalCapturedOutput = accumulatedStdout; 
      const rawFinalStdout = pyodide.runPython("_global_stdout_buffer.getvalue()") || "";
      const rawFinalStderr = pyodide.runPython("_global_stderr_buffer.getvalue()") || "";
      const cleanedFinalStdout = cleanStdout(rawFinalStdout);
      const cleanedFinalStderr = cleanStdout(rawFinalStderr);

      if (cleanedFinalStdout) {
          finalCapturedOutput += (finalCapturedOutput ? '\n' : '') + `FINAL STDOUT:\n${cleanedFinalStdout}`;
      }
      if (cleanedFinalStderr) {
          finalCapturedOutput += (finalCapturedOutput ? '\n' : '') + `FINAL STDERR:\n${cleanedFinalStderr}`;
      }
      const finalCombinedOutput = finalCapturedOutput.trim() === '' ? undefined : finalCapturedOutput.trim();

      return {
          status: 'success',
          passedCount: testCases.length,
          stdout: finalCombinedOutput
      };

  } catch (error: any) {
      let errorOutputCombined = accumulatedStdout; // Already cleaned
      let additionalErrorStderr = '';
       try {
           if(setupComplete) {
              const rawErrStdout = pyodide.runPython("_global_stdout_buffer.getvalue()") || "";
              const rawErrStderr = pyodide.runPython("_global_stderr_buffer.getvalue()") || "";
              const cleanedErrStdout = cleanStdout(rawErrStdout);
              const cleanedErrStderr = cleanStdout(rawErrStderr);

              if (cleanedErrStdout) errorOutputCombined += (errorOutputCombined ? '\n' : '') + cleanedErrStdout;
              if (cleanedErrStderr) additionalErrorStderr = cleanedErrStderr;
           }
       } catch(e) { /* Ignore */ }
      
      if (additionalErrorStderr) {
          errorOutputCombined += (errorOutputCombined ? '\n' : '') + `STDERR (during error):\n${additionalErrorStderr}`;
      }
      const finalErrorCombinedOutput = errorOutputCombined.trim() === '' ? undefined : errorOutputCombined.trim();

      return {
          status: 'error',
          message: error.message || String(error),
          stdout: finalErrorCombinedOutput
      };
  } finally {
      if (setupComplete) {
          try {
              pyodide.runPython(`
                  if '_orig_stdout' in globals(): sys.stdout = _orig_stdout
                  if '_orig_stderr' in globals(): sys.stderr = _orig_stderr
                  g = globals()
                  for name in ['_orig_stdout', '_orig_stderr', '_global_stdout_buffer', '_global_stderr_buffer', 'safe_eval', 'solve', 'js_input_str', 'js_actual_repr_result', 'js_error_occurred_result']:
                      if name in g: del g[name]
              `);
          } catch (cleanupError) {
              console.warn("Error during user Pyodide cleanup:", cleanupError);
          }
      }
  } 
}