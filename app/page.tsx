
import Chat from '@/components/chat'
import React from 'react';
//import Editor from './editor'
import CodingEnvironment from '@/components/coding-environment'; // Import the new component
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BadgeHelp, icons } from 'lucide-react'
import { getChallengeDataForDate, ChallengeData } from '@/lib/challenges';
import Link from 'next/link';
import { Suspense } from 'react'; // For better loading states
import { title } from 'process';
import { Description } from '@radix-ui/react-dialog';

export const metadata = {
  title: "PyAssistant",
  Description: "Daily Python Coding Challenges",
  icons: {
    icon: '/favicon.ico'
  }
}
export const revalidate = 86400; // 24 hours

// Helper to generate default editor code from header or fallback
function generateInitialCode(challengeData: ChallengeData | null): string {
  // Use solutionHeader if available, otherwise provide a standard Python function stub
  if (challengeData?.solutionHeader) {
      // Add 'pass' and standard indentation/newlines for a clean editor start
      const header = challengeData.solutionHeader.trim();
      // Basic check if it already ends with a colon, common in function defs
      const needsColon = !header.endsWith(':');
      return `${header}${needsColon ? ':' : ''}\n    pass\n\n`;
  }
  // Fallback default code
  return `def solve():\n  # Your solution here\n  pass\n\n`;
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

async function TodaysChallenge({ challengeData }: { challengeData: ChallengeData | null}) {
  const today = getTodayDateString();
  //const challengeData = await getChallengeDataForDate(today);

  if (!challengeData) {
    return (
      <div className="p-6 border rounded-lg shadow-md bg-white dark:bg-gray-800">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
            Today's Challenge ({today})
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Today's challenge is not available yet. Please check back later!
        </p>
        <div className="mt-6 text-center">
            <Link href="/calendar" className="text-blue-600 dark:text-blue-400 hover:underline">
                View Past Challenges
            </Link>
        </div>
      </div>
    );
  }

  return (
    <div className=" max-w-2xl ml-44">
      {/* Question Section */}
      <section className="p-4 border-none bg-[rgb(34,34,34)]">
        <h2 className='text-2xl md:text-3xl font-bold mb-2 text-gray-200'></h2>
        <h2 className="text-xl font-bold mb-3 text-gray-200">{challengeData.questionTitle}</h2>
        <div className=" text-sm prose dark:prose-invert max-w-none text-gray-200">
          <p>{challengeData.question}</p>
        </div>
      </section>

      {/* Input/Output Example Section - overflow-x-auto replaced with block w-fit*/}
      <section className="p-4 border-none bg-[rgb(34,34,34)]">
        <h2 className="text-xl font-semibold mb-2 text-gray-100">Example:</h2>
        <div className="space-y-1">
        <div className="flex items-start space-x-2">
  <h3 className="font-medium text-gray-100 mb-0">Input:</h3>
  <pre
    className="inline-block bg-[rgb(55,55,55)] p-1 rounded text-sm text-gray-100 m-0 whitespace-pre-wrap"
  >
    <code>{challengeData.inputOutput.input}</code>
  </pre>
        </div>
          <div className='flex items-start space-x-2'>
            <h3 className="font-medium mb-0 text-gray-100">Output:</h3>
             <pre className="inline-block bg-[rgb(55,55,55)] p-1 rounded text-sm text-gray-100 m-0 whitespace-pre-wrap">
               <code>{challengeData.inputOutput.output}</code>
            </pre>
          </div>
          <div>
            <h3 className="text-sm prose mt-3 text-gray-200">Make sure you return your solution, don't print!</h3>
             
          </div>
        </div>
      </section>

      
      {/* Solution Section (Consider hiding initially with a button) */}
      
    </div>
  );
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
              <p>PyAssistant is a daily coding game in the spirit of Leetcode and Wordle. It has curated questions from ChatGPT, as well as a chatbot to help you get a headstart in solving problems. </p>
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
  const challengeData = await getChallengeDataForDate(today);

  // Prepare props for CodingEnvironment
  // Extract raw inputs (handle null challengeData)
  const rawInputs: string[] = challengeData?.testCases?.map(tc => tc.input) ?? [];
  // Get reference solution (handle null challengeData)
  const referenceSolutionCode: string = challengeData?.solution ?? ""; // Provide empty string as fallback
  // Generate initial code for editor
  const initialCode = generateInitialCode(challengeData);
 
  return (
  <>
    <Header title="PyAssistant"/>
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="">
        
      </h1>
      {/* Use Suspense for a better loading experience */}
      <Suspense fallback={<LoadingTodaysChallenge />}>
         <TodaysChallenge challengeData={challengeData} />
      </Suspense>
    </div>

    <div className="flex justify-center items-start mt-3 ml-28">
      <div className="w-[600px] h-[500px]">
        <CodingEnvironment rawInputs={rawInputs} referenceSolutionCode={referenceSolutionCode} initialCode={initialCode}  />
      </div>
      <div className="w-[600px] h-[500px] ">
        <Chat />
      </div>
    </div>
  </>
)
  
}

