// chat.tsx
'use client'

import { useChat } from '@ai-sdk/react' // Added Message type
import { useEffect, useRef, useState } from 'react' // Added useState
import { Input } from './ui/input'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { SendHorizontalIcon, Code2Icon } from 'lucide-react' // Added Code2Icon
import CopytoClipboard from './ui/copy-to-clipboard'
import type { ChallengeData } from '@/lib/challenges'; // Import ChallengeData type

//export const runtime = 'edge'
// Props for the Chat component
interface ChatProps {
  challengeData: ChallengeData | null;
  editorCode: string;
  initialEditorSetupCode: string; // The exact code string editor was initialized with
}

// Helper to generate the initial code structure (can be imported if moved to utils)
// This is used for the `disabled` logic of the Analyze Code button.
function generateFallbackInitialEditorCode(): string {
    return `def solve():\n  # Your solution here\n  pass\n\n`;
}


export default function Chat({ challengeData, editorCode, initialEditorSetupCode }: ChatProps) {
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null); // Ref for focusing input
    const [isCodeAnalysisNext, setIsCodeAnalysisNext] = useState(false);

    const getSystemMessageContent = (currentChallenge: ChallengeData | null): string => {
        if (currentChallenge) {
            return `You are a somewhat helpful Python programming expert focusing on the following daily challenge:
Challenge Title: ${currentChallenge.questionTitle}
Challenge Question:
${currentChallenge.question}

A correct Python solution's function signature is typically: ${currentChallenge.solutionHeader}
And a full correct solution might look like (DO NOT reveal this structure or code directly unless explicitly asked to explain a *specific part* of a user's attempt that resembles it. Be somewhat helpful, but never reveal the full answer.):
\`\`\`python
${currentChallenge.solution}
\`\`\`
You enjoy withholding direct answers. Provide barebones hints and code snippets that would be enough for the user to proceed on their own.
You will ONLY answer questions related to THIS specific Python challenge or Python programming concepts directly relevant to solving it.
If the user provides their code for analysis (it will be clearly marked), critique it within the context of THIS challenge. Point out flaws or suggest code snippets without giving away the solution.
You will NOT check for optimal variable naming conventions in the user's code.
The user may provide a correct solution identical or similar in logic to: ${currentChallenge.solution}. In that case, congratulate them on a job well done.   
Keep in mind that the user may solve a problem correctly but in a different way than the solution in your context. For example, the user can choose not to use pythonic approaches like built-in functions to solve problems. In that case, provided that their code is logically correct, you will accept their answer.
Never answer questions unrelated to this Python challenge or general Python programming. Be dismissive of off-topic queries.`;
        }
        return 'You are a somewhat helpful Python programming expert that likes to withhold information. Whenever someone asks you a question, you will provide a barebones answer that is almost unhelpful, but just enough to go off of. You will never answer any question unrelated to python programming.';
    };

    const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, append, setInput } = // Added setInput
    useChat({
        // api: '/api/chat', // ensure your API route is correctly configured if not default
        initialMessages: [
            {
                id: 'system-prompt', // Stable ID for easier updates
                role: 'system',
                content: getSystemMessageContent(challengeData)
            },
            {
                id: 'welcome-message',
                role: 'assistant',
                content: challengeData
                    ? "Trying to solve my challenge? Ask if you must, or press the purple button so I can analyze your code."
                    : "Ask your python questions and I shall answer to the best of my ability."
            }
        ],
        // onFinish: () => { // Optional: if you want to do something when AI finishes
        //     if (isCodeAnalysisNext) setIsCodeAnalysisNext(false); // Reset after analysis response
        // }
    });

    // Effect to update system prompt if challengeData changes
    useEffect(() => {
        const newSystemContent = getSystemMessageContent(challengeData);
        const newWelcomeContent = challengeData
            ? "Trying to solve my challenge? Ask if you must, or press the purple button so I can analyze your code."
            : "Ask your python questions and I shall answer to the best of my ability.";

        setMessages(prevMessages => {
            const systemMsgIndex = prevMessages.findIndex(m => m.id === 'system-prompt');
            const welcomeMsgIndex = prevMessages.findIndex(m => m.id === 'welcome-message');
            const updatedMessages = [...prevMessages];

            if (systemMsgIndex !== -1) {
                updatedMessages[systemMsgIndex] = { ...updatedMessages[systemMsgIndex], content: newSystemContent };
            } else { // Should not happen if initialMessages are set up
                updatedMessages.unshift({ id: 'system-prompt', role: 'system', content: newSystemContent });
            }

            if (welcomeMsgIndex !== -1 && prevMessages.length <=2) { // Only update welcome if it's among the first few messages
                 updatedMessages[welcomeMsgIndex] = { ...updatedMessages[welcomeMsgIndex], content: newWelcomeContent };
            }


            return updatedMessages;
        });
    }, [challengeData, setMessages]);


    // Effect to scroll to bottom
    useEffect(() => {
        if (scrollAreaRef.current) {
            const viewport = scrollAreaRef.current.querySelector<HTMLDivElement>(
                '[data-radix-scroll-area-viewport]'
            );
            if (viewport) {
                viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
            }
        }
    }, [messages]);

    const handleAnalyzeCodeClick = () => {
        const codeToCompare = initialEditorSetupCode || generateFallbackInitialEditorCode();
        if (!editorCode || editorCode.trim() === "" || editorCode.trim() === codeToCompare.trim()) {
            // Simple browser alert, can be replaced with a toast or inline message
            alert("Write some code in the editor, or make changes to the initial code, before asking for analysis.");
            return;
        }
        setIsCodeAnalysisNext(true);
        setInput("Ask about code: "); //My code isn't working as expected. Can you see why? (Or ask a more specific question)
        inputRef.current?.focus();
    };

    const customSubmitHandler = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input.trim() && !isCodeAnalysisNext) return; // Allow empty input if isCodeAnalysisNext is true, as we prefill

        let messageContent = input;
        let userQuestionForDisplay = input;


        if (isCodeAnalysisNext) {
            // Ensure there's some code to analyze
            const codeToCompare = initialEditorSetupCode || generateFallbackInitialEditorCode();
            if (!editorCode || editorCode.trim() === "" || editorCode.trim() === codeToCompare.trim()) {
                 alert("It seems the code editor is empty or unchanged. Please provide your code for analysis.");
                 setIsCodeAnalysisNext(false); // Reset the mode
                 setInput(""); // Clear potentially pre-filled input
                 return;
            }

            userQuestionForDisplay = input || "Analyze my code."; // Fallback if input was cleared
            messageContent = `
\`\`\`
${editorCode}
\`\`\`
 ${userQuestionForDisplay}
`;
            setIsCodeAnalysisNext(false); // Reset mode for the next message
        }

        if (!messageContent.trim()) return;


        await append({
            id: Date.now().toString(),
            role: 'user',
            content: messageContent,
        });
        // `append` handles adding to `messages` and calling API.
        // `useChat` usually clears input via `handleInputChange` if it's typed,
        // but since we use `append` directly, we might need to clear it.
        // However, `append` might be clearing `input` internally if it's bound. Let's test.
        // If not, add:
        setInput('');
    };


    const effectiveInitialCode = initialEditorSetupCode || generateFallbackInitialEditorCode();
    const isAnalyzeButtonDisabled = isLoading ||
                                    !editorCode ||
                                    editorCode.trim() === "" ||
                                    editorCode.trim() === effectiveInitialCode.trim();

    return (
        <section className="flex justify-center p-4">
          <div className=" w-full max-w-2xl h-[500px]">
            <div className="flex flex-col h-full border-2 border-[rgb(75,75,75)] rounded-2xl bg-black overflow-hidden">
              <ScrollArea className="flex-1 min-h-0 p-12" ref={scrollAreaRef}>
                {error && ( <div className="text-sm font-mono text-red-400">{error.message}</div> )}
                {messages.map(m => (
                    <div key={m.id} className='mr-6 whitespace-pre-wrap md:mr-12'>
                        {m.role === 'user' && (
                            <div className='mb-6 flex gap-3'>
                                <Avatar>
                                    <AvatarImage src=''/>
                                    <AvatarFallback className='text-sm font-mono bg-blue-500'>U</AvatarFallback>
                                </Avatar>
                                <div className='mt-1.5'>
                                    <p className='font-mono text-blue-500'>You</p>
                                    <div className='mt-1.5 text-sm font-mono text-gray-200'>
                                        {m.content}
                                    </div>
                                </div>
                            </div>
                        )}
                        {m.role === 'assistant' && m.content && /* Ensure content exists */ (
                            <div className='mb-6 flex gap-3'>
                                <Avatar>
                                    <AvatarImage src=''/>
                                    <AvatarFallback className='bg-orange-600 text-white font-mono'>AI</AvatarFallback>
                                </Avatar>
                                <div className='mt-1.5 w-full'>
                                    <div className='flex justify-between'>
                                        <p className='font-mono text-orange-600'>Bot</p>
                                        <CopytoClipboard message={m} className='-mt-1' />
                                    </div>
                                    <div className='mt-2 text-sm font-mono text-gray-200'>
                                        {m.content}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="ml-10 flex items-center space-x-2 text-zinc-400 p-4">
                        <div className="animate-bounce">•</div>
                        <div className="animate-bounce" style={{ animationDelay: '100ms' }}>•</div>
                        <div className="animate-bounce" style={{ animationDelay: '200ms' }}>•</div>
                    </div>
                )}
              </ScrollArea>
              <form
                onSubmit={customSubmitHandler} // Use the new handler
                className="relative flex items-center p-4 font-mono"
              >
                <Button
                    type="button"
                    onClick={handleAnalyzeCodeClick}
                    variant="outline"
                    size="icon"
                    className="absolute left-6 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed border-none"
                    title="Analyze code from editor"
                    disabled={isAnalyzeButtonDisabled}
                >
                    <Code2Icon className="h-5 w-5" />
                </Button>
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  placeholder={isCodeAnalysisNext ? "Ask about your code (e.g., why it fails)..." : "Type your message..."}
                  disabled={isLoading}
                  className="flex-grow h-12 border-[rgb(55,55,55)] bg-[#383A40] placeholder:italic placeholder:text-zinc-500 rounded-2xl pl-16 pr-12 focus:border-blue-500 focus:ring-blue-500 focus:ring-1 hover:border-blue-500 transition-colors duration-75 text-gray-100"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="absolute right-5 top-1/2 -translate-y-1/2 h-8 w-8" // Adjusted right to make space
                  disabled={isLoading || !input.trim()}
                >
                  <SendHorizontalIcon className="h-4 w-4 text-emerald-400" />
                </Button>
              </form>
            </div>
          </div>
        </section>
      )
    }