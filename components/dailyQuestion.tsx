import React, { useEffect, useState } from 'react';

const DailyQuestion: React.FC = () => {
  const [question, setQuestion] = useState<string>('');

  useEffect(() => {
    fetch('/api/daily-question')
      .then((res) => res.json())
      .then((data) => setQuestion(data.question))
      .catch((err) => console.error('Error fetching question:', err));
  }, []);

  return (
    <div className="p-4 border rounded mb-4 w-full max-w-[600px]">
      <h2 className="text-xl font-bold mb-2">Today's Python Challenge</h2>
      <p>{question || 'Loading question...'}</p>
    </div>
  );
};

export default DailyQuestion;