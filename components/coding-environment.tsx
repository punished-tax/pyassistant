// src/components/coding-environment.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { PyodideInterface } from 'pyodide';
import Editor from '@/app/editor';
// Import the *new* service function and types
import { getPyodide, runPythonCodeWithTests, runReferenceSolution } from '@/lib/pyodide-service';
import type { TestCase, TestExecutionResult } from '@/lib/test-result';
import { Button } from '@/components/ui/button';
import { Play, Loader2, CheckCircle, XCircle, AlertTriangle, Cog } from 'lucide-react';


// New type for reporting execution state
export interface ExecutionReport {
  isExecuting: boolean;
  result: TestExecutionResult | null;
  // We'll also need to report test case generation status if the parent is to display it
  testCaseGenerationStatus: GenerationStatus;
  testCaseGenerationError: string | null;
}

// Interface for props
interface CodingEnvironmentProps {
  rawInputs: string[];
  referenceSolutionCode: string;
  // This is the code that the Editor should initialize with for the current challenge
  initialCodeForEditor: string;
  onCodeChange: (newCode: string) => void;
  // The code currently in the editor, as reported by onCodeChange, used for submission
  liveEditorCode: string;
  onExecutionReport: (report: ExecutionReport) => void; // <<< NEW PROP to report execution details
}

// Default initial code if not provided by props
const defaultCode = `def solve():
    pass
`;

const TOTAL_ENVIRONMENT_HEIGHT = '700px';
const EDITOR_HEIGHT = '400px';

type GenerationStatus = 'idle' | 'generating' | 'ready' | 'error';

export default function CodingEnvironment({
  rawInputs,
  referenceSolutionCode,
  initialCodeForEditor, // Code for Editor's initial setup for this challenge instance
  onCodeChange,
  liveEditorCode,       // Live code from parent, used for submit
  onExecutionReport,
}: CodingEnvironmentProps) {
  const [code, setCode] = useState<string>(liveEditorCode);
  const [userTestResult, setUserTestResult] = useState<TestExecutionResult | null>(null); // Result of user code run
  const [isPyodideLoading, setIsPyodideLoading] = useState<boolean>(true);
  const [isExecutingUserCode, setIsExecutingUserCode] = useState<boolean>(false); // Renamed for clarity
  const [pyodideLoadError, setPyodideLoadError] = useState<string | null>(null);
  const pyodideRef = useRef<PyodideInterface | null>(null);

    // State for dynamic test case generation
    const [generatedTestCases, setGeneratedTestCases] = useState<TestCase[] | null>(null);
    const [testCaseGenerationStatus, setTestCaseGenerationStatus] = useState<GenerationStatus>('idle');
    const [testCaseGenerationError, setTestCaseGenerationError] = useState<string | null>(null);

      // Internal state for *current* execution, parent will get the final report
  const [isInternallyExecuting, setIsInternallyExecuting] = useState<boolean>(false);


  // Effect to report test case generation status changes
  useEffect(() => {
    onExecutionReport({
        isExecuting: isInternallyExecuting, // report current execution status
        result: null, // result is null during test case generation phase
        testCaseGenerationStatus: testCaseGenerationStatus,
        testCaseGenerationError: testCaseGenerationError,
    });
  }, [testCaseGenerationStatus, testCaseGenerationError, isInternallyExecuting, onExecutionReport]);

   // Effect to reset states when the challenge changes
  useEffect(() => {
    // Reset internal execution state, parent will clear its result display
    setIsInternallyExecuting(false);
    setGeneratedTestCases(null);
    setTestCaseGenerationStatus('idle');
    setTestCaseGenerationError(null);
    // Initial report for the new challenge
    onExecutionReport({
        isExecuting: false,
        result: null,
        testCaseGenerationStatus: 'idle',
        testCaseGenerationError: null,
    });
  }, [initialCodeForEditor, onExecutionReport]); // initialCodeForEditor signals new challenge

  // Effect to potentially update editor if initialCode prop changes
  useEffect(() => {
      setCode(liveEditorCode);
      // Optionally, you could trigger a reset of test results here too if desired
       setUserTestResult(null); //hmmmmm
  }, [liveEditorCode]);


  // Load Pyodide on component mount
  useEffect(() => {
    let isMounted = true;
    // Only load if not already loaded or loading
    if (!pyodideRef.current && isPyodideLoading && !pyodideLoadError) {
        console.log("Attempting to load Pyodide...");
        getPyodide()
        .then((instance) => {
            if (isMounted) {
                pyodideRef.current = instance;
                setIsPyodideLoading(false);
                setPyodideLoadError(null);
                console.log("Pyodide instance assigned.");
            }
        })
        .catch((err) => {
          console.error('Failed to load Pyodide:', err);
          if (isMounted) {
              setPyodideLoadError(`Failed to load Python environment: ${err.message}`);
              setIsPyodideLoading(false);
              setTestCaseGenerationStatus('error'); // Can't generate tests if Pyodide fails
              setTestCaseGenerationError('Pyodide failed to load.');
          }
        });
    }

    return () => {
        isMounted = false;
    }
  }, [isPyodideLoading, pyodideLoadError]); // Re-run if loading state changes or error clears


  // Effect to generate expected outputs using reference solution
  useEffect(() => {
    // Conditions to run: Pyodide ready, have inputs/solution, not already generating/ready/error
    if (
        pyodideRef.current &&
        rawInputs && rawInputs.length > 0 &&
        referenceSolutionCode &&
        testCaseGenerationStatus === 'idle' // Only run once
    ) {
      const generateOutputs = async () => {
        setTestCaseGenerationStatus('generating');
        setTestCaseGenerationError(null);
        console.log("Generating expected outputs from reference solution...");

        console.log("Reference Solution Code being used:\n", referenceSolutionCode); //LOG

        const newTestCases: TestCase[] = [];
        let success = true;

        for (let i = 0; i < rawInputs.length; i++) {
          const input = rawInputs[i];
          const result = await runReferenceSolution(pyodideRef.current!, referenceSolutionCode, input);

          if (result.error || result.outputRepr === null) {
            console.error(`Error generating expected output for input ${i + 1} ("${input}"): ${result.error || 'Unknown error'}`);
            setTestCaseGenerationError(`Failed to generate expected output for test case ${i + 1}. The reference solution might be flawed. Error: ${result.error || 'Invalid output representation.'}`);
            setTestCaseGenerationStatus('error');
            success = false;
            break; // Stop generation on first error
          } else {
            newTestCases.push({ input: input, output: result.outputRepr });
          }
        }

        if (success) {
          console.log("Successfully generated all expected outputs.", newTestCases);
          setGeneratedTestCases(newTestCases);
          setTestCaseGenerationStatus('ready');
        } else {
          setGeneratedTestCases(null); // Clear any partial results on error
        }
      };

      generateOutputs();
    } else if (rawInputs?.length === 0 && testCaseGenerationStatus === 'idle') {
        // Handle case where no inputs are provided
        console.warn("No raw inputs provided for test case generation.");
        setTestCaseGenerationStatus('error');
        setTestCaseGenerationError('No inputs available to generate test cases.');
    }
    // Dependencies: trigger when pyodide is ready or inputs/solution change
  }, [pyodideRef.current, rawInputs, referenceSolutionCode, testCaseGenerationStatus]);


  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    setUserTestResult(null); // Clear previous user results when code changes
  }, []);

    // Effect to reset test results when the challenge changes (signaled by initialCodeForEditor changing)
  useEffect(() => {
    setUserTestResult(null);
    setGeneratedTestCases(null);
    setTestCaseGenerationStatus('idle');
    setTestCaseGenerationError(null);
  }, [initialCodeForEditor]); // Reset if the base code for the challenge changes

  const handleSubmitCode = useCallback(async () => {
    // Must have Pyodide, not be executing, no load error, AND test cases must be generated ('ready')
    if (
        !pyodideRef.current ||
        isInternallyExecuting || //isexecuting
        isPyodideLoading ||
        pyodideLoadError ||
        testCaseGenerationStatus !== 'ready' ||
        !generatedTestCases // Ensure generatedTestCases is not null
     ) {
      console.log("Submit aborted: Conditions not met.", {
          pyodide: !!pyodideRef.current, isExecutingUserCode, isPyodideLoading,
          pyodideLoadError, testCaseGenerationStatus, generatedTestCases: !!generatedTestCases
      });
      // Optionally provide more specific feedback based on status
      if (testCaseGenerationStatus === 'generating') alert("Please wait, preparing test cases...");
      else if (testCaseGenerationStatus === 'error') alert(`Cannot submit: Error during test case preparation. ${testCaseGenerationError || ''}`);
      return;
    }

    setIsExecutingUserCode(true);
    setUserTestResult(null);

    console.log("Executing user code with generated test cases...");
     // Use the dynamically generated test cases
     const result = await runPythonCodeWithTests(pyodideRef.current, liveEditorCode, generatedTestCases);
     console.log("User code execution finished. Result:", result);
  setIsInternallyExecuting(false);
    onExecutionReport({ // Report final result
        isExecuting: false,
        result: result,
        testCaseGenerationStatus: testCaseGenerationStatus,
        testCaseGenerationError: testCaseGenerationError,
    });
   }, [
       liveEditorCode,
       generatedTestCases,
       isInternallyExecuting,
       isPyodideLoading,
       pyodideLoadError,
       testCaseGenerationStatus,
       testCaseGenerationError, // Added
       onExecutionReport,
    ]);
 
 
   // Helper to render test result details for USER'S code
   const RenderUserTestResult = () => {
      // Display generation status *before* user results if not ready
      if (testCaseGenerationStatus === 'generating') {
         return <p className="text-yellow-400 flex items-center"><Cog className="mr-2 h-4 w-4 animate-spin" /> Preparing Test Cases...</p>;
      }
       if (testCaseGenerationStatus === 'error') {
          return <p className="text-red-400 flex items-center"><AlertTriangle className="mr-2 h-4 w-4" /> Error Preparing Tests: {testCaseGenerationError || 'Unknown error'}</p>;
      }
      if (testCaseGenerationStatus !== 'ready') {
           return <p className="text-gray-400">Waiting for test case preparation...</p>;
      }
 
      // If tests are ready, show execution/result status
     if (isExecutingUserCode) {
         return <p className="text-gray-400 flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running Your Code...</p>;
     }
     if (!userTestResult) {
         return <p className="text-gray-400">Click "Submit" to run test cases against your solution.</p>;
     }
 
     // ... (switch statement for userTestResult.status: success, failed, error remains the same as before)
     switch (userTestResult.status) {
         case 'success':
             return (
                 <div className="text-green-400 space-y-1">
                     <p className="flex items-center font-semibold"><CheckCircle className="mr-2 h-5 w-5" /> Success!</p>
                     <p>Your code passed all {userTestResult.passedCount} test cases.</p>
                     {/* Optional: Display stdout from user run */}
                     {/* {userTestResult.stdout && <pre className="text-xs text-gray-500 mt-2 whitespace-pre-wrap break-words">Combined Output:\n{userTestResult.stdout}</pre>} */}
                 </div>
             );
         case 'failed':
              return (
                  <div className="text-red-400 space-y-1">
                     <p className="flex items-center font-semibold"><XCircle className="mr-2 h-5 w-5" /> Test Case {userTestResult.testCaseNumber} Failed</p>
                     <div><span className="font-medium text-gray-300 text-xs">Input:</span><pre className="inline bg-[rgb(55,55,55)] p-2 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.input}</pre></div>
                     <div><span className="font-medium text-gray-300 text-xs">Expected:</span><pre className="inline bg-[rgb(55,55,55)] p-2 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.expectedOutput}</pre></div>
                     <div><span className="font-medium text-gray-300 text-xs">Output:</span><pre className="inline bg-[rgb(55,55,55)] p-2 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.actualOutput}</pre></div>
                     {userTestResult.error && (<div><span className="font-medium text-gray-300 text-xs">Runtime Error:</span><pre className="inline bg-[rgb(55,55,55)] p-2 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.error}</pre></div>)}
                     {userTestResult.stdout && (<div><span className="font-medium text-gray-300 text-xs">Your Captured Output (stdout/stderr):</span><pre className="inline bg-gray-700 p-2 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.stdout}</pre></div>)}
                  </div>
              );
         case 'error':
              return (
                  <div className="text-orange-400 space-y-1">
                      <p className="flex items-center font-semibold"><AlertTriangle className="mr-2 h-5 w-5" /> Execution Error</p>
                     <p>Could not run tests on your code due to an error:</p>
                     <pre className="bg-gray-700 p-2 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.message}</pre>
                     {userTestResult.stdout && (<div><p className="font-medium text-gray-300">Your Captured Output (stdout/stderr):</p><pre className="bg-gray-700 p-2 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.stdout}</pre></div>)}
                  </div>
              );
         default:
               return <p className="text-gray-400">Submit your code to see the results.</p>; // Fallback
     }
   };
 
   // Determine button disabled state and text
   const getButtonState = (): { disabled: boolean; content: React.ReactNode } => {
       if (isPyodideLoading) return { disabled: true, content: <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</> };
       if (pyodideLoadError) return { disabled: true, content: <><AlertTriangle className="mr-2 h-4 w-4 text-red-500" /> Error</> };
       if (testCaseGenerationStatus === 'generating') return { disabled: true, content: <><Cog className="mr-2 h-4 w-4 animate-spin" /> Preparing Tests...</> };
       if (testCaseGenerationStatus === 'error') return { disabled: true, content: <><AlertTriangle className="mr-2 h-4 w-4 text-red-500" /> Test Prep Error</> };
       if (isInternallyExecuting) return { disabled: true, content: <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running Code...</> };
       // Ready to submit
       return { disabled: false, content: <><Play className=" h-4 w-4 text-green-700 !size-5" /><span className="text-green-700 text-lg font-sans-serif">Submit</span></> };
   };
 
   const buttonState = getButtonState();
 
   return (
     <div className="flex flex-col w-full" style={{ height: TOTAL_ENVIRONMENT_HEIGHT }}>
       {/* Editor Section */}
       <div className="w-full flex flex-col" style={{ height: EDITOR_HEIGHT }}>
         <div className="flex-grow">
             <Editor initialCode={initialCodeForEditor} onCodeChange={onCodeChange} />
         </div>
          <div className="mt-2 flex justify-end pr-24 pb-2">
             <Button
                 onClick={handleSubmitCode}
                 disabled={buttonState.disabled}
                 //size="lg"
                 variant="outline"
                 className='bg-[rgb(55,55,55)] border rounded-xl border-[rgb(44,44,44)] hover:bg-[rgb(75,75,75)] disabled:opacity-60 px-5 py-5' // Added disabled style
             >
                 {buttonState.content}
             </Button>
          </div>
       </div>
 
       
     </div>
   );
 }