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
  import { BadgeHelp, Play } from 'lucide-react'


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
              <DialogContent className="bg-[rgb(34,34,34)] p-6 rounded-md">
                <DialogHeader>
                  <DialogTitle>About</DialogTitle>
                </DialogHeader>
                <p>Practice your coding knowledge and take on daily python challenges! This website is in the spirit of Wordle and has curated questions from ChatGPT, as well as a chatbot to help you with getting a headstart in solving problems. </p>
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
    <Header title="PyAssistant"/>
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6 text-left text-gray-100 dark:text-white">
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