// app/challenge/[date]/page.tsx
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
import { notFound } from 'next/navigation'; // For handling missing challenges

// For archived data, revalidation might not be strictly necessary if data in KV is considered permanent.
// If you want to allow the possibility of updating an archived entry by re-fetching from OpenAI
// (e.g., if the OpenAI prompt changes or there was an error), you can keep revalidate.
// Otherwise, remove it or set a very long duration.
// For now, let's remove it to primarily serve from cache. Vercel KV items don't expire by default.
// export const revalidate = 86400; // 24 hours, or remove for indefinite cache

// Optional: Pre-render some recent archive pages at build time
// import { getAvailableChallengeDates } from '@/lib/challenges';
// export async function generateStaticParams() {
//   const availableDates = await getAvailableChallengeDates();
//   // Example: pre-render the 10 most recent challenges
//   const recentDatesToPrerender = availableDates.slice(0, 10);
//   return recentDatesToPrerender.map((date) => ({
//     date: date,
//   }));
// }


// Helper to generate default editor code (same as in main page.tsx)
function generateInitialCode(challengeData: ChallengeData | null): string {
  if (challengeData?.solutionHeader) {
      const header = challengeData.solutionHeader.trim();
      const needsColon = !header.endsWith(':');
      return `${header}${needsColon ? ':' : ''}\n  pass\n\n`;
  }
  return `def solve():\n  # Your solution here\n  pass\n\n`;
}

const Header: React.FC<{ title: string }> = ({ title }) => {
  return (
    <header className="relative bg-black border-b border-gray-400 py-2">
      <div className="container mx-auto px-4 flex justify-center items-center">
        <h1 className="text-white text-3xl font-mono font-bold ">
          <Link href="/">
          {title}
          </Link>
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
                <DialogTitle className='block w-fit text-xl font-mono bg-[rgb(55,55,55)] px-2 py-1'>PyAssistant - Daily Python Challenges</DialogTitle>
              </DialogHeader>
              <p>PyAssistant is a daily coding game that tests your python skills. The coding assistant has the given question in its context so it can give you general tips and code snippets if you're in any trouble. It also has the ability to analyze your code by clicking the purple button and typing in your question. </p>
              <p>The questions are fetched from ChatGPT every 24 hours. They are meant to be a fair challenge for beginners who are learning to code.</p>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
};

// Type for page parameters
interface ChallengePageProps {
  params: {
    date: string; // This will be 'YYYY-MM-DD'
  };
}

// Dynamic metadata for the page title
export async function generateMetadata({ params }: ChallengePageProps) {
  return {
    title: `pyassistant`,
    description: `Python Coding Challenge for ${params.date}`,
    icons: { icon: '/favicon.ico' }
  };
}

export const runtime = 'edge'; // Vercel KV and OpenAI SDK v4 are Edge compatible

export default async function ChallengePage({ params }: ChallengePageProps) {
  const { date } = params;

  // Validate date format from URL parameter
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error("Invalid date format in URL parameter:", date);
    notFound(); // Render 404 page
  }

  const fetchedChallengeData = await getChallengeDataForDate(date);

  if (!fetchedChallengeData) {
    // If no data is found for this date (e.g., not in cache, and OpenAI fetch failed or wasn't attempted for old dates)
    console.log(`Challenge data not found for date: ${date}. Rendering 404.`);
    notFound(); // This will render the nearest not-found.js file or a default Next.js 404 page
  }

  const rawInputs: string[] = fetchedChallengeData.testCases?.map(tc => tc.input) ?? [];
  const referenceSolutionCode: string = fetchedChallengeData.solution ?? "";
  const editorSetupCode = generateInitialCode(fetchedChallengeData);

  return (
    <>
      <Header title="pyassistant"/> {/* Pass the date to the header --> NO, just add go back to today's q */}
      <Suspense fallback={
        <div className="text-center p-10 text-white">
          Loading Challenge for {date}...
        </div>
      }>
        <ChallengeInterfaceClient
          initialChallengeData={fetchedChallengeData}
          initialEditorSetupCode={editorSetupCode}
          rawInputsForEnvironment={rawInputs}
          referenceSolutionCodeForEnvironment={referenceSolutionCode}
          key={date} // Add key to ensure client component remounts/resets if navigating between different [date] pages
        />
      </Suspense>
    </>
  );
}