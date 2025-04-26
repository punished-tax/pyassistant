// src/lib/pyodide-service.ts
import type { PyodideInterface } from 'pyodide';

let pyodideInstance: PyodideInterface | null = null;
let pyodideLoadingPromise: Promise<PyodideInterface> | null = null;

// Declare loadPyodide globally
declare global {
  interface Window {
    loadPyodide: (config?: { indexURL?: string }) => Promise<PyodideInterface>;
  }
}

export async function getPyodide(): Promise<PyodideInterface> {
  // If instance exists, return it immediately
  if (pyodideInstance) {
    return pyodideInstance;
  }

  // If loading is already in progress, return the existing promise
  if (pyodideLoadingPromise) {
    return pyodideLoadingPromise;
  }

  // Start loading
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

// runPythonCode function remains the same...
export async function runPythonCode(
    pyodide: PyodideInterface,
    code: string
): Promise<{ output: string; error: string | null }> {
    let output = '';
    let error: string | null = null;

    try {
        console.log("Running python code:\n", code);
        // Redirect stdout and stderr
        pyodide.runPython(`
            import sys
            import io
            import traceback
            # Store original stdout/stderr
            _orig_stdout = sys.stdout
            _orig_stderr = sys.stderr
            # Redirect
            sys.stdout = io.StringIO()
            sys.stderr = io.StringIO()
        `);

        let executionErrorOccurred = false;
        try {
            // Execute the user's code
             await pyodide.runPythonAsync(code); // Use runPythonAsync for potential async Python code

             // Check for the 'solve' function specifically
            const solveExists = pyodide.globals.has('solve');
            if (!solveExists || typeof pyodide.globals.get('solve') !== 'function') {
                error = "Error: Function 'solve' not defined or is not callable.";
            } else {
                 // If solve exists, run it
                await pyodide.runPythonAsync(`
                    final_result = None
                    try:
                        result = solve()
                        final_result = repr(result) # Get a string representation
                    except Exception as e:
                        # Capture runtime errors from within solve()
                        sys.stderr.write(traceback.format_exc())
                    finally:
                        # Make result available globally
                        js_final_result = final_result
                `);

                const executionResult = pyodide.globals.get('js_final_result');
                if (executionResult !== undefined && executionResult !== null) {
                     output += `\n\n\n${executionResult}`;
                } else {
                     output += `\n\nFunction 'solve' executed but returned None or no value.`;
                }
                // Clear the global result variable
                pyodide.runPython("del js_final_result");
            }
        } catch (e: any) {
            // Catch Pyodide-level errors (e.g., syntax errors during initial load/runPythonAsync)
            // These might have already written to the captured stderr
            console.error("Python execution error:", e);
            executionErrorOccurred = true; // Mark that an outer error happened
            error = e.message || String(e);
        } finally {
             // Always try to capture stdout/stderr and restore them
            const stdout = pyodide.runPython("sys.stdout.getvalue()") || "";
            const stderr = pyodide.runPython("sys.stderr.getvalue()") || "";

             // Prepend stdout to output
            output = stdout + output;

             // If stderr has content, add it to output or error message
            if (stderr) {
                if (executionErrorOccurred) {
                     // If an error was already caught, append stderr details
                    error += `\n\nSTDERR:\n${stderr}`;
                 } else if (pyodide.globals.has('solve') && typeof pyodide.globals.get('solve') === 'function' && !error) {
                     // If solve exists and ran ok, but there was stderr, show it in output
                     output += `\n\nSTDERR:\n${stderr}`;
                 } else {
                     // Otherwise (e.g. solve not defined, but stderr occurred), treat stderr as the primary error info
                     error = (error ? error + '\n\n' : '') + `STDERR:\n${stderr}`;
                 }
            }


            // Restore stdout/stderr
             pyodide.runPython(`
                sys.stdout = _orig_stdout
                sys.stderr = _orig_stderr
                # Clean up temp vars if they exist
                if '_orig_stdout' in locals(): del _orig_stdout
                if '_orig_stderr' in locals(): del _orig_stderr
                # Clean up io and traceback from global scope if needed, though generally safe
                # import sys
                # if 'io' in sys.modules: del sys.modules['io']
                # if 'traceback' in sys.modules: del sys.modules['traceback']
            `);
        }

    } catch (outerError: any) {
         // Catch errors happening outside the main try/finally (e.g., issues redirecting stdout/stderr)
         console.error("Outer Pyodide service error:", outerError);
         error = `Service Error: ${outerError.message || String(outerError)}`;
    }

    return { output: output.trim(), error };
}