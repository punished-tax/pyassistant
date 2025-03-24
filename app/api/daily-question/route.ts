import { NextResponse } from 'next/server';

export async function GET() {
  const openaiResponse = await fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      prompt: 'Generate a medium difficulty Python coding question.',
      max_tokens: 150,
      temperature: 0.7,
    }),
  });

  if (!openaiResponse.ok) {
    return NextResponse.json({ error: 'Failed to fetch question' }, { status: openaiResponse.status });
  }

  const data = await openaiResponse.json();
  const question = data.choices[0].text.trim();

  return NextResponse.json({ question }, {
    // Cache for one day on the edge (using ISR or edge caching)
    headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate' },
  });
}