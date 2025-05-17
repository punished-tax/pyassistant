// src/components/challenge-interface.tsx
'use client'; // THIS IS CRUCIAL - MAKES THIS A CLIENT COMPONENT

import React, { useState, useEffect, useCallback } from 'react';
import type { ChallengeData } from '@/lib/challenges';
import Chat from '@/components/chat'; // Assuming chat.tsx is correctly set up for client
import CodingEnvironment, { ExecutionReport } from '@/components/coding-environment'; // Import ExecutionReport
import type { TestExecutionResult } from '@/lib/test-result'; // Import TestExecutionResult for state typing
import { Loader2, CheckCircle, AlertTriangle, Cog } from 'lucide-react'; // Icons for results display
// Props for the client wrapper
interface ChallengeInterfaceClientProps {
  initialChallengeData: ChallengeData | null;
  initialEditorSetupCode: string; // The very first code to put in the editor for THIS challenge
  rawInputsForEnvironment: string[];
  referenceSolutionCodeForEnvironment: string;
}

type GenerationStatusForDisplay = 'idle' | 'generating' | 'ready' | 'error'; // Can be same as in CodingEnv

// This is your Client Wrapper Component
export default function ChallengeInterfaceClient({
  initialChallengeData,
  initialEditorSetupCode,
  rawInputsForEnvironment,
  referenceSolutionCodeForEnvironment,
}: ChallengeInterfaceClientProps) {
  // State for the current code in the editor, managed client-side
  const [currentEditorCode, setCurrentEditorCode] = useState<string>(initialEditorSetupCode);

  // State for the challenge data, initialized from props
  // This allows dynamic updates if you were to fetch a *new* challenge client-side later,
  // though for now, it's just reflecting the server-fetched data.
  const [challengeData, setChallengeData] = useState<ChallengeData | null>(initialChallengeData);

   // State for displaying execution results, now managed here
  const [userTestResult, setUserTestResult] = useState<TestExecutionResult | null>(null);
  const [isExecutingCode, setIsExecutingCode] = useState<boolean>(false);
  const [currentTestCaseGenStatus, setCurrentTestCaseGenStatus] = useState<GenerationStatusForDisplay>('idle');
  const [currentTestCaseGenError, setCurrentTestCaseGenError] = useState<string | null>(null);

  // Effect to update client state if the initial props from the server change
  // (e.g., if the user navigates and `page.tsx` re-fetches for a new day)
  useEffect(() => {
    setChallengeData(initialChallengeData);
   setCurrentEditorCode(initialEditorSetupCode);
    // Reset execution display state for new challenge
    setUserTestResult(null);
    setIsExecutingCode(false);
    setCurrentTestCaseGenStatus('idle');
    setCurrentTestCaseGenError(null);
  }, [initialChallengeData, initialEditorSetupCode]);

  const handleCodeChange = useCallback((newCode: string) => {
    setCurrentEditorCode(newCode);
     // Optionally clear results when code changes if desired, or keep them
    // setUserTestResult(null); - - - - - - 
  }, []);

  const handleExecutionReport = useCallback((report: ExecutionReport) => {
    setIsExecutingCode(report.isExecuting);
    setUserTestResult(report.result);
    setCurrentTestCaseGenStatus(report.testCaseGenerationStatus);
    setCurrentTestCaseGenError(report.testCaseGenerationError);
  }, []);

  // TodaysChallenge display component (can be defined here or imported if complex)
  // It's purely presentational based on `challengeData`
  const TodaysChallengeDisplay = ({ data }: { data: ChallengeData | null }) => {
    if (!data) {
      return (
        <div className="max-w-2xl ml-0 md:ml-44 p-4 border-none bg-[rgb(34,34,34)] text-white">
          <h2 className="text-xl font-bold mb-3">Challenge Not Available</h2>
          <p>Today's challenge is not available yet. Please check back later!</p>
        </div>
      );
    }
    return (
      <div className="max-w-2xl ml-44"> {/* Adjusted ml for smaller screens */}
        <section className="p-4 border-none bg-[rgb(34,34,34)]">
          <h2 className="text-xl font-bold mb-3 text-gray-200">{data.questionTitle}</h2>
          <div className="text-sm prose dark:prose-invert max-w-none text-gray-200">
            <p>{data.question}</p>
          </div>
        </section>
        <section className="p-4 border-none bg-[rgb(34,34,34)]">
          <h2 className="text-lg font-semibold mb-3 text-gray-100">Example:</h2>
          <div className="space-y-2 text-gray-200 text-xs">
            <div>Input: <pre className="inline bg-[rgb(55,55,55)] p-1 rounded"><code>{data.inputOutput.input}</code></pre></div>
            <div>Output: <pre className="inline bg-[rgb(55,55,55)] p-1 rounded"><code>{data.inputOutput.output}</code></pre></div>
              <h3 className="text-sm prose mt-3 text-gray-200">Make sure you return your solution, don't print!</h3>
              
          </div>
          
        {/* <<< RENDER RESULTS SECTION HERE >>> */}
          <div className="mt-1 p-2 bg-[rgb(55,55,55)] text-white rounded text-sm font-mono w-[250px] max-w-md"> {/* Adjusted width */}
            <RenderUserTestResult />
          </div>
        </section>
      </div>
    );
  };
      // Helper to render test result details (moved from CodingEnvironment)
  const RenderUserTestResult = () => {
    if (currentTestCaseGenStatus === 'generating') {
       return <p className="text-yellow-400 flex items-center"><Cog className="mr-2 h-4 w-4 animate-spin" /></p>;
    }
    if (currentTestCaseGenStatus === 'error') {
        return <p className="text-red-400 flex items-center"><AlertTriangle className="mr-2 h-4 w-4" /> Error Preparing Tests: {currentTestCaseGenError || 'Unknown error'}</p>;
    }
    // Only proceed to show execution status if test cases are ready or if there was no error in generation
    // (e.g. if pyodide itself failed, we might not even get to 'ready' for test gen)
    if (currentTestCaseGenStatus !== 'ready' && !(currentTestCaseGenStatus === 'idle' && !userTestResult && !isExecutingCode)) {
         // If idle and no results yet, it's fine to show "click submit"
         if (currentTestCaseGenStatus === 'idle' && !userTestResult && !isExecutingCode) {
            // This state is handled below
         } else {
            return <p className="text-gray-400">Waiting for test case preparation...</p>;
         }
    }

    if (isExecutingCode) {
        return <p className="text-gray-400 flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running Your Code...</p>;
    }
    if (!userTestResult) {
        // This could also show if pyodide is still loading initially, or if test gen failed before any execution attempt.
        // Let's rely on the testCaseGenStatus checks above for more specific messages first.
        return <p className="text-gray-400">Click "Submit" in the editor area to run test cases.</p>;
    }

    switch (userTestResult.status) {
        case 'success':
            return (
                <div className="text-green-400 space-y-1">
                    <p className="flex items-center font-semibold"><CheckCircle className="mr-2 h-5 w-5" /> Success!</p>
                    <p>Your code passed all {userTestResult.passedCount} test cases.</p>
                </div>
            );
        case 'failed':
             return (
                 <div className="text-red-400 space-y-1 text-xs">
                    <p className="flex items-center font-semibold"> Test Case {userTestResult.testCaseNumber} Failed</p>
                    <div><span className="font-medium text-gray-300">Input:</span><pre className="inline  p-1 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.input}</pre></div>
                    <div><span className="font-medium text-gray-300">Expected:</span><pre className="inline p-1 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.expectedOutput}</pre></div>
                    <div><span className="font-medium text-gray-300">Output:</span><pre className="inline  p-1 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.actualOutput}</pre></div>
                    {userTestResult.error && (<div><span className="font-medium text-gray-300">Runtime Error:</span><pre className="inline  p-1 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.error}</pre></div>)}
                 </div>
             );
        case 'error':
             return (
                 <div className="text-orange-400 space-y-1">
                     <p className="flex items-center font-semibold"><AlertTriangle className="mr-2 h-5 w-5" /> Execution Error</p>
                    <p>Could not run tests on your code:</p>
                    <pre className="bg-[rgb(45,45,45)] p-1 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.message}</pre>
                 </div>
             );
        default:
              return <p className="text-gray-400">Submit your code to see the results.</p>;
    }
  };



    const instanceKey = challengeData ? challengeData.id : 'no-challenge';

  return (
    <>
      <div className="container mx-auto p-4 md:p-8">
        <TodaysChallengeDisplay data={challengeData} />
      </div>

      <div className="flex justify-center items-end ml-24 mb-8">
        <div className="w-[600px] h-[500px]">
          <CodingEnvironment
            key={instanceKey}
            rawInputs={rawInputsForEnvironment}
            referenceSolutionCode={referenceSolutionCodeForEnvironment}
            initialCodeForEditor={initialEditorSetupCode} // This should be currentEditorCode to reflect changes
            onCodeChange={handleCodeChange}
            liveEditorCode={currentEditorCode}
            onExecutionReport={handleExecutionReport}
          />
        </div>
        <div className="w-[600px] h-[500px] mb-16">
          <Chat
            challengeData={challengeData} // Pass the current challenge data
            editorCode={currentEditorCode} // Pass the current editor code
            initialEditorSetupCode={initialEditorSetupCode} // Pass the original setup code for comparison
          />
        </div>
      </div>
    </>
  );
}