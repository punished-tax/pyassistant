// components/CalendarView.tsx
import Link from 'next/link';

interface CalendarViewProps {
  year: number;
  month: number; // 1-12
  availableDates: string[]; // List of 'YYYY-MM-DD' strings for which challenges exist
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

export default function CalendarView({ year, month, availableDates, todayDate }: CalendarViewProps) {
  const daysInMonth = generateDaysForMonth(year, month);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('default', { month: 'long', timeZone: 'UTC' });

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
            // Empty cell for days not in the current month (padding)
            return <div key={`empty-${index}`} className="border-transparent min-h-[4rem] sm:min-h-[5rem] rounded"></div>;
          }

          const isToday = dayInfo.dateString === todayDate;
          const hasChallenge = availableDates.includes(dayInfo.dateString);

          // Base classes for all date cells
          let cellClasses = `p-1.5 border rounded flex flex-col justify-start items-center min-h-[4rem] sm:min-h-[5rem] transition-colors duration-150 text-center text-sm sm:text-base `;

          if (isToday) {
            cellClasses += `bg-blue-600 border-blue-500 text-white font-semibold`; // Style for today
            return (
              <div key={dayInfo.dateString} className={cellClasses} title="Today's Challenge">
                <span className="font-semibold text-sm md:text-base">{dayInfo.dayOfMonth}</span>
                <span className="text-xs mt-1 px-1">Today's Challenge</span>
              </div>
            );
          } else if (hasChallenge) {
            // Style for past days with challenges (linkable)
            cellClasses += `border-gray-600 dark:border-gray-700 bg-gray-700 dark:bg-gray-750 hover:bg-gray-600 dark:hover:bg-gray-650 cursor-pointer`;
            return (
              <Link
                href={`/challenge/${dayInfo.dateString}`}
                key={dayInfo.dateString}
                className={cellClasses}
                title={`View challenge for ${dayInfo.dateString}`}
              >
                <span className="font-medium text-gray-200 dark:text-gray-300">{dayInfo.dayOfMonth}</span>
                {/* Optional: Add a small visual cue like a dot or text */}
                <span className="mt-1 text-xs text-green-400">View</span>
              </Link>
            );
          } else {
            // Style for days with no challenges (not today, not linkable)
            cellClasses += `border-gray-700 dark:border-gray-750 bg-gray-800 dark:bg-gray-850 text-gray-500 dark:text-gray-600 opacity-70`;
            return (
              <div key={dayInfo.dateString} className={cellClasses}>
                <span className="">{dayInfo.dayOfMonth}</span>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}