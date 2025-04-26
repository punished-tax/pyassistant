// components/CalendarView.tsx
import Link from 'next/link';


// Remove the titlesMap from props
interface CalendarViewProps {
  year: number;
  month: number; // 1-12
}



// Helper function (same as before)
const generateDaysForMonth = (year: number, month: number): ( { dayOfMonth: number; dateString: string } | null )[] => {
    
    const days: ( { dayOfMonth: number; dateString: string } | null )[] = [];
    const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startDayOfWeek = firstDayOfMonth.getUTCDay();
    for (let i = 0; i < startDayOfWeek; i++) { days.push(null); }
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        days.push({ dayOfMonth: day, dateString: dateStr });
    }
    return days;
};


// Remove titlesMap from function signature and logic
export default function CalendarView({ year, month }: CalendarViewProps) {
  const daysInMonth = generateDaysForMonth(year, month);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('default', { month: 'long', timeZone: 'UTC' });

  return (
    <>
    
    <div className="bg-[rgb(34,34,34)] dark:bg-gray-800 p-4 rounded-lg ">
      <h3 className="text-xl font-semibold mb-4 text-center text-gray-100 dark:text-gray-200">
        {monthName} {year}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekdays.map(day => (
          <div key={day} className="font-medium text-xs md:text-sm text-gray-100 dark:text-gray-400">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((dayInfo, index) => {
          if (!dayInfo) {
            // Empty cell
            return <div key={`empty-${index}`} className=" dark:border-gray-700 min-h-[4rem]"></div>;
          }

          // Always render the link, remove conditional styling based on title presence
          return (
            <Link
              href={`/challenge/${dayInfo.dateString}`}
              key={dayInfo.dateString}
              className={`p-1.5 border rounded flex flex-col justify-start items-center min-h-[4rem] transition-colors duration-150 text-center
                        border-gray-700 dark:border-gray-700 bg-gray-800 dark:bg-gray-800
                        hover:bg-[rgb(34,34,34)] dark:hover:bg-gray-700`}
            >
              {/* Day Number */}
              <span className="font-semibold text-sm md:text-base text-gray-100 dark:text-gray-300">
                {dayInfo.dayOfMonth}
              </span>
              {/* No title displayed here anymore */}
            </Link>
          );
        })}
      </div>
    </div>
        </>
  );
}