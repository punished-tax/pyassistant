
import Chat from '@/components/chat'
import React from 'react';
import Editor from './editor'

import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BadgeHelp, Play } from 'lucide-react'
import { getChallengeDataForDate } from '@/lib/challenges';
import Link from 'next/link';
import { Suspense } from 'react'; // For better loading states




export const revalidate = 86400; // 24 hours

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

async function TodaysChallenge() {
  const today = getTodayDateString();
  const challengeData = await getChallengeDataForDate(today);

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
    <div className="space-y-3 max-w-2xl ml-44">
      {/* Question Section */}
      <section className="p-4 border-none bg-[rgb(34,34,34)] dark:bg-gray-800">
        <h2 className='text-2xl md:text-3xl font-bold mb-4 text-gray-200'>Today's Challenge:</h2>
        <h2 className="text-xl font-bold mb-3 text-gray-400 dark:text-gray-400">Question title</h2>
        <div className="prose dark:prose-invert max-w-none text-gray-300 dark:text-gray-300">
          <p>{challengeData.question}</p>
        </div>
      </section>

      {/* Input/Output Example Section */}
      <section className="p-4 border-none bg-gray-700 dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-3 text-gray-100 dark:text-gray-200">Example:</h2>
        <div className="space-y-2">
          <div>
            <h3 className="font-medium mb-1 text-gray-100 dark:text-gray-300">Input:</h3>
            <pre className="bg-gray-600 dark:bg-gray-700 p-2 rounded overflow-x-auto text-sm text-gray-100 dark:text-gray-200">
              <code>{challengeData.inputOutput.input}</code>
            </pre>
          </div>
          <div>
            <h3 className="font-medium mb-1 text-gray-100 dark:text-gray-300">Output:</h3>
             <pre className="bg-gray-600 dark:bg-gray-700 p-2 rounded overflow-x-auto text-sm text-gray-100 dark:text-gray-200">
               <code>{challengeData.inputOutput.output}</code>
            </pre>
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
    <header className="relative bg-black border-b border-gray-500 py-2">
      <div className="container mx-auto px-4 relative flex items-center justify-between">
        <h1 className="text-white text-3xl font-mono font-bold flex-grow text-center">
          {title}
        </h1>
        
        <div className="flex-shrink-0">
          <Dialog>
            <DialogTrigger className="flex items-center gap-2 text-white hover:underline focus:outline-none">
              <span>About</span>
              <BadgeHelp size={25} />
            </DialogTrigger>
            <DialogContent className="bg-black p-6 rounded-md">
              <DialogHeader>
                <DialogTitle>About</DialogTitle>
              </DialogHeader>
              <p>Practice your coding knowledge and take on daily python challenges! This website is in the spirit of Leetcode and has curated questions from Chatgpt, as well as a chatbot to help you with specific syntax. </p>
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
    <div className="p-6 border rounded-lg shadow-md bg-gray-800 animate-pulse">
      <h2 className="text-2xl font-semibold mb-4 h-8 bg-gray-700 rounded w-3/4"></h2>
      <div className="space-y-3">
        <div className="h-4 bg-gray-700 rounded"></div>
        <div className="h-4 bg-gray-700 rounded w-5/6"></div>
        <div className="h-4 bg-gray-700 rounded w-4/6"></div>
      </div>
       <div className="mt-6 text-center h-10 bg-gray-700 rounded w-1/3 mx-auto"></div>
    </div>
  );
}

export const runtime = 'edge'

export default function Home() {
  
 
  return (
  <>
    <Header title="PyAssistant"/>
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl md:text-4xl font-bold mb-5 text-center text-gray-500 dark:text-white">
        
      </h1>
      {/* Use Suspense for a better loading experience */}
      <Suspense fallback={<LoadingTodaysChallenge />}>
         <TodaysChallenge />
      </Suspense>
    </div>

    <div className="flex justify-center items-start space-x-5 mt-4">
      <div className="w-[600px] h-[500px]">
        <Editor />
      </div>
      <div className="w-[600px] h-[500px]">
        <Chat />
      </div>
    </div>
  </>
)
  
}

