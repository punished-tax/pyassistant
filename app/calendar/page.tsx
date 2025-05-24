// app/calendar/page.tsx
import Link from 'next/link';
import CalendarView from '@/components/CalendarView';
import { getAvailableChallengesInfo, AvailableChallengeInfo } from '@/lib/challenges';
import {
    Dialog,
    DialogContent,
    DialogTrigger,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
import { BadgeHelp, Dices, ChevronLeft, ChevronRight } from 'lucide-react'; 

export const metadata = {
  title: "pyassistant"
};

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
                <DialogTitle className='block w-fit text-xl font-mono bg-[rgb(55,55,55)] px-2 py-1'>About PyAssistant</DialogTitle>
              </DialogHeader>
              <p>PyAssistant is a daily coding game that tests your python skills. The coding assistant has the given question in its context so it can give you general tips and code snippets if you're in any trouble. You can also have it analyze your code by clicking the purple button and typing in your question. </p>
              <p>The questions are fetched from ChatGPT every 24 hours and they vary between easy and medium difficulty.</p>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
};

// Helper to get today's date string in YYYY-MM-DD format
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

// Props for the page, including searchParams for year and month
interface CalendarPageProps {
  searchParams: {
    year?: string;
    month?: string;
  };
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const today = new Date();
  let displayYear = today.getFullYear();
  let displayMonth = today.getMonth() + 1; // 1-12

  // Safely access searchParams properties
  const queryYear = searchParams?.year;
  const queryMonth = searchParams?.month;

  if (queryYear && !isNaN(parseInt(queryYear))) {
    displayYear = parseInt(queryYear);
  }
  if (queryMonth && !isNaN(parseInt(queryMonth))) {
    const m = parseInt(queryMonth);
    if (m >= 1 && m <= 12) {
      displayMonth = m;
    }
  }

    // Fetch data on the server using the new function
  const availableChallenges: AvailableChallengeInfo[] = await getAvailableChallengesInfo();
  const todayDateStr = getTodayDateString();

  // Calculate previous and next month for navigation links
  const currentDateObj = new Date(Date.UTC(displayYear, displayMonth - 1, 15)); // Use 15th to avoid month-end issues

  const prevMonthDateObj = new Date(currentDateObj);
  prevMonthDateObj.setUTCMonth(currentDateObj.getUTCMonth() - 1);
  const prevYear = prevMonthDateObj.getUTCFullYear();
  const prevMonth = prevMonthDateObj.getUTCMonth() + 1;

  const nextMonthDateObj = new Date(currentDateObj);
  nextMonthDateObj.setUTCMonth(currentDateObj.getUTCMonth() + 1);
  const nextYear = nextMonthDateObj.getUTCFullYear();
  const nextMonth = nextMonthDateObj.getUTCMonth() + 1;

  const currentMonthName = new Date(Date.UTC(displayYear, displayMonth - 1, 1)).toLocaleString('default', { month: 'long', timeZone: 'UTC' });

  return (
    <>
      <Header title="pyassistant"/>
      <div className="container mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-mono mb-6 text-left ml-16 text-gray-100 block w-fit bg-[rgb(55,55,55)] px-2 py-1">
          Archive
        </h1>
         <div className="flex justify-center items-center mb-6">
        

        {/* Month Navigation */}
           <div className="flex items-center gap-2">
            <Link
              href={`/calendar?year=${prevYear}&month=${prevMonth}`}
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              title="Previous Month"
            >
              <ChevronLeft size={28} />
            </Link>
            <span className="text-xl font-semibold text-gray-100 w-36 text-center">
              {currentMonthName} {displayYear}
            </span>
            <Link
              href={`/calendar?year=${nextYear}&month=${nextMonth}`}
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              title="Next Month"
            >
              <ChevronRight size={28} />
            </Link>
          </div>
        </div>
        

        <div className="max-w-6xl mx-auto"> {/* Adjusted width for better calendar display */}
           <CalendarView
             year={displayYear}
             month={displayMonth}
             availableChallenges={availableChallenges}  // Pass available dates
             todayDate={todayDateStr}         // Pass today's date string
           />
        </div>

        
      </div>
    </>
  );
}