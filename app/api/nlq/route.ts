import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const SYSTEM_PROMPT = `You are a clinical trial portfolio assistant for Fortrea Biometrics.
You help analyze study portfolios, identify risks, and answer questions about clinical data delivery status.
When listing clients or studies, be concise — provide the list directly without asking clarifying questions.
When asked to list something you can derive from context, do it. When you need data not provided, say so briefly.
Keep responses under 3 sentences unless a list is requested. Be specific with numbers when available.`;

export async function POST(req: NextRequest) {
  const { query, context, history } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ response: patternMatch(query, context) });
  }

  const client = new Anthropic({ apiKey });

  // Build message thread: inject context into first user message
  const contextNote = `Portfolio snapshot: ${context}`;
  const messages: Anthropic.MessageParam[] = [];

  if (history && history.length > 0) {
    // Prepend context to the first user message
    const firstUser = history[0];
    messages.push({ role: 'user', content: `${contextNote}\n\n${firstUser.content}` });
    for (let i = 1; i < history.length; i++) {
      messages.push({ role: history[i].role, content: history[i].content });
    }
  }

  // Append the current query
  if (messages.length === 0) {
    messages.push({ role: 'user', content: `${contextNote}\n\n${query}` });
  } else {
    messages.push({ role: 'user', content: query });
  }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages,
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
  if (/client|sponsor/.test(q))
    return 'Set ANTHROPIC_API_KEY to enable AI-powered client listing.';
  return `Searching portfolio for: "${query}"`;
}
