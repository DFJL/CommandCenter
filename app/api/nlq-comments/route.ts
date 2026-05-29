import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const SYSTEM_PROMPT = `You are a clinical trial programming QC assistant analyzing programming tracker comments and issues.

Use tools proactively:
- filter_comments → when user wants to see/filter/show specific comments (by deliverable type, status, or issue type)

Rules:
- Always prefer the filter tool over plain text when the request is about showing or narrowing data.
- Keep text response to 1-2 sentences — the filtered result speaks for itself.
- Never ask for clarification on clear requests — just act.
- Be specific with numbers from the context.`;

type CommentRow = {
  id: string;
  deliverable_type: string;
  dataset: string;
  issue: string;
  issue_type: string;
  status: string;
};

type FilterInput = {
  deliverable_type?: string;
  status?: string;
  issue_type?: string;
  search?: string;
};

const tools: Anthropic.Tool[] = [
  {
    name: 'filter_comments',
    description: 'Filter programming tracker comments to show specific entries. Use when user wants to see/filter by type, status, or issue category.',
    input_schema: {
      type: 'object' as const,
      properties: {
        deliverable_type: {
          type: 'string',
          enum: ['All', 'SDTM', 'Analysis Datasets', 'Tables', 'Figures', 'Listings'],
          description: 'Filter by deliverable type',
        },
        status: {
          type: 'string',
          enum: ['All', 'Open', 'Closed'],
          description: 'Filter by resolution status',
        },
        issue_type: {
          type: 'string',
          enum: ['All', 'Calculations/Logic', 'Mock Shell / Spec Update', 'Mock Shell Inconsistency', 'New Programming Request', 'Data Issue', 'Coding Incorrect or Inefficient', 'Cosmetic Update', 'Log'],
          description: 'Filter by issue type',
        },
        search: {
          type: 'string',
          description: 'Free-text search across dataset names and issue descriptions',
        },
      },
    },
  },
];

export async function POST(req: NextRequest) {
  const { query, context, history = [], comments = [] } =
    await req.json() as {
      query: string;
      context: string;
      history: { role: string; content: string }[];
      comments: CommentRow[];
    };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ response: `Searching comments for: "${query}"`, action: null });
  }

  const ai = new Anthropic({ apiKey });
  const contextNote = `Programming tracker comments:\n${context}`;

  const messages: Anthropic.MessageParam[] = [];
  if (history.length > 0) {
    messages.push({ role: 'user', content: `${contextNote}\n\n${history[0].content}` });
    for (let i = 1; i < history.length; i++) {
      messages.push({ role: history[i].role as 'user' | 'assistant', content: history[i].content });
    }
    messages.push({ role: 'user', content: query });
  } else {
    messages.push({ role: 'user', content: `${contextNote}\n\n${query}` });
  }

  const resp = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    tools,
    messages,
  });

  if (resp.stop_reason === 'tool_use') {
    const tu = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!tu) return Response.json({ response: 'Tool call failed.', action: null });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = tu.input as any;
    let action: { type: 'filter_comments' } & FilterInput | null = null;
    let toolResult: string;

    if (tu.name === 'filter_comments') {
      action = { type: 'filter_comments', ...(input as FilterInput) };
      const filtered = comments.filter((c) => {
        if (input.deliverable_type && input.deliverable_type !== 'All' && c.deliverable_type !== input.deliverable_type) return false;
        if (input.status && input.status !== 'All' && c.status !== input.status) return false;
        if (input.issue_type && input.issue_type !== 'All' && c.issue_type !== input.issue_type) return false;
        if (input.search) {
          const q = input.search.toLowerCase();
          if (!c.issue.toLowerCase().includes(q) && !c.dataset.toLowerCase().includes(q)) return false;
        }
        return true;
      });
      toolResult = `Filter applied — ${filtered.length} comments match: type=${input.deliverable_type ?? 'All'}, status=${input.status ?? 'All'}, issue_type=${input.issue_type ?? 'All'}, search="${input.search ?? ''}"`;
    } else {
      toolResult = 'Done.';
    }

    const followUp = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      tools,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [...messages, { role: 'assistant', content: resp.content as any }, {
        role: 'user',
        content: [{ type: 'tool_result' as const, tool_use_id: tu.id, content: toolResult }],
      }],
    });

    const txt = followUp.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    return Response.json({ response: txt?.text ?? 'Done.', action });
  }

  const txt = resp.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  return Response.json({ response: txt?.text ?? 'No response.', action: null });
}
