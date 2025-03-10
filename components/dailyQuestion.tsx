import { useEffect, useState } from 'react';

interface QuestionData {
  choices?: string[];
  explanation?: string;
  // ...other fields based on ChatGPT's response structure
}

export default function DailyQuestion() {
  const [question, setQuestion] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuestion() {
      try {
        const res = await fetch('/api/getPythonQuestion');
        const data = await res.json();
        // Parse and extract question from the API response:
        const content = data.choices?.[0]?.message?.content || "No question available.";
        setQuestion(content);
      } catch (err) {
        setError("Failed to load question.");
      } finally {
        setLoading(false);
      }
    }
    fetchQuestion();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>Daily Python Question</h1>
      <p>{question}</p>
    </div>
  );
}