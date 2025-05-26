// src/components/challenge-interface.tsx
'use client'; 

import React, { useState, useEffect, useCallback } from 'react';
import type { ChallengeData } from '@/lib/challenges';
import Chat from '@/components/chat'; // Assuming chat.tsx is correctly set up for client
import CodingEnvironment, { ExecutionReport } from '@/components/coding-environment'; // Import ExecutionReport
import type { TestExecutionResult } from '@/lib/test-result'; // Import TestExecutionResult for state typing
import { Loader2, CheckCircle, AlertTriangle, Cog, XCircle } from 'lucide-react'; // Icons for results display
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

  // Helper function to create a unique localStorage key for a challenge
  const getLocalStorageKey = (challengeId: string | undefined | null): string | null => {
    if (!challengeId) return null;
    return `pyassistant_code_${challengeId}`;
  };

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

    if (initialChallengeData && initialChallengeData.id) {
      const storageKey = getLocalStorageKey(initialChallengeData.id);
      if (storageKey) {
        try {
          const savedCode = localStorage.getItem(storageKey);
          if (savedCode !== null) {
            console.log(`ChallengeInterface: Loaded code from localStorage for ${initialChallengeData.id}`);
            setCurrentEditorCode(savedCode);
          } else {
            // No saved code, use the initial setup code
            console.log(`ChallengeInterface: No saved code in localStorage for ${initialChallengeData.id}, using initial setup code.`);
            setCurrentEditorCode(initialEditorSetupCode);
          }
        } catch (error) {
          console.error("ChallengeInterface: Error reading from localStorage:", error);
          // Fallback to initial setup code if localStorage access fails
          setCurrentEditorCode(initialEditorSetupCode);
        }
      } else {
         // Should not happen if initialChallengeData.id is present
         setCurrentEditorCode(initialEditorSetupCode);
      }
    } else {
      // No challenge data (e.g., initial load or error), use default setup code
      setCurrentEditorCode(initialEditorSetupCode);
    }

  }, [initialChallengeData, initialEditorSetupCode]);

  const handleCodeChange = useCallback((newCode: string) => {
    setCurrentEditorCode(newCode);
    if (challengeData && challengeData.id) {
      const storageKey = getLocalStorageKey(challengeData.id);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, newCode);
          // console.log(`ChallengeInterface: Saved code to localStorage for ${challengeData.id}`);
        } catch (error) {
          console.error("ChallengeInterface: Error writing to localStorage:", error);
          // Handle potential storage full errors or other issues
        }
      }
    }
    // setUserTestResult(null); // Optional: clear results on code change
  }, [challengeData]); // Dependency on challengeData to get the correct ID for saving

  const handleExecutionReport = useCallback((report: ExecutionReport) => {
    setIsExecutingCode(report.isExecuting);
    setUserTestResult(report.result);
    setCurrentTestCaseGenStatus(report.testCaseGenerationStatus);
    setCurrentTestCaseGenError(report.testCaseGenerationError);
  }, []);

  // TodaysChallenge display component (can be defined here or imported if complex)
  // It's purely presentational based on `challengeData`
  const TodaysChallengeDisplay = React.memo(({ data }: { data: ChallengeData | null }) => {
    console.log("Rendering TodaysChallengeDisplay"); // Add log to see when it renders
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
        <section className="pt-4 px-4 pb-2 border-none bg-[rgb(34,34,34)]">
          <h2 className="text-md font-semibold mb-3 text-gray-100">Example:</h2>
          <div className="space-y-2 text-gray-200 text-xs ml-1">
            <div>Input: <pre className="inline bg-[rgb(55,55,55)] p-1 rounded"><code>{data.inputOutput.input}</code></pre></div>
            <div>Output: <pre className="inline bg-[rgb(55,55,55)] p-1 rounded"><code>{data.inputOutput.output}</code></pre>
            
            </div>
              
              
          </div>
          <h3 className="text-sm prose mt-2 text-gray-200">Make sure you return your solution, don't print!</h3>
          
         {/* only show once we have a test result */}
 {userTestResult && (
   <div
     className="
       p-2           
       bg-[rgb(55,55,55)]
       text-white
       rounded
       text-xs       
       font-mono
       w-[300px]     
       max-h-36      
       overflow-y-auto
       space-y-1     
     "
   >
     <RenderUserTestResult />
   </div>
 )}
        </section>
      </div>
    );
  });
  TodaysChallengeDisplay.displayName = 'TodaysChallengeDisplay';
      // Helper to render test result details (moved from CodingEnvironment)
 const RenderUserTestResult = () => {
  console.log("Evaluating RenderUserTestResult function component logic");
    if (currentTestCaseGenStatus === 'error') {
        return <p className="text-red-400 flex items-center"><AlertTriangle className="mr-2 h-4 w-4" /> Error Preparing Tests: {currentTestCaseGenError || 'Unknown error'}</p>;
    }
    // Show generating status if applicable, even if not actively executing user code yet - removed
    

    if (isExecutingCode) { // This means user's code is running
        return <p className="text-gray-400 flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /></p>;
    }

    if (!userTestResult) {
        // If test cases are ready, prompt to submit. Otherwise, show general waiting or idle.
        if (currentTestCaseGenStatus === 'ready') {
            return <p className="text-gray-400">Click "Submit" to test your solution.</p>;
        }
        return <p className="text-gray-400"></p>; 
    }

    switch (userTestResult.status) {
        case 'success':
            return (
                <div className="text-green-400 space-y-1">
                    <p className="flex items-center font-semibold"><CheckCircle className="mr-2 h-5 w-5" /> Success!</p>
                    <p>Your code passed all {userTestResult.passedCount} test cases.</p>
                    {/* Optionally display success stdout if it exists and is not empty */}
                    {userTestResult.stdout && (
                        <div className="mt-1">
                            <span className="font-medium text-gray-300 text-xs">Captured Output:</span>
                            <pre className="bg-[rgb(45,45,45)] p-1 rounded text-xs whitespace-pre-wrap break-words block">{userTestResult.stdout}</pre>
                        </div>
                    )}
                </div>
            );
        case 'failed':
            if (userTestResult.error) { // Runtime error during this specific test case
                return (
                    <div className="text-red-400 space-y-1 text-xs">
                        <p className="flex items-center font-semibold">
                            <AlertTriangle className="mr-2 h-5 w-5" /> Runtime Error
                        </p>
                        <pre className="bg-[rgb(45,45,45)] p-1 rounded text-xs whitespace-pre overflow-x-auto block max-w-[350px]">{userTestResult.error}</pre>
                        {userTestResult.stdout && (
                            <div className="mt-1">
                                
                                <pre className="bg-[rgb(45,45,45)] p-1 rounded text-xs whitespace-pre-wrap break-words block">{userTestResult.stdout}</pre>
                            </div>
                        )}
                    </div>
                );
            } else { // Regular test failure (wrong answer)
                return (
                    <div className="text-red-400 space-y-1 text-xs">
                       <p className="flex items-center font-semibold">
                           <XCircle className="mr-2 h-5 w-5" /> Test Case Failed
                       </p>
                       <div><span className="font-medium text-gray-300">Input:</span><pre className="inline bg-[rgb(55,55,55)] p-1 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.input}</pre></div>
                       <div><span className="font-medium text-gray-300">Expected:</span><pre className="inline bg-[rgb(55,55,55)] p-1 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.expectedOutput}</pre></div>
                       <div><span className="font-medium text-gray-300">Output:</span><pre className="inline bg-[rgb(55,55,55)] p-1 rounded text-xs whitespace-pre-wrap break-words">{userTestResult.actualOutput}</pre></div>
                       {userTestResult.stdout && (
                           <div className="mt-1">
                               <span className="font-medium text-gray-300">Captured Output:</span>
                               <pre className="bg-[rgb(45,45,45)] p-1 rounded text-xs whitespace-pre-wrap break-words block">{userTestResult.stdout}</pre>
                           </div>
                       )}
                    </div>
                );
            }
        case 'error': // General execution error (e.g., syntax error, solve not defined)
             return (
                 <div className="text-orange-400 space-y-1 text-xs"> {/* Text size xs for consistency */}
                     <p className="flex items-center font-semibold"><AlertTriangle className="mr-2 h-5 w-5" /> Execution Error</p>
                    <p>Could not run your code.</p>
                    
                    
                 </div>
             );
        default:
              return <p className="text-gray-400">Click "Submit" to test your solution.</p>;
    }
  };



    const instanceKey = challengeData ? challengeData.id : 'no-challenge';

    const [codeToInitializeEditorWith, setCodeToInitializeEditorWith] = useState<string>(initialEditorSetupCode);
     useEffect(() => {
    // This effect now focuses on setting the code for the editor's *initialization*
    // when a new challenge is loaded.
    setChallengeData(initialChallengeData);
    setUserTestResult(null);
    setIsExecutingCode(false);
    setCurrentTestCaseGenStatus('idle');
    setCurrentTestCaseGenError(null);

    let codeForEditor: string;
    if (initialChallengeData && initialChallengeData.id) {
      const storageKey = getLocalStorageKey(initialChallengeData.id);
      if (storageKey) {
        try {
          const savedCode = localStorage.getItem(storageKey);
          codeForEditor = savedCode !== null ? savedCode : initialEditorSetupCode;
        } catch (error) {
          console.error("ChallengeInterface: Error reading from localStorage:", error);
          codeForEditor = initialEditorSetupCode;
        }
      } else {
        codeForEditor = initialEditorSetupCode;
      }
    } else {
      codeForEditor = initialEditorSetupCode;
    }
    setCodeToInitializeEditorWith(codeForEditor); // This sets the initial code for the Editor via CodingEnvironment
    setCurrentEditorCode(codeForEditor);       // This syncs the live code state
  }, [initialChallengeData, initialEditorSetupCode]);


  return (
    <>
      <div className="container mx-auto pt-4 px-4 pb-2">
        <TodaysChallengeDisplay data={challengeData} />
      </div>

      <div className="flex justify-center items-end ml-24 mb-12">
        <div className="w-[600px] h-[500px] mr-4">
          <CodingEnvironment
            key={instanceKey}
            rawInputs={rawInputsForEnvironment}
            referenceSolutionCode={referenceSolutionCodeForEnvironment}
            initialCodeForEditor={codeToInitializeEditorWith} // This should be currentEditorCode to reflect changes
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