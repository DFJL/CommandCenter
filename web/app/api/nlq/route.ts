import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { query, context } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ response: patternMatch(query, context) });
  }

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `You are a clinical trial portfolio assistant for Fortrea Biometrics.
Portfolio summary: ${context}
User query: "${query}"
Respond in 1-2 sentences describing what you found. Be specific with numbers.`,
      },
    ],
  });

  return Response.json({ response: (message.content[0] as { text: string }).text });
}

function patternMatch(query: string, _context: string): string {
  const q = query.toLowerCase();
  if (/high.risk|critical/.test(q))
    return 'Showing Critical and High risk studies that need immediate attention.';
  if (/delayed|overdue|behind/.test(q))
    return 'Showing studies that have passed their Database Lock date.';
  if (/qc.below|qc under/.test(q)) {
    const m = q.match(/\d+/);
    return `Showing studies with QC completion below ${m?.[0] ?? 70}%.`;
  }
  if (/4 week|dbl/.test(q))
    return 'Showing studies within 4 weeks of their Database Lock date.';
  return `Searching portfolio for: "${query}"`;
}
