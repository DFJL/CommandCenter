import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const SYSTEM_PROMPT = `You are a clinical trial portfolio assistant for Fortrea Biometrics with tool capabilities.

Use tools proactively:
- filter_app  → when user wants to see/filter/show specific studies in the main table
- show_chart  → when user wants to compare, visualize, or chart a metric
- show_table  → when user wants a ranked list or focused table of studies

Rules:
- Always prefer a tool over a plain text list when the request is visual or comparative.
- Keep the text response to 1-2 sentences (the tool output speaks for itself).
- Never ask for clarification on straightforward requests — just act.
- Be specific with numbers from the context.`;

interface StudyRow {
  study: string; client: string; ta: string; fso_fsp: string;
  risk_tier: string; prod_pct: number; qc_pct: number;
  failed_qc: number; sig_delays: number;
  weeks_to_dbl: number | null; delayed: boolean; at_risk: boolean;
}

type FilterInput = { risk_tier?: string; fso_fsp?: string; client?: string; search?: string };
type ChartInput  = { title: string; metric: string; group_by: string; filter_risk?: string };
type TableInput  = { title: string; risk_tier?: string; fso_fsp?: string; client?: string; sort_by?: string; sort_order?: string; limit?: number };

const METRIC_LABEL: Record<string, string> = {
  prod_pct: 'Avg Production %', qc_pct: 'Avg QC %',
  failed_qc: 'Avg QC Failures', sig_delays: 'Avg Sig. Delays',
};

const tools: Anthropic.Tool[] = [
  {
    name: 'filter_app',
    description: 'Filter the portfolio table to show studies matching the criteria. Use when user wants to see/show/filter specific studies.',
    input_schema: {
      type: 'object' as const,
      properties: {
        risk_tier: { type: 'string', enum: ['All','Critical','High','Elevated','Moderate','Low'], description: 'Filter by risk tier' },
        fso_fsp:   { type: 'string', enum: ['All','FSO','FSP'], description: 'Filter by service type' },
        client:    { type: 'string', description: 'Client name (partial match)' },
        search:    { type: 'string', description: 'Free-text search across study names' },
      },
    },
  },
  {
    name: 'show_chart',
    description: 'Create a bar chart comparing a metric across a grouping. Use for compare/visualize/chart requests.',
    input_schema: {
      type: 'object' as const,
      required: ['title','metric','group_by'],
      properties: {
        title:       { type: 'string' },
        metric:      { type: 'string', enum: ['prod_pct','qc_pct','failed_qc','sig_delays'], description: 'Metric to compare' },
        group_by:    { type: 'string', enum: ['client','risk_tier','fso_fsp','ta'], description: 'Group dimension' },
        filter_risk: { type: 'string', description: 'Optional: only include studies of this risk tier' },
      },
    },
  },
  {
    name: 'show_table',
    description: 'Show a focused, sortable table of studies. Use when listing, ranking, or spotlighting a subset.',
    input_schema: {
      type: 'object' as const,
      required: ['title'],
      properties: {
        title:      { type: 'string' },
        risk_tier:  { type: 'string', enum: ['Critical','High','Elevated','Moderate','Low','All'] },
        fso_fsp:    { type: 'string', enum: ['FSO','FSP','All'] },
        client:     { type: 'string' },
        sort_by:    { type: 'string', enum: ['prod_pct','qc_pct','sig_delays','weeks_to_dbl','failed_qc'] },
        sort_order: { type: 'string', enum: ['asc','desc'] },
        limit:      { type: 'number', description: 'Max rows to show' },
      },
    },
  },
];

function execFilter(input: FilterInput) {
  return { type: 'filter' as const, ...input };
}

function execChart(input: ChartInput, studies: StudyRow[]) {
  let rows = studies;
  if (input.filter_risk) rows = rows.filter(r => r.risk_tier === input.filter_risk);
  const groups: Record<string, StudyRow[]> = {};
  for (const r of rows) {
    const k = String(r[input.group_by as keyof StudyRow] ?? '');
    (groups[k] = groups[k] || []).push(r);
  }
  const data = Object.entries(groups)
    .map(([name, grp]) => ({
      name,
      value: +(grp.reduce((s, r) => s + Number(r[input.metric as keyof StudyRow] ?? 0), 0) / grp.length).toFixed(1),
    }))
    .sort((a, b) => b.value - a.value);
  return { type: 'chart' as const, title: input.title, metric: input.metric, metricLabel: METRIC_LABEL[input.metric] ?? input.metric, data };
}

function execTable(input: TableInput, studies: StudyRow[]) {
  let rows = [...studies];
  if (input.risk_tier && input.risk_tier !== 'All') rows = rows.filter(r => r.risk_tier === input.risk_tier);
  if (input.fso_fsp   && input.fso_fsp   !== 'All') rows = rows.filter(r => r.fso_fsp   === input.fso_fsp);
  if (input.client) rows = rows.filter(r => r.client.toLowerCase().includes(input.client!.toLowerCase()));
  if (input.sort_by) {
    const sb = input.sort_by as keyof StudyRow;
    const dir = input.sort_order === 'asc' ? 1 : -1;
    rows.sort((a, b) => dir * (Number(a[sb] ?? 0) - Number(b[sb] ?? 0)));
  }
  if (input.limit) rows = rows.slice(0, input.limit);
  return {
    type: 'table' as const,
    title: input.title,
    columns: ['Study','Client','Risk','Type','Prod %','QC %','Wks DBL','Sig.Del'],
    rows: rows.map(r => [
      r.study, r.client, r.risk_tier, r.fso_fsp,
      `${r.prod_pct}%`, `${r.qc_pct}%`,
      r.weeks_to_dbl != null ? r.weeks_to_dbl.toFixed(1) : 'N/A',
      String(r.sig_delays),
    ]),
  };
}

export async function POST(req: NextRequest) {
  const { query, context, history = [], studies = [] } =
    await req.json() as { query: string; context: string; history: { role: string; content: string }[]; studies: StudyRow[] };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ response: patternMatch(query, context), action: null });
  }

  const ai = new Anthropic({ apiKey });
  const contextNote = `Portfolio snapshot:\n${context}`;

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
    let action: ReturnType<typeof execFilter> | ReturnType<typeof execChart> | ReturnType<typeof execTable> | null = null;
    let toolResult: string;

    if (tu.name === 'filter_app') {
      action = execFilter(input as FilterInput);
      toolResult = `Filter applied: risk=${input.risk_tier ?? 'All'}, type=${input.fso_fsp ?? 'All'}, client=${input.client ?? 'All'}, search="${input.search ?? ''}"`;
    } else if (tu.name === 'show_chart') {
      action = execChart(input as ChartInput, studies);
      toolResult = `Chart "${action.title}" created — ${(action as ReturnType<typeof execChart>).data.length} data points`;
    } else if (tu.name === 'show_table') {
      action = execTable(input as TableInput, studies);
      toolResult = `Table "${action.title}" — ${(action as ReturnType<typeof execTable>).rows.length} studies`;
    } else {
      toolResult = 'Tool executed.';
    }

    // Second turn: get natural language commentary
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

function patternMatch(query: string, _context: string): string {
  const q = query.toLowerCase();
  if (/high.risk|critical/.test(q)) return 'Showing Critical and High risk studies.';
  if (/delayed|overdue/.test(q)) return 'Showing delayed studies.';
  if (/qc.below|qc under/.test(q)) { const m = q.match(/\d+/); return `Showing studies with QC below ${m?.[0] ?? 70}%.`; }
  if (/4 week|dbl/.test(q)) return 'Showing studies within 4 weeks of DBL.';
  return `Searching for: "${query}"`;
}
