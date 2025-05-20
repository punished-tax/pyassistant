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

export default function CalendarView({ year, month, availableChallenges, todayDate }: CalendarViewProps) {
  const daysInMonth = generateDaysForMonth(year, month);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('default', { month: 'long', timeZone: 'UTC' });

    // Create a map for quick lookup of titles by date
  const challengeTitleMap = new Map<string, string>();
  availableChallenges.forEach(challenge => {
    challengeTitleMap.set(challenge.date, challenge.questionTitle);
  });

  return (
    <div className="bg-[rgb(34,34,34)] dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
      <h3 className="text-xl sm:text-2xl font-semibold mb-4 text-center text-gray-100 dark:text-gray-200">
        {monthName} {year}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekdays.map(day => (
          <div key={day} className="font-medium text-xs md:text-sm text-gray-300 dark:text-gray-400">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {daysInMonth.map((dayInfo, index) => {
          if (!dayInfo) {
            return <div key={`empty-${index}`} className="border-transparent min-h-[5rem] sm:min-h-[6rem] rounded"></div>;
          }

          const isToday = dayInfo.dateString === todayDate;
          const challengeTitle = challengeTitleMap.get(dayInfo.dateString);
          const hasChallenge = !!challengeTitle;

          let cellClasses = `p-2 border rounded flex flex-col justify-between items-center min-h-[5rem] sm:min-h-[6rem] transition-colors duration-150 text-center `;
          // Ensure question titles are not too long, truncate or use ellipsis
          const displayTitle = challengeTitle ? (challengeTitle.length > 35 ? challengeTitle.substring(0, 32) + "..." : challengeTitle) : "";


          if (isToday && hasChallenge) {
            cellClasses += `bg-blue-600 border-blue-500 text-white font-semibold hover:bg-blue-500 cursor-pointer`;
            return (
              <Link
                href={`/`} // Link to homepage for today's challenge
                key={dayInfo.dateString}
                className={cellClasses}
                title={`Today's Challenge: ${displayTitle}`}
              >
                <span className="font-bold text-sm md:text-base self-start">{dayInfo.dayOfMonth}</span>
                <span className="text-xs mt-1 px-1 leading-tight line-clamp-3">
                  {displayTitle}
                </span>
              </Link>
            );
          } else if (hasChallenge) {
            cellClasses += `border-gray-600 dark:border-gray-700 bg-gray-700 dark:bg-gray-750 hover:bg-gray-600 dark:hover:bg-gray-650 cursor-pointer`;
            return (
              <Link
                href={`/challenge/${dayInfo.dateString}`}
                key={dayInfo.dateString}
                className={cellClasses}
                title={`View challenge: ${displayTitle}`}
              >
                <span className="font-medium text-sm md:text-base text-gray-200 dark:text-gray-300 self-start">{dayInfo.dayOfMonth}</span>
                <span className="text-xs mt-1 px-1 text-green-300 leading-tight line-clamp-3">
                  {displayTitle}
                </span>
              </Link>
            );
          } else {
             // Day cells that are not today and have no challenge
            cellClasses += `border-gray-700 dark:border-gray-750 bg-gray-800 dark:bg-gray-850 text-gray-500 dark:text-gray-600 opacity-70`;
            return (
              <div key={dayInfo.dateString} className={cellClasses}>
                <span className="text-sm md:text-base self-start">{dayInfo.dayOfMonth}</span>
                 {/* No title to display */}
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}