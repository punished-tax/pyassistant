      
// components/CalendarView.tsx

import Link from 'next/link';

// Remove the interface definition for props
// interface CalendarViewProps {
//   availableDates: Set<string>;
// }

// Helper function (same as before)
const generateDaysForMonth = (year: number, month: number) => {
    // ... (no changes needed here)
    const days = [];
    const date = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDayOfWeek = date.getDay();

    for (let i = 0; i < startDayOfWeek; i++) {
        days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        days.push({ dayOfMonth: day, dateString: dateStr });
    }
    return days;
};


// Remove props from the function signature
export default function CalendarView(/* { availableDates }: CalendarViewProps */) {
  // Example: Show current month - make this navigable later
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 1-12

  const daysInMonth = generateDaysForMonth(year, month);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-xl font-semibold mb-4 text-center text-gray-800 dark:text-gray-200">
        {today.toLocaleString('default', { month: 'long' })} {year}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekdays.map(day => (
          <div key={day} className="font-medium text-sm text-gray-500 dark:text-gray-400">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((dayInfo, index) => {
          if (!dayInfo) {
            return <div key={`empty-${index}`} className="h-10"></div>; // Empty cell, give it some height
          }

          // Remove logic related to isAvailable and isPast affecting link generation
          // const isAvailable = availableDates.has(dayInfo.dateString);
          // const isPast = new Date(dayInfo.dateString) < new Date(getTodayDateString());

          return (
            <div
              key={dayInfo.dateString}
              // Apply consistent styling, maybe highlight today slightly?
              className={`p-2 border border-gray-200 dark:border-gray-700 rounded text-center text-sm bg-white dark:bg-gray-700`}
            >
              {/* Always render the Link */}
              <Link
                href={`/challenge/${dayInfo.dateString}`}
                className="block w-full h-full font-semibold text-blue-700 dark:text-blue-300 hover:underline"
              >
                {dayInfo.dayOfMonth}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper function (remove if not used elsewhere)
// function getTodayDateString(): string { ... }

    