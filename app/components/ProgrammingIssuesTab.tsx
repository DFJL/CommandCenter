'use client';

import { useState, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import type { P21Finding } from '../types';
import commentsRaw from '../../public/data/comments.json';

type Comment = {
  id: string; deliverable_type: string; data_type: string; dataset: string;
  issue: string; issue_type: string; reported_by: string; report_date: string | null;
  responsible_party: string; status: string; resolved_by: string;
  resolve_date: string | null; comments: string; resolution: string;
};

const COMMENTS = commentsRaw as Comment[];

const DONUT_COLORS = ['#2ea55e', '#3b82f6', '#f97316', '#eab308', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

const ISSUE_TYPE_COLOR: Record<string, string> = {
  'Calculations/Logic':               '#f97316',
  'Mock Shell / Spec Update':         '#3b82f6',
  'Mock Shell Inconsistency':         '#8b5cf6',
  'New Programming Request':          '#2ea55e',
  'Data Issue':                       '#ef4444',
  'Coding Incorrect or Inefficient':  '#ec4899',
  'Cosmetic Update':                  '#6b7280',
  'Log':                              '#eab308',
};

const DEL_TYPE_COLOR: Record<string, string> = {
  'SDTM':             '#2ea55e',
  'Analysis Datasets':'#3b82f6',
  'Tables':           '#f97316',
  'Figures':          '#8b5cf6',
  'Listings':         '#06b6d4',
};

type Mode = 'p21' | 'comments';

const getP21Client = (studyId: string) => studyId.split('-')[0];

const TT = {
  contentStyle: { background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 },
  labelStyle: { color: '#e8eaf0' }, itemStyle: { color: '#8892a4' },
};

function KpiCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-lg p-4 text-center" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: '#8892a4' }}>{label}</div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3" style={{ background: '#1a5c38', borderRadius: '0.5rem 0.5rem 0 0' }}>
      <p className="text-sm font-bold text-white">{children}</p>
    </div>
  );
}

function ThStyle({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2 whitespace-nowrap"
      style={{ color: '#8892a4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </th>
  );
}

export default function ProgrammingIssuesTab({ findings }: { findings: P21Finding[] }) {
  const [mode, setMode] = useState<Mode>('p21');

  // ── P21 navigation ─────────────────────────────────────────
  const [p21Level, setP21Level] = useState<0 | 1 | 2>(0);
  const [p21SelClient, setP21SelClient] = useState('');
  const [p21SelStudy, setP21SelStudy] = useState('');
  const [p21Search, setP21Search] = useState('');

  const goP21 = (l: 0 | 1 | 2, client = '', study = '') => {
    setP21Level(l); setP21SelClient(client); setP21SelStudy(study);
    if (l < 2) setP21Search('');
  };

  // ── Comments navigation ────────────────────────────────────
  const [comLevel, setComLevel] = useState<0 | 1 | 2>(0);
  const [comSelDel, setComSelDel] = useState('');
  const [comSelDataset, setComSelDataset] = useState('');

  const goCom = (l: 0 | 1 | 2, del = '', dataset = '') => {
    setComLevel(l); setComSelDel(del); setComSelDataset(dataset);
  };

  // ── P21 aggregations ────────────────────────────────────────
  type P21Client = { client: string; total: number; studyCount: number; errors: number; warnings: number };
  type P21Study  = { study: string;  total: number;              errors: number; warnings: number };

  const p21Clients = useMemo<P21Client[]>(() => {
    const map: Record<string, { total: number; studies: Set<string>; errors: number; warnings: number }> = {};
    for (const f of findings) {
      const c = getP21Client(f.study_id);
      if (!map[c]) map[c] = { total: 0, studies: new Set(), errors: 0, warnings: 0 };
      map[c].total++;
      map[c].studies.add(f.study_id);
      if (f.severity === 'Error') map[c].errors++; else map[c].warnings++;
    }
    return Object.entries(map)
      .map(([client, d]) => ({ client, total: d.total, studyCount: d.studies.size, errors: d.errors, warnings: d.warnings }))
      .sort((a, b) => b.total - a.total);
  }, [findings]);

  const p21Studies = useMemo<P21Study[]>(() => {
    const src = findings.filter((f) => getP21Client(f.study_id) === p21SelClient);
    const map: Record<string, P21Study> = {};
    for (const f of src) {
      if (!map[f.study_id]) map[f.study_id] = { study: f.study_id, total: 0, errors: 0, warnings: 0 };
      map[f.study_id].total++;
      if (f.severity === 'Error') map[f.study_id].errors++; else map[f.study_id].warnings++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [findings, p21SelClient]);

  const p21RawFindings = useMemo(() => {
    const rows = findings.filter((f) => f.study_id === p21SelStudy);
    if (!p21Search.trim()) return rows;
    const q = p21Search.toLowerCase();
    return rows.filter((f) =>
      f.rule_id.toLowerCase().includes(q) || f.dataset.toLowerCase().includes(q) ||
      f.message.toLowerCase().includes(q) || f.ai_category.toLowerCase().includes(q)
    );
  }, [findings, p21SelStudy, p21Search]);

  const p21ClientKpis = useMemo(() => ({
    total: p21Studies.reduce((s, r) => s + r.total, 0),
    errors: p21Studies.reduce((s, r) => s + r.errors, 0),
    warnings: p21Studies.reduce((s, r) => s + r.warnings, 0),
  }), [p21Studies]);

  // ── Comments aggregations ──────────────────────────────────
  type ComDel = { del: string; total: number; open: number; closed: number; datasetCount: number };
  type ComDataset = { dataset: string; total: number; open: number; closed: number; typeCount: number };

  const comDelRows = useMemo<ComDel[]>(() => {
    const map: Record<string, { total: number; open: number; closed: number; datasets: Set<string> }> = {};
    for (const c of COMMENTS) {
      const d = c.deliverable_type;
      if (!map[d]) map[d] = { total: 0, open: 0, closed: 0, datasets: new Set() };
      map[d].total++;
      map[d].datasets.add(c.dataset);
      if (c.status === 'Open') map[d].open++; else map[d].closed++;
    }
    return Object.entries(map)
      .map(([del, d]) => ({ del, total: d.total, open: d.open, closed: d.closed, datasetCount: d.datasets.size }))
      .sort((a, b) => b.total - a.total);
  }, []);

  const comDatasetRowsFixed = useMemo<ComDataset[]>(() => {
    const src = COMMENTS.filter((c) => c.deliverable_type === comSelDel);
    const map: Record<string, { total: number; open: number; closed: number; types: Set<string> }> = {};
    for (const c of src) {
      if (!map[c.dataset]) map[c.dataset] = { total: 0, open: 0, closed: 0, types: new Set() };
      map[c.dataset].total++;
      map[c.dataset].types.add(c.issue_type);
      if (c.status === 'Open') map[c.dataset].open++; else map[c.dataset].closed++;
    }
    return Object.entries(map)
      .map(([dataset, d]) => ({ dataset, total: d.total, open: d.open, closed: d.closed, typeCount: d.types.size }))
      .sort((a, b) => b.total - a.total);
  }, [comSelDel]);

  const comRawComments = useMemo(() =>
    COMMENTS.filter((c) => c.deliverable_type === comSelDel && c.dataset === comSelDataset),
    [comSelDel, comSelDataset]
  );

  const comOpenTotal  = useMemo(() => COMMENTS.filter((c) => c.status === 'Open').length, []);
  const comClosedTotal = useMemo(() => COMMENTS.filter((c) => c.status === 'Closed').length, []);

  const comDelKpis = useMemo(() => {
    const sel = comDelRows.find((r) => r.del === comSelDel);
    return { total: sel?.total ?? 0, open: sel?.open ?? 0, closed: sel?.closed ?? 0, datasets: comDatasetRowsFixed.length };
  }, [comDelRows, comSelDel, comDatasetRowsFixed]);

  // ── Comments NLP chat ──────────────────────────────────────
  type ChatMsg = { role: 'user' | 'assistant'; content: string };
  const [comChat, setComChat] = useState<ChatMsg[]>([]);
  const [comChatInput, setComChatInput] = useState('');
  const [comChatLoading, setComChatLoading] = useState(false);

  const comIssueTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of COMMENTS) map[c.issue_type] = (map[c.issue_type] ?? 0) + 1;
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, []);

  const handleCommentNlq = useCallback(async (q?: string) => {
    const query = q ?? comChatInput;
    if (!query.trim()) return;
    const userMsg: ChatMsg = { role: 'user', content: query };
    const updatedHistory = [...comChat, userMsg];
    setComChat(updatedHistory);
    setComChatInput('');
    setComChatLoading(true);
    try {
      const byType = comIssueTypeData.slice(0, 6).map((d) => `${d.name}: ${d.value}`).join(', ');
      const byDel = comDelRows.map((d) => `${d.del}: ${d.total}`).join(', ');
      const context = `Total: ${COMMENTS.length} comments. Open: ${comOpenTotal}, Closed: ${comClosedTotal}.\nBy deliverable: ${byDel}.\nBy issue type: ${byType}.`;
      const commentsPayload = COMMENTS.slice(0, 300).map((c) => ({
        id: c.id, deliverable_type: c.deliverable_type, dataset: c.dataset,
        issue: c.issue.slice(0, 120), issue_type: c.issue_type, status: c.status,
      }));
      const res = await fetch('/api/nlq-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context, history: comChat, comments: commentsPayload }),
      });
      const data = await res.json();
      const action = data.action;
      if (action?.type === 'filter_comments' && action.deliverable_type && action.deliverable_type !== 'All') {
        goCom(1, action.deliverable_type);
      }
      setComChat([...updatedHistory, { role: 'assistant', content: data.response }]);
    } catch {
      setComChat([...updatedHistory, { role: 'assistant', content: 'Unable to process query.' }]);
    } finally {
      setComChatLoading(false);
    }
  }, [comChatInput, comChat, comOpenTotal, comClosedTotal, comIssueTypeData, comDelRows]);

  const COM_CHIPS = ['Open issues only', 'SDTM issues', 'Calculation errors', 'Mock Shell updates'];
  const inputStyle = { background: '#1c2230', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' } as const;

  return (
    <div className="p-5 space-y-4">

      {/* Mode toggle */}
      <div className="flex items-center gap-0 rounded-lg overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
        {([['p21', 'CDISC Validation Findings', findings.length], ['comments', 'Programming Comments', COMMENTS.length]] as const).map(([m, label, count]) => (
          <button key={m} onClick={() => setMode(m)}
            className="px-5 py-2 text-sm font-medium transition-colors"
            style={mode === m ? { background: '#2ea55e', color: '#fff' } : { background: 'transparent', color: '#8892a4' }}>
            {label}
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: mode === m ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)', color: mode === m ? '#fff' : '#6b7280' }}>{count}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
          P21 — CDISC VALIDATION FINDINGS
      ═══════════════════════════════════════════════════════ */}
      {mode === 'p21' && (
        <>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm font-medium">
            <button onClick={() => goP21(0)} style={{ color: p21Level === 0 ? '#2ea55e' : '#8892a4' }}>QC Findings</button>
            {p21Level >= 1 && (
              <>
                <span style={{ color: '#374151' }}>›</span>
                <button onClick={() => goP21(1, p21SelClient)} style={{ color: p21Level === 1 ? '#2ea55e' : '#8892a4' }}>{p21SelClient}</button>
              </>
            )}
            {p21Level === 2 && (
              <>
                <span style={{ color: '#374151' }}>›</span>
                <span style={{ color: '#2ea55e' }}>{p21SelStudy}</span>
              </>
            )}
          </nav>

          {/* ── P21 Level 0: Clients ── */}
          {p21Level === 0 && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <KpiCard label="Total Findings"   value={findings.length}                                       color="#ef4444" />
                <KpiCard label="Clients"           value={p21Clients.length}                                    color="#8b5cf6" />
                <KpiCard label="Studies Affected"  value={new Set(findings.map((f) => f.study_id)).size}        color="#f97316" />
                <KpiCard label="Errors"            value={findings.filter((f) => f.severity === 'Error').length} color="#ef4444" />
              </div>

              <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: '#e8eaf0' }}>Findings by Client — Error / Warning</p>
                <ResponsiveContainer width="100%" height={p21Clients.length * 34 + 40}>
                  <BarChart layout="vertical" data={p21Clients} margin={{ top: 0, right: 60, left: 4, bottom: 0 }}>
                    <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="client" tick={{ fill: '#e8eaf0', fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
                    <Tooltip {...TT} />
                    <Bar dataKey="errors"   stackId="a" fill="#ef4444" name="Errors"   />
                    <Bar dataKey="warnings" stackId="a" fill="#f97316" name="Warnings" radius={[0, 3, 3, 0]}>
                      <LabelList dataKey="total" position="right" style={{ fill: '#8892a4', fontSize: 9 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-3 px-1">
                  {[['#ef4444', 'Errors'], ['#f97316', 'Warnings']].map(([color, label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                      <span className="text-xs" style={{ color: '#8892a4' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg overflow-hidden" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
                <SectionHeader>{p21Clients.length} Clients · Click to explore studies</SectionHeader>
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#1c2230' }}>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <ThStyle>Client</ThStyle><ThStyle>Studies</ThStyle><ThStyle>Total</ThStyle>
                      <ThStyle>Errors</ThStyle><ThStyle>Warnings</ThStyle><ThStyle> </ThStyle>
                    </tr>
                  </thead>
                  <tbody>
                    {p21Clients.map((row) => (
                      <tr key={row.client}
                        className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onClick={() => goP21(1, row.client)}>
                        <td className="px-4 py-2.5 font-semibold" style={{ color: '#e8eaf0' }}>{row.client}</td>
                        <td className="px-4 py-2.5 text-center" style={{ color: '#8892a4' }}>{row.studyCount}</td>
                        <td className="px-4 py-2.5 text-center font-bold" style={{ color: '#e8eaf0' }}>{row.total}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>{row.errors}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: '#f97316', background: 'rgba(249,115,22,0.1)' }}>{row.warnings}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#2ea55e' }}>→</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── P21 Level 1: Studies within client ── */}
          {p21Level === 1 && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <KpiCard label="Findings in Client" value={p21ClientKpis.total}    color="#ef4444" />
                <KpiCard label="Studies"             value={p21Studies.length}      color="#f97316" />
                <KpiCard label="Errors"              value={p21ClientKpis.errors}   color="#ef4444" />
                <KpiCard label="Warnings"            value={p21ClientKpis.warnings} color="#f97316" />
              </div>

              <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: '#e8eaf0' }}>Findings by Study — {p21SelClient}</p>
                <ResponsiveContainer width="100%" height={Math.max(p21Studies.length * 34 + 40, 100)}>
                  <BarChart layout="vertical" data={p21Studies} margin={{ top: 0, right: 60, left: 4, bottom: 0 }}>
                    <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="study" tick={{ fill: '#e8eaf0', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip {...TT} />
                    <Bar dataKey="errors"   stackId="a" fill="#ef4444" name="Errors" />
                    <Bar dataKey="warnings" stackId="a" fill="#f97316" name="Warnings" radius={[0, 3, 3, 0]}>
                      <LabelList dataKey="total" position="right" style={{ fill: '#8892a4', fontSize: 9 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg overflow-hidden" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
                <SectionHeader>{p21SelClient} — {p21Studies.length} Studies · Click to view findings</SectionHeader>
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#1c2230' }}>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <ThStyle>Study</ThStyle><ThStyle>Total</ThStyle><ThStyle>Errors</ThStyle><ThStyle>Warnings</ThStyle><ThStyle> </ThStyle>
                    </tr>
                  </thead>
                  <tbody>
                    {p21Studies.map((row) => (
                      <tr key={row.study}
                        className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onClick={() => goP21(2, p21SelClient, row.study)}>
                        <td className="px-4 py-2.5 font-semibold" style={{ color: '#e8eaf0' }}>{row.study}</td>
                        <td className="px-4 py-2.5 text-center font-bold" style={{ color: '#e8eaf0' }}>{row.total}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>{row.errors}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: '#f97316', background: 'rgba(249,115,22,0.1)' }}>{row.warnings}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#2ea55e' }}>→</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── P21 Level 2: Raw findings for study ── */}
          {p21Level === 2 && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <KpiCard label="Total Findings" value={p21RawFindings.length} color="#ef4444" />
                <KpiCard label="Errors"   value={p21RawFindings.filter((f) => f.severity === 'Error').length}   color="#ef4444" />
                <KpiCard label="Warnings" value={p21RawFindings.filter((f) => f.severity === 'Warning').length} color="#f97316" />
                <KpiCard label="Datasets" value={new Set(p21RawFindings.map((f) => f.dataset)).size}            color="#3b82f6" />
              </div>

              <div className="rounded-lg" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>
                    {p21SelStudy} — {p21RawFindings.length} Findings
                  </p>
                  <input type="text" value={p21Search} onChange={(e) => setP21Search(e.target.value)}
                    placeholder="Search rule, dataset, message…"
                    className="text-xs rounded px-3 py-1.5 border outline-none w-56" style={inputStyle} />
                </div>
                <div style={{ maxHeight: 480, overflowY: 'auto', overflowX: 'auto' }}>
                  <table className="w-full text-xs" style={{ minWidth: 860, borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        {['Severity', 'Rule ID', 'Dataset', 'Variable', 'Category', 'Message', 'Avg Hrs'].map((h) => (
                          <th key={h} className="text-left px-3 py-2 whitespace-nowrap"
                            style={{ color: '#8892a4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {p21RawFindings.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: '#8892a4' }}>No findings match.</td></tr>
                      ) : p21RawFindings.map((f) => (
                        <tr key={f.finding_id} className="hover:bg-white/[0.02] transition-colors"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${f.severity === 'Error' ? 'bg-red-900/30 text-red-400 border-red-700/40' : 'bg-orange-900/20 text-orange-400 border-orange-700/30'}`}>{f.severity}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs" style={{ color: '#8892a4' }}>{f.rule_id}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-medium text-xs" style={{ color: '#e8eaf0' }}>{f.dataset}</td>
                          <td className="px-3 py-2 text-xs" style={{ color: '#8892a4' }}>{f.variable}</td>
                          <td className="px-3 py-2 text-xs">
                            <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{f.ai_category}</span>
                          </td>
                          <td className="px-3 py-2 text-xs max-w-xs truncate" style={{ color: '#8892a4' }} title={f.message}>{f.message}</td>
                          <td className="px-3 py-2 text-xs" style={{ color: '#8892a4' }}>{f.avg_resolution_hrs}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          COMMENTS — PROGRAMMING TRACKER
      ═══════════════════════════════════════════════════════ */}
      {mode === 'comments' && (
        <>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm font-medium">
            <button onClick={() => goCom(0)} style={{ color: comLevel === 0 ? '#2ea55e' : '#8892a4' }}>Programming Comments</button>
            {comLevel >= 1 && (
              <>
                <span style={{ color: '#374151' }}>›</span>
                <button onClick={() => goCom(1, comSelDel)} style={{ color: comLevel === 1 ? '#2ea55e' : '#8892a4' }}>{comSelDel}</button>
              </>
            )}
            {comLevel === 2 && (
              <>
                <span style={{ color: '#374151' }}>›</span>
                <span style={{ color: '#2ea55e' }}>{comSelDataset}</span>
              </>
            )}
          </nav>

          {/* ── Comments Level 0: Deliverable Types overview ── */}
          {comLevel === 0 && (
            <>
              {/* AI Query */}
              <div className="rounded-lg" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8892a4' }}>AI Query</p>
                  {comChat.length > 0 && (
                    <button onClick={() => setComChat([])} className="text-xs px-2 py-0.5 rounded"
                      style={{ color: '#8892a4', background: 'rgba(255,255,255,0.05)' }}>Clear</button>
                  )}
                </div>
                {comChat.length > 0 && (
                  <div className="px-4 pb-2 space-y-2 max-h-48 overflow-y-auto">
                    {comChat.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className="text-xs px-3 py-2 rounded-lg max-w-[88%]"
                          style={msg.role === 'user'
                            ? { background: 'rgba(46,165,94,0.15)', color: '#e8eaf0', border: '1px solid rgba(46,165,94,0.25)' }
                            : { background: 'rgba(59,130,246,0.08)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {comChatLoading && (
                      <div className="flex justify-start">
                        <div className="text-xs px-3 py-2 rounded-lg flex items-center gap-2"
                          style={{ background: 'rgba(59,130,246,0.08)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}>
                          <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: '#3b82f6', borderTopColor: 'transparent' }} />
                          Analyzing…
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="px-4 pb-3">
                  <div className="flex gap-2 mb-2">
                    <input type="text" value={comChatInput} onChange={(e) => setComChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCommentNlq()}
                      placeholder={comChat.length > 0 ? 'Continue the conversation…' : 'Ask about these comments…'}
                      className="flex-1 text-sm rounded px-3 py-2 border outline-none" style={inputStyle} />
                    <button onClick={() => handleCommentNlq()} disabled={comChatLoading}
                      className="px-4 py-2 rounded text-sm font-medium"
                      style={{ background: '#2ea55e', color: '#fff', opacity: comChatLoading ? 0.6 : 1 }}>
                      {comChatLoading ? '…' : comChat.length > 0 ? 'Send' : 'Ask'}
                    </button>
                  </div>
                  {comChat.length === 0 && (
                    <div className="flex flex-wrap gap-2">
                      {COM_CHIPS.map((chip) => (
                        <button key={chip} onClick={() => handleCommentNlq(chip)}
                          className="text-xs px-3 py-1 rounded-full border"
                          style={{ borderColor: 'rgba(46,165,94,0.4)', color: '#2ea55e', background: 'rgba(46,165,94,0.08)' }}>{chip}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <KpiCard label="Total Comments" value={COMMENTS.length} color="#3b82f6" />
                <KpiCard label="Open"           value={comOpenTotal}    color="#f97316" />
                <KpiCard label="Closed"         value={comClosedTotal}  color="#2ea55e" />
                <KpiCard label="Del. Types"     value={comDelRows.length} color="#8b5cf6" />
              </div>

              <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: '#e8eaf0' }}>Comments by Deliverable Type — Open / Closed</p>
                <ResponsiveContainer width="100%" height={comDelRows.length * 40 + 40}>
                  <BarChart layout="vertical" data={comDelRows} margin={{ top: 0, right: 60, left: 4, bottom: 0 }}>
                    <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="del" tick={{ fill: '#e8eaf0', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip {...TT} />
                    <Bar dataKey="open"   stackId="a" fill="#f97316" name="Open"   />
                    <Bar dataKey="closed" stackId="a" fill="#2ea55e" name="Closed" radius={[0, 3, 3, 0]}>
                      <LabelList dataKey="total" position="right" style={{ fill: '#8892a4', fontSize: 9 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-3 px-1">
                  {[['#f97316', 'Open'], ['#2ea55e', 'Closed']].map(([color, label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                      <span className="text-xs" style={{ color: '#8892a4' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg overflow-hidden" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
                <SectionHeader>{comDelRows.length} Deliverable Types · Click to explore datasets</SectionHeader>
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#1c2230' }}>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <ThStyle>Type</ThStyle><ThStyle>Datasets</ThStyle><ThStyle>Total</ThStyle>
                      <ThStyle>Open</ThStyle><ThStyle>Closed</ThStyle><ThStyle> </ThStyle>
                    </tr>
                  </thead>
                  <tbody>
                    {comDelRows.map((row) => (
                      <tr key={row.del}
                        className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onClick={() => goCom(1, row.del)}>
                        <td className="px-4 py-2.5">
                          <span className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{ color: DEL_TYPE_COLOR[row.del] ?? '#8892a4', background: `${DEL_TYPE_COLOR[row.del] ?? '#6b7280'}18` }}>{row.del}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center" style={{ color: '#8892a4' }}>{row.datasetCount}</td>
                        <td className="px-4 py-2.5 text-center font-bold" style={{ color: '#e8eaf0' }}>{row.total}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: '#f97316', background: 'rgba(249,115,22,0.1)' }}>{row.open}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: '#2ea55e', background: 'rgba(46,165,94,0.1)' }}>{row.closed}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#2ea55e' }}>→</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Comments Level 1: Datasets within del type ── */}
          {comLevel === 1 && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <KpiCard label="Comments in Type" value={comDelKpis.total}    color="#3b82f6" />
                <KpiCard label="Datasets"          value={comDelKpis.datasets} color="#8b5cf6" />
                <KpiCard label="Open"              value={comDelKpis.open}     color="#f97316" />
                <KpiCard label="Closed"            value={comDelKpis.closed}   color="#2ea55e" />
              </div>

              <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: '#e8eaf0' }}>Comments by Dataset — {comSelDel} (top 20)</p>
                <ResponsiveContainer width="100%" height={Math.min(comDatasetRowsFixed.length, 20) * 28 + 40}>
                  <BarChart layout="vertical" data={comDatasetRowsFixed.slice(0, 20)} margin={{ top: 0, right: 60, left: 4, bottom: 0 }}>
                    <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="dataset" tick={{ fill: '#e8eaf0', fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip {...TT} />
                    <Bar dataKey="open"   stackId="a" fill="#f97316" name="Open" />
                    <Bar dataKey="closed" stackId="a" fill="#2ea55e" name="Closed" radius={[0, 3, 3, 0]}>
                      <LabelList dataKey="total" position="right" style={{ fill: '#8892a4', fontSize: 9 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg overflow-hidden" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
                <SectionHeader>{comSelDel} — {comDatasetRowsFixed.length} Datasets · Click to view comments</SectionHeader>
                <div style={{ maxHeight: 440, overflowY: 'auto' }}>
                  <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        <ThStyle>Dataset</ThStyle><ThStyle>Total</ThStyle>
                        <ThStyle>Open</ThStyle><ThStyle>Closed</ThStyle>
                        <ThStyle>Issue Types</ThStyle><ThStyle> </ThStyle>
                      </tr>
                    </thead>
                    <tbody>
                      {comDatasetRowsFixed.map((row) => (
                        <tr key={row.dataset}
                          className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          onClick={() => goCom(2, comSelDel, row.dataset)}>
                          <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: '#e8eaf0' }}>{row.dataset}</td>
                          <td className="px-4 py-2.5 text-center font-bold" style={{ color: '#e8eaf0' }}>{row.total}</td>
                          <td className="px-4 py-2.5 text-center">
                            {row.open > 0 && <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: '#f97316', background: 'rgba(249,115,22,0.1)' }}>{row.open}</span>}
                            {row.open === 0 && <span style={{ color: '#374151' }}>—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: '#2ea55e', background: 'rgba(46,165,94,0.1)' }}>{row.closed}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center" style={{ color: '#8892a4' }}>{row.typeCount}</td>
                          <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#2ea55e' }}>→</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── Comments Level 2: Raw comments for dataset ── */}
          {comLevel === 2 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Total Comments" value={comRawComments.length}                                    color="#3b82f6" />
                <KpiCard label="Open"  value={comRawComments.filter((c) => c.status === 'Open').length}          color="#f97316" />
                <KpiCard label="Closed" value={comRawComments.filter((c) => c.status === 'Closed').length}       color="#2ea55e" />
              </div>

              <div className="rounded-lg overflow-hidden" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
                <SectionHeader>{comSelDel} › {comSelDataset} — {comRawComments.length} Comments</SectionHeader>
                <div style={{ maxHeight: 520, overflowY: 'auto', overflowX: 'auto' }}>
                  <table className="w-full text-xs" style={{ minWidth: 860, borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        {['#', 'Issue Description', 'Issue Type', 'Reported By', 'Date', 'Status', 'Resolution'].map((h) => (
                          <th key={h} className="text-left px-3 py-2 whitespace-nowrap"
                            style={{ color: '#8892a4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comRawComments.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: '#8892a4' }}>No comments found.</td></tr>
                      ) : comRawComments.map((c, i) => (
                        <tr key={c.id} className="hover:bg-white/[0.02] transition-colors"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td className="px-3 py-2 text-center w-8" style={{ color: '#6b7280' }}>{i + 1}</td>
                          <td className="px-3 py-2 max-w-sm" style={{ color: '#8892a4' }}
                            title={c.issue}>{c.issue.length > 120 ? c.issue.slice(0, 120) + '…' : c.issue}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{ color: ISSUE_TYPE_COLOR[c.issue_type] ?? '#8892a4', background: `${ISSUE_TYPE_COLOR[c.issue_type] ?? '#6b7280'}18` }}>
                              {c.issue_type || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: '#6b7280' }}>{c.reported_by || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: '#6b7280' }}>{c.report_date ?? '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                              style={{ color: c.status === 'Closed' ? '#2ea55e' : '#f97316', background: c.status === 'Closed' ? 'rgba(46,165,94,0.12)' : 'rgba(249,115,22,0.12)' }}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs" style={{ color: '#6b7280' }}>{c.resolution || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
