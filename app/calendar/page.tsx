// app/calendar/page.tsx
import Link from 'next/link';
// Remove the import for getAvailableChallengeDates
import CalendarView from '@/components/CalendarView'; // Import the component

export const metadata = {
  title: 'Challenge Calendar',
  description: 'Browse past Python coding challenges.',
};

export default async function CalendarPage() {
  // No need to fetch availableDates anymore
  // const availableDates = await getAvailableChallengeDates();
  // const availableDateSet = new Set(availableDates);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-900 dark:text-white">
        Challenge Calendar
      </h1>
       <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
         Select a date to view and solve the challenge.
       </p>

      {/* Render the Calendar Component WITHOUT availableDates prop */}
      <div className="max-w-2xl mx-auto">
        {/* Pass any other necessary props, like current year/month if needed */}
        <CalendarView />
      </div>

       <div className="mt-8 text-center">
            <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
                ← Back to Today's Challenge
            </Link>
        </div>
    </div>
  );
}