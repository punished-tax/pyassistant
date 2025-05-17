// app/calendar/page.tsx
import Link from 'next/link';
import CalendarView from '@/components/CalendarView'; // Import the simpler component
import {
    Dialog,
    DialogContent,
    DialogTrigger,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog'
  import { BadgeHelp, Dices } from 'lucide-react'


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
              <p>PyAssistant is a daily coding game in the spirit of Leetcode and Wordle. It has curated questions from ChatGPT, as well as a chatbot to help you get a headstart in solving problems. </p>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  )
}

// No longer async, no data fetching here
export default function CalendarPage() {
  // You might still want year/month logic if you add navigation
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12

  return (
    <>
    <Header title="pyassistant"/>
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-mono mb-6 text-left text-gray-100 dark:text-white">
        Archive
      </h1>
      <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
        Select a date to view the challenge for that day.
      </p>

      {/* Render the CalendarView component WITHOUT fetched data */}
      {/* Pass year/month if needed for display/navigation later */}
      <div className="max-w-6xl mx-auto">
         <CalendarView year={currentYear} month={currentMonth} />
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="text-blue-800 dark:text-blue-400 hover:underline">
          ← Back to Today's Challenge
        </Link>
      </div>
    </div>
    </>
  );
}