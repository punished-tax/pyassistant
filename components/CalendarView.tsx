// components/CalendarView.tsx
import Link from 'next/link';
import { AvailableChallengeInfo } from '@/lib/challenges'; // Import the type

interface CalendarViewProps {
  year: number;
  month: number; // 1-12
  availableChallenges: AvailableChallengeInfo[]; // List of 'YYYY-MM-DD' strings for which challenges exist
  todayDate: string;        // Today's date as 'YYYY-MM-DD'
}

// Helper function (same as before, ensure it uses UTC for consistency)
const generateDaysForMonth = (year: number, month: number): ( { dayOfMonth: number; dateString: string } | null )[] => {
    const days: ( { dayOfMonth: number; dateString: string } | null )[] = [];
    // Use UTC to avoid timezone shifts affecting month/day calculations
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startDayOfWeek = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 (Sun) - 6 (Sat)

    for (let i = 0; i < startDayOfWeek; i++) { days.push(null); }
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        days.push({ dayOfMonth: day, dateString: dateStr });
    }
    return days;
};

// Helper function to format date as DD-MM
const formatDateDDMM = (dateString: string): string => {
  // dateString is in YYYY-MM-DD format
  const parts = dateString.split('-'); // Example: "2023-10-27" -> ["2023", "10", "27"]
  if (parts.length === 3) {
    const day = parts[2];
    const month = parts[1];
    return `${day}-${month}`;
  }
  return dateString; // Fallback in case of unexpected format
};

export default function CalendarView({ year, month, availableChallenges, todayDate }: CalendarViewProps) {
  const daysInMonth = generateDaysForMonth(year, month);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  //const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('default', { month: 'long', timeZone: 'UTC' });

  const challengeTitleMap = new Map<string, string>();
  availableChallenges.forEach(challenge => {
    challengeTitleMap.set(challenge.date, challenge.questionTitle);
  });

  return (
    <div className="bg-[rgb(34,34,34)] p-4 sm:p-6 rounded-lg">
      {/*<h3 className="text-xl sm:text-2xl font-semibold mb-4 text-center text-white">
        {monthName} {year}
      </h3>*/}
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekdays.map(day => (
          <div key={day} className="font-medium text-xs md:text-sm text-white">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2"> {/* Increased gap slightly */}
        {daysInMonth.map((dayInfo, index) => {
          if (!dayInfo) {
            // Increased min-height for empty cells too
            return <div key={`empty-${index}`} className="border-transparent min-h-[6rem] sm:min-h-[7.5rem] rounded"></div>;
          }

          const isToday = dayInfo.dateString === todayDate;
          const challengeTitle = challengeTitleMap.get(dayInfo.dateString);
          const hasChallenge = !!challengeTitle;

          // Increased min-height for all cells
          let cellClasses = `p-2 border rounded flex flex-col justify-between items-center min-h-[6rem] sm:min-h-[6rem] min-w-[6rem] transition-colors duration-150 text-center `;
          const displayTitle = challengeTitle ? (challengeTitle.length > 45 ? challengeTitle.substring(0, 42) + "..." : challengeTitle) : "";
          const formattedDate = formatDateDDMM(dayInfo.dateString);


          if (isToday && hasChallenge) {
            cellClasses += `border-blue-500 text-white font-bold hover:bg-blue-500 cursor-pointer`;
            return (
              <Link
                href={`/`}
                key={dayInfo.dateString}
                className={cellClasses}
                title=''
              >
                {/* Title takes up available space, pushed to top by justify-between */}
                <span className="text-xs font-medium mt-1 px-1 leading-tight line-clamp-3 flex-grow w-full text-left">
                  {displayTitle}
                </span>
                {/* Date at the bottom */}
                <span className="font-normal text-xs text-blue-200 self-end mt-auto">
                  {formattedDate} (Today)
                </span>
              </Link>
            );
          } else if (hasChallenge) {
            cellClasses += `border-gray-600 bg-gray-700 dark:bg-gray-750 hover:bg-gray-600 dark:hover:bg-gray-650 cursor-pointer`;
            return (
              <Link
                href={`/challenge/${dayInfo.dateString}`}
                key={dayInfo.dateString}
                className={cellClasses}
                title={`View challenge: ${displayTitle}`}
              >
                <span className="text-xs font-medium mt-1 px-1 text-green-200 leading-tight line-clamp-3 flex-grow w-full text-left">
                  {displayTitle}
                </span>
                <span className="font-normal text-xs text-gray-400 self-end mt-auto">
                  {formattedDate}
                </span>
              </Link>
            );
          } else {
            cellClasses += `border-gray-700 dark:border-gray-750 bg-[rgb(34,34,34)] text-gray-500 opacity-70`;
            return (
              <div key={dayInfo.dateString} className={`${cellClasses} justify-end`}> {/* Align date to bottom for empty cells */}
                <span className="font-normal text-xs self-end">
                  {formattedDate}
                </span>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}