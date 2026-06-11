import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const SYSTEM_PROMPT = `You are a clinical trial portfolio assistant. You have three distinct tools — choose carefully:

TOOL SELECTION RULES (follow exactly):
1. filter_app   → ONLY when user says "filter", "hide", "show only", or asks to narrow the visible rows by a category (risk tier, client, FSO/FSP). Does NOT produce charts or data tables.
2. show_chart   → whenever user asks to "compare", "chart", "graph", "visualize", "plot", "by client/TA/type", or wants to see a metric across groups.
3. show_table   → whenever user asks to "list", "rank", "top N", "worst", "best", "give me a table", or wants data rows with multiple columns.

EXAMPLES:
- "show high-risk studies"           → filter_app (risk_tier: High)
- "show only FSP studies"            → filter_app (fso_fsp: FSP)
- "compare QC % by client"           → show_chart (metric: qc_pct, group_by: client)
- "which TA has the most delays?"    → show_chart (metric: sig_delays, group_by: ta)
- "list the 5 worst studies by QC"   → show_table (sort_by: qc_pct, sort_order: asc, limit: 5)
- "top 10 studies by production"     → show_table (sort_by: prod_pct, sort_order: desc, limit: 10)
- "chart production % by risk tier"  → show_chart (metric: prod_pct, group_by: risk_tier)

Rules:
- Always use a tool. Never reply with a plain text list when a tool applies.
- Keep prose to 1-2 sentences — the tool output speaks for itself.
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
    description: 'Apply row filters to the main portfolio table (narrows which rows are visible). Use ONLY for filter/show-only/hide requests by category. Do NOT use for charts, rankings, or data tables.',
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
    description: 'Render an inline bar chart comparing a metric (prod_pct, qc_pct, sig_delays, failed_qc) grouped by a dimension. Use for compare/visualize/chart/graph/plot/by-client/by-TA requests.',
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
    description: 'Render an inline data table of studies with multiple columns. Use for list/rank/top-N/worst/best/give-me-a-table requests.',
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
    const { text, action } = patternFallback(query, studies);
    return Response.json({ response: text, action });
  }

  try {
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
  } catch (err) {
    console.error('[nlq] error:', err);
    const { text, action } = patternFallback(query, studies);
    return Response.json({ response: text, action });
  }
}

function detectMetric(q: string): string {
  if (/qc.fail|failed.qc/.test(q)) return 'failed_qc';
  if (/sig.delay|significant.delay/.test(q)) return 'sig_delays';
  if (/qc/.test(q)) return 'qc_pct';
  if (/prod|production|complete/.test(q)) return 'prod_pct';
  if (/delay/.test(q)) return 'sig_delays';
  return 'qc_pct';
}

function detectGroupBy(q: string): string {
  if (/\bta\b|therapeutic|area/.test(q)) return 'ta';
  if (/risk/.test(q)) return 'risk_tier';
  if (/type|fso|fsp/.test(q)) return 'fso_fsp';
  return 'client';
}

function patternFallback(query: string, studies: StudyRow[]): { text: string; action: ReturnType<typeof execFilter> | ReturnType<typeof execChart> | ReturnType<typeof execTable> | null } {
  const q = query.toLowerCase();

  // Chart intent: compare, chart, visualize, by X, which X has...
  if (/compare|chart|graph|visuali[sz]e|plot|by (client|sponsor|ta|type|risk)|which (client|ta|type|risk)/.test(q)) {
    const metric = detectMetric(q);
    const group_by = detectGroupBy(q);
    const metricLabel = METRIC_LABEL[metric] ?? metric;
    const title = `${metricLabel} by ${group_by === 'risk_tier' ? 'Risk Tier' : group_by === 'fso_fsp' ? 'Type' : group_by === 'ta' ? 'Therapeutic Area' : 'Client'}`;
    const action = execChart({ title, metric, group_by }, studies);
    return { text: `Here's ${title.toLowerCase()} across your portfolio.`, action };
  }

  // Table intent: list, rank, top N, worst, best, give me a table
  if (/\blist\b|rank|top \d|worst|best|table|bottom \d/.test(q)) {
    const metric = detectMetric(q);
    const isAsc = /worst|lowest|bottom|least/.test(q);
    const limitMatch = q.match(/top (\d+)|bottom (\d+)/);
    const limit = limitMatch ? parseInt(limitMatch[1] ?? limitMatch[2]) : 10;
    const title = `${isAsc ? 'Bottom' : 'Top'} ${limit} studies by ${METRIC_LABEL[metric] ?? metric}`;
    const action = execTable({ title, sort_by: metric, sort_order: isAsc ? 'asc' : 'desc', limit }, studies);
    return { text: `${title} across your portfolio.`, action };
  }

  // Filter intent
  if (/critical/.test(q)) return { text: 'Showing Critical risk studies.', action: execFilter({ risk_tier: 'Critical' }) };
  if (/high.risk|high risk/.test(q)) return { text: 'Showing High risk studies.', action: execFilter({ risk_tier: 'High' }) };
  if (/elevated/.test(q)) return { text: 'Showing Elevated risk studies.', action: execFilter({ risk_tier: 'Elevated' }) };
  if (/delayed|overdue/.test(q)) return { text: 'Showing delayed studies.', action: execFilter({ search: 'delayed' }) };
  if (/\bfsp\b/.test(q)) return { text: 'Showing FSP studies.', action: execFilter({ fso_fsp: 'FSP' }) };
  if (/\bfso\b/.test(q)) return { text: 'Showing FSO studies.', action: execFilter({ fso_fsp: 'FSO' }) };
  if (/4 week|dbl/.test(q)) return { text: 'Showing studies within 4 weeks of DBL.', action: execFilter({ search: '4 weeks' }) };

  const m = q.match(/qc.{0,10}below (\d+)/);
  if (m) return { text: `Showing studies with QC below ${m[1]}%.`, action: execFilter({ risk_tier: 'All' }) };

  return { text: `Searching for: "${query}"`, action: null };
}
