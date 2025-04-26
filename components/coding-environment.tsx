// src/components/coding-environment.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { PyodideInterface } from 'pyodide';
import Editor from '@/app/editor'; // Adjust path if necessary
import { getPyodide, runPythonCode } from '@/lib/pyodide-service';
import { Button } from '@/components/ui/button'; // Assuming shadcn/ui
import { Play, Loader2 } from 'lucide-react';

// Default initial code for the editor
const defaultInitialCode = `def solve():
  pass


`;

// Adjust the total desired height for the combined editor and output area
const TOTAL_ENVIRONMENT_HEIGHT = '700px'; // Example: Adjust as needed
const EDITOR_HEIGHT = '400px'; // Keep editor height fixed or make it flexible

export default function CodingEnvironment() {
  const [code, setCode] = useState<string>(defaultInitialCode);
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPyodideLoading, setIsPyodideLoading] = useState<boolean>(true);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const pyodideRef = useRef<PyodideInterface | null>(null);

  // Load Pyodide on component mount
  useEffect(() => {
    let isMounted = true;
    console.log("Attempting to load Pyodide...");
    getPyodide()
      .then((instance) => {
        if (isMounted) {
          pyodideRef.current = instance;
          setIsPyodideLoading(false);
          console.log("Pyodide instance assigned.");
        }
      })
      .catch((err) => {
        console.error('Failed to load Pyodide:', err);
        if (isMounted) {
          setError(`Failed to load Python environment: ${err.message}`);
          setIsPyodideLoading(false);
        }
      });

      return () => {
          isMounted = false; // Prevent state updates if component unmounts during load
      }
  }, []); // Empty dependency array ensures this runs only once on mount

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
  }, []);

  const handleRunCode = useCallback(async () => {
    if (!pyodideRef.current || isExecuting || isPyodideLoading) {
      console.log("Run aborted: Pyodide not ready or already executing.");
      return;
    }

    setIsExecuting(true);
    setOutput(''); // Clear previous output
    setError(null); // Clear previous error

    console.log("Executing code...");
    const result = await runPythonCode(pyodideRef.current, code);
    console.log("Execution finished. Result:", result);

    setOutput(result.output);
    setError(result.error);
    setIsExecuting(false);
  }, [code, isExecuting, isPyodideLoading]); // Dependencies for the callback

  return (
    // Changed flex direction to 'col' and removed md:flex-row. Removed gap-4 (can add back if needed for vertical spacing).
    // Added a height constraint to the overall environment if desired.
    <div className="flex flex-col w-full" style={{ height: TOTAL_ENVIRONMENT_HEIGHT }}>

      {/* Editor Section - Takes full width now */}
      <div className="w-full flex flex-col" style={{ height: EDITOR_HEIGHT }}> {/* Assign specific height to editor container */}
        <div className="flex-grow"> {/* Let Editor component fill this */}
            <Editor initialCode={code} onCodeChange={handleCodeChange} />
        </div>
         <div className="mt-2 flex justify-end pr-24 pb-2"> {/* Added some padding */}
            <Button
                onClick={handleRunCode}
                disabled={isPyodideLoading || isExecuting}
                size="lg"
                variant="outline" 
                className='bg-[rgb(55,55,55)] border rounded-xl border-[rgb(44,44,44)] hover:bg-[rgb(75,75,75)]'
            >
                {isPyodideLoading ? (
                    <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</> // Shortened text
                ) : isExecuting ? (
                    <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running...</>
                ) : (
                  <>
                  <Play className="h-4 w-4 text-green-700" />
                  <span className="text-green-700 text-lg font-semibold">Submit</span>
                </>
              )}
            </Button>
         </div>
      </div>

      {/* Output/Results Section - Takes full width, appears below */}
      {/* Using flex-grow allows this section to fill remaining vertical space */}
      <div className="w-[300px] flex flex-col border border-gray-500 bg-[rgb(34,34,34)] text-white rounded mt-4 flex-grow min-h-0"> {/* Added mt-4 for spacing, flex-grow and min-h-0 for flexible height */}
          <div className="p-2 border-b border-gray-600 text-sm font-medium flex-shrink-0"> {/* Prevent header shrinking */}
            Output / Results
          </div>
          {/* Make the content area scrollable */}
          <div className="flex-grow p-3 overflow-auto text-sm font-mono">
              {isPyodideLoading && !error && <p>Loading Python Environment...</p>}
              {error && (
                  <pre className="text-red-400 whitespace-pre-wrap break-words">Error: {error}</pre>
              )}
              {/* Show output */}
              {output && (
                 <pre className="whitespace-pre-wrap break-words">{output}</pre>
              )}
              {!isPyodideLoading && !isExecuting && !output && !error && (
                 <p className="text-gray-400">Click "Submit" to execute your solution.</p>
              )}
          </div>
      </div>
    </div>
  );
}