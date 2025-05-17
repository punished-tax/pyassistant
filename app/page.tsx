//page.tsx
import React, { Suspense} from 'react'; // Added useCallback
//import Editor from './editor'

import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BadgeHelp, Dices } from 'lucide-react'
import { getChallengeDataForDate, ChallengeData } from '@/lib/challenges';
import Link from 'next/link';
import ChallengeInterfaceClient from '@/components/challenge-interface'; // We will create this

export const metadata = {
  title: "pyassistant",
  description: "Daily Python Coding Challenges",
  icons: { icon: '/android-chrome-192x192.png' }
};

export const revalidate = 86400; // 24 hours

// Helper to generate default editor code from header or fallback
function generateInitialCode(challengeData: ChallengeData | null): string {
  // Use solutionHeader if available, otherwise provide a standard Python function stub
  if (challengeData?.solutionHeader) {
      // Add 'pass' and standard indentation/newlines for a clean editor start
      const header = challengeData.solutionHeader.trim();
      // Basic check if it already ends with a colon, common in function defs
      const needsColon = !header.endsWith(':');
      return `${header}${needsColon ? ':' : ''}\n  pass\n\n`;
  }
  // Fallback default code
  return `def solve():\n  # Your solution here\n  pass\n\n`;
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}




// Header 
const Header: React.FC<{ title: string }> = ({ title }) => {
  return (
    <header className="relative bg-black border-b border-gray-400 py-2">
      <div className="container mx-auto px-4 flex justify-center items-center">
        <h1 className="text-white text-3xl font-mono font-bold ">
          {title}
        </h1>

        <div className='absolute left-4 top-1/2 transform -translate-y-1/2'>
          <span>
            
            <Link href='/calendar' className='inline-flex items-center gap-2 px-3 py-2 text-white hover:bg-[rgb(75,75,75)] focus:outline-none transition-colors'>
            <Dices> size={25}</Dices>
            Archive
            </Link>
          </span>
          
        </div>
        
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          <Dialog>
            <DialogTrigger className="inline-flex items-center gap-2 px-3 py-2 text-white hover:bg-[rgb(75,75,75)] focus:outline-none transition-colors">
              <span>About</span>
              <BadgeHelp size={25} />
            </DialogTrigger>
            <DialogContent className="border rounded-xl border-[rgb(34,34,34)] bg-[rgb(34,34,34)] p-6 ">
              <DialogHeader>
                
                <DialogTitle className='block w-fit text-xl font-mono bg-[rgb(55,55,55)] px-2 py-1'>About PyAssistant</DialogTitle>
                
              </DialogHeader>
              <p>PyAssistant is a daily coding game in the spirit of Leetcode and Wordle. The questions are fetched from ChatGPT and the chatbot can help you get a headstart in solving problems, or even analyze the code you've written so far. </p>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  )
}

// Simple Loading Component
function LoadingTodaysChallenge() {
  const today = getTodayDateString();
  return (
    <>
      
      <div className=" max-w-2xl ml-44">
      {/* LOADING*/}
      <section className="p-4 border-none bg-[rgb(34,34,34)] dark:bg-gray-800">
        <h2 className='text-2xl md:text-3xl font-bold mb-4 text-gray-200'>Loading Challenge...</h2>
        <h2 className="text-2xl font-bold mb-3 text-gray-200 dark:text-gray-400"></h2>
        <div className="prose dark:prose-invert max-w-none text-gray-200 dark:text-gray-300">
          <p></p>
        </div>
      </section>

      {/* LOADING */}
      <section className="p-4 border-none bg-[rgb(34,34,34)] dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-3 text-gray-100 dark:text-gray-200"></h2>
        <div className="space-y-2">
          <div>
            <h3 className="font-medium mb-1 text-gray-100 dark:text-gray-300"></h3>
            <pre className="bg-[rgb(34,34,34)] p-2 rounded overflow-x-auto text-sm text-gray-100 dark:text-gray-200">
              <code></code>
            </pre>
          </div>
          <div>
            <h3 className="font-medium mb-1 text-gray-100 dark:text-gray-300"></h3>
             <pre className="bg-[rgb(34,34,34)] p-2 rounded overflow-x-auto text-sm text-gray-100 dark:text-gray-200">
               <code></code>
            </pre>
          </div>
        </div>
      </section>

      
      {/* Solution Section (Consider hiding initially with a button) */}
      
    </div>
      
      </>
  );
}



export const runtime = 'edge'

export default async function Home() {
  const today = getTodayDateString();
  const fetchedChallengeData = await getChallengeDataForDate(today); // Data fetching on server

  const rawInputs: string[] = fetchedChallengeData?.testCases?.map(tc => tc.input) ?? [];
  const referenceSolutionCode: string = fetchedChallengeData?.solution ?? "";
  const editorSetupCode = generateInitialCode(fetchedChallengeData);

  return (
    <>
      <Header title="pyassistant" />
      <Suspense fallback={<div className="text-center p-10 text-white">Loading Challenge...</div>}>
        {/* Pass server-fetched data to the Client Component */}
        <ChallengeInterfaceClient
          initialChallengeData={fetchedChallengeData}
          initialEditorSetupCode={editorSetupCode} // Renamed for clarity from "initialEditorCode"
          rawInputsForEnvironment={rawInputs} // Renamed for clarity
          referenceSolutionCodeForEnvironment={referenceSolutionCode} // Renamed for clarity
        />
      </Suspense>
    </>
  );
  
}

