// components/QuestionDisplay.tsx
'use client'

import { useEffect, useState } from 'react';
import { getDailyQuestion } from '@/lib/questionService';

export default function QuestionDisplay() {
  const [question, setQuestion] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuestion() {
      try {
        setLoading(true);
        const q = await getDailyQuestion();
        setQuestion(q);
      } catch (error) {
        console.error('Failed to load question:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadQuestion();
  }, []);

  if (loading) return <div className="text-white">Loading today's question...</div>;
  if (!question) return <div className="text-white">Failed to load question</div>;

  return (
    <div className="bg-gray-800 p-6 rounded-lg text-white">
      <h2 className="text-xl font-bold mb-4">Today's Python Challenge</h2>
      <div className="mb-4">
        <p className="whitespace-pre-line">{question.question}</p>
      </div>
      <div className="mb-4 bg-gray-700 p-3 rounded">
  <h3 className="font-semibold mb-2">Example:</h3>
  <pre className="whitespace-pre-wrap">
    Input: {question.example.input}
    <br />
    Output: {question.example.output}
  </pre>
</div>
      <details className="mb-4">
        <summary className="cursor-pointer font-semibold">Solution</summary>
        <div className="mt-2 bg-gray-700 p-3 rounded">
          <pre className="whitespace-pre-wrap">{question.solution}</pre>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold">Explanation</summary>
        <div className="mt-2 bg-gray-700 p-3 rounded">
          <p className="whitespace-pre-line">{question.explanation}</p>
        </div>
      </details>
    </div>
  );
}