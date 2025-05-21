// app/page.tsx
import React, { Suspense } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BadgeHelp, Dices } from 'lucide-react';
import { getChallengeDataForDate, ChallengeData } from '@/lib/challenges';
import Link from 'next/link';
import ChallengeInterfaceClient from '@/components/challenge-interface';

export const metadata = {
  title: "pyassistant",
  description: "Daily Python Coding Challenges",
  icons: { icon: '/rubix.jpg' }
};

// Revalidate this page every 24 hours.
// When revalidated, getChallengeDataForDate(today) will be called.
// If it's a new "today", and data isn't in cache, OpenAI will be hit, and then cached.
export const revalidate = 86400; // 24 hours in seconds

// Helper to generate default editor code (same as before)
function generateInitialCode(challengeData: ChallengeData | null): string {
  if (challengeData?.solutionHeader) {
      const header = challengeData.solutionHeader.trim();
      const needsColon = !header.endsWith(':');
      return `${header}${needsColon ? ':' : ''}\n  pass\n\n`;
  }
  return `def solve():\n  # Your solution here\n  pass\n\n`;
}

// Helper to get today's date string (can be moved to a utils file if used widely)
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

// Header Component (same as before)
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
            <Dices size={25} />
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
              <p>PyAssistant is a daily coding game in the spirit of Leetcode and Wordle. The questions are fetched from ChatGPT, and the chatbot can help analyze your code if you're in any trouble. </p>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
};

// Loading component remains the same

export const runtime = 'edge'; // Ensure this is compatible with all operations

export default async function Home() {
  const today = getTodayDateString();
  const fetchedChallengeData = await getChallengeDataForDate(today); // This now uses the cache

  // Handle case where today's challenge might not be available (e.g., first run, OpenAI error)
  if (!fetchedChallengeData) {
    return (
      <>
        <Header title="pyassistant" />
        <div className="text-center p-10 text-white">
          <h2 className="text-2xl font-bold mb-4">Challenge Not Available</h2>
          <p>Today's challenge could not be loaded. Please try again later.</p>
          <p className="mt-4">If this is the first time running the app today, the challenge might still be generating.</p>
        </div>
      </>
    );
  }

  const rawInputs: string[] = fetchedChallengeData.testCases?.map(tc => tc.input) ?? [];
  const referenceSolutionCode: string = fetchedChallengeData.solution ?? "";
  const editorSetupCode = generateInitialCode(fetchedChallengeData);

  return (
    <>
      <Header title="pyassistant" />
      <Suspense fallback={<div className="text-center p-10 text-white">Loading Today's Challenge...</div>}>
        <ChallengeInterfaceClient
          initialChallengeData={fetchedChallengeData}
          initialEditorSetupCode={editorSetupCode}
          rawInputsForEnvironment={rawInputs}
          referenceSolutionCodeForEnvironment={referenceSolutionCode}
        />
      </Suspense>
    </>
  );
}

