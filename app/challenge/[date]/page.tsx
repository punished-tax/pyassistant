// app/challenge/[date]/page.tsx

import { getChallengeDataForDate } from '@/lib/challenges';
//import type { ChallengeData } from '@/lib/challenges';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { Suspense } from 'react';

// Revalidate daily - ensures if today's challenge is added later in the day,
// visiting the page will eventually show it after the first fetch misses.
// Also good practice for ISR in general.
//export const revalidate = 86400;
export const runtime = 'edge'

interface ChallengePageProps {
  params: {
    date: string; // from the URL segment [date]
  };
}

// Generate Metadata dynamically
export async function generateMetadata({ params }: ChallengePageProps): Promise<Metadata> {
    const challengeData = await getChallengeDataForDate(params.date); // Fetch data
    const title = challengeData
      ? `${challengeData.questionTitle} - Python Challenge ${params.date}`
      : `Python Challenge - ${params.date}`;
    const description = challengeData
      ? `Solve the Python coding challenge: ${challengeData.questionTitle} for ${params.date}.`
      : `Solve the Python coding challenge for ${params.date}.`;
  return {
    title: `Python Challenge - ${params.date}`,
    description: `Solve the Python coding challenge for ${params.date}.`,
  };
}

// Optional: Pre-render known past dates at build time
// export async function generateStaticParams() {
//    const dates = await getAvailableChallengeDates();
//    return dates.map((date) => ({ date }));
// }


async function ChallengeDetails({ date }: { date: string }) {
  const challengeData = await getChallengeDataForDate(date);

  if (!challengeData) {
    // If data fetch failed or returned null (e.g., 404 from API)
    // Render a specific message or use notFound()
    // notFound(); // Use this for a standard 404 page

    return (
       <div className="text-center p-8">
           <h1 className="text-2xl font-bold mb-4">Challenge Not Found</h1>
           <p className="text-gray-600 dark:text-gray-400">
             Sorry, we couldn't find a challenge for the date: {date}.
           </p>
           <Link href="/calendar" className="mt-6 inline-block text-blue-600 dark:text-blue-400 hover:underline">
             Back to Calendar
           </Link>
       </div>
    );
  }

  // Render the full challenge details
  return (
    <div className="space-y-6">
      {/* Question Section */}
      <section className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Question</h2>
        <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
          <p>{challengeData.question}</p>
        </div>
      </section>

      {/* Input/Output Example Section */}
      <section className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Example</h2>
        <div className="space-y-2">
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Input:</h3>
            <pre className="bg-gray-200 dark:bg-gray-700 p-3 rounded overflow-x-auto text-sm text-gray-800 dark:text-gray-200">
              <code>{challengeData.inputOutput.input}</code>
            </pre>
          </div>
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Output:</h3>
             <pre className="bg-gray-200 dark:bg-gray-700 p-3 rounded overflow-x-auto text-sm text-gray-800 dark:text-gray-200">
               <code>{challengeData.inputOutput.output}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* --- Placeholder for Pyodide Integration --- */}
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-800 shadow">
           <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Solve Online</h2>
           {/*
             This part will likely become a Client Component ('use client')
             It will import Pyodide, set up an editor (like Monaco),
             and handle running the user's code against hidden test cases or the sample input.
           */}
           <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-center text-gray-500 dark:text-gray-400">
               Online editor integration coming soon!
           </div>
      </section>
      {/* --- End Pyodide Placeholder --- */}


      {/* Solution Section (Consider hiding initially with a button) */}
      <section className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          {/* TODO: Add a state/button to reveal solution/explanation */}
         <details className="group">
            <summary className="text-xl font-semibold cursor-pointer list-none text-gray-800 dark:text-gray-200">
               Solution & Explanation
               <span className="text-sm text-gray-500 dark:text-gray-400 ml-2 group-open:hidden">(Click to reveal)</span>
            </summary>

            <div className="mt-4 space-y-4">
                <div>
                    <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Solution Code:</h3>
                    <pre className="bg-gray-200 dark:bg-gray-700 p-3 rounded overflow-x-auto text-sm">
                        <code className="language-python">{challengeData.solution}</code>
                        {/* Add syntax highlighting later with libraries like highlight.js or prism.js */}
                    </pre>
                </div>
                 <div>
                    <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Explanation:</h3>
                    <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                        <p>{challengeData.explanation}</p>
                    </div>
                </div>
            </div>
         </details>
      </section>
    </div>
  );
}


// The Main Page Component
export default function ChallengePage({ params }: ChallengePageProps) {
  const { date } = params;

  // Basic date format validation
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    notFound(); // Invalid date format leads to 404
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          Challenge: {date}
        </h1>
        <Link href="/calendar" className="text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to Calendar
        </Link>
      </div>
      <Suspense fallback={<LoadingChallengeDetails />}>
        <ChallengeDetails date={date} />
      </Suspense>
    </div>
  );
}

// Simple Loading Skeleton for the details page
function LoadingChallengeDetails() {
    return (
        <div className="space-y-6 animate-pulse">
            {[...Array(4)].map((_, i) => ( // Create 4 skeleton sections
                <div key={i} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                    <div className="space-y-2">
                        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
                    </div>
                </div>
            ))}
        </div>
    );
}