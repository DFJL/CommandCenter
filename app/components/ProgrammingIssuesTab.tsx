'use client';

import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import type { P21Finding } from '../types';
import commentsRaw from '../../public/data/comments.json';

type Comment = {
  id: string;
  deliverable_type: string;
  data_type: string;
  dataset: string;
  issue: string;
  issue_type: string;
  reported_by: string;
  report_date: string | null;
  responsible_party: string;
  status: string;
  resolved_by: string;
  resolve_date: string | null;
  comments: string;
  resolution: string;
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

export default function ProgrammingIssuesTab({ findings }: { findings: P21Finding[] }) {
  const [mode, setMode] = useState<Mode>('p21');

  // ── P21 state ──────────────────────────────────────────
  const [p21Search, setP21Search] = useState('');
  const [p21SortCol, setP21SortCol] = useState('severity');
  const [p21SortAsc, setP21SortAsc] = useState(true);

  const p21CategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of findings) map[f.ai_category] = (map[f.ai_category] ?? 0) + 1;
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [findings]);

  const p21StudyData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of findings) map[f.study_id] = (map[f.study_id] ?? 0) + 1;
    return Object.entries(map).map(([study, count]) => ({ study, count })).sort((a, b) => b.count - a.count);
  }, [findings]);

  const p21Table = useMemo(() => {
    let rows = findings;
    if (p21Search) {
      const q = p21Search.toLowerCase();
      rows = rows.filter((f) =>
        f.finding_id.toLowerCase().includes(q) || f.study_id.toLowerCase().includes(q) ||
        f.message.toLowerCase().includes(q) || f.ai_category.toLowerCase().includes(q) || f.dataset.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      if (p21SortCol === 'severity') {
        const order: Record<string, number> = { Error: 0, Warning: 1 };
        const d = (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
        return p21SortAsc ? d : -d;
      }
      const av = a[p21SortCol as keyof P21Finding] as string ?? '';
      const bv = b[p21SortCol as keyof P21Finding] as string ?? '';
      return p21SortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [findings, p21Search, p21SortCol, p21SortAsc]);

  const handleP21Sort = (col: string) => {
    if (p21SortCol === col) setP21SortAsc(!p21SortAsc);
    else { setP21SortCol(col); setP21SortAsc(true); }
  };

  // ── Comments state ──────────────────────────────────────
  const [comSearch, setComSearch] = useState('');
  const [comDelType, setComDelType] = useState('All');
  const [comStatus, setComStatus] = useState('All');
  const [comIssueType, setComIssueType] = useState('All');

  const delTypes = useMemo(() => ['All', ...Array.from(new Set(COMMENTS.map((c) => c.deliverable_type))).sort()], []);
  const issueTypes = useMemo(() => ['All', ...Array.from(new Set(COMMENTS.map((c) => c.issue_type).filter(Boolean))).sort()], []);

  const comFiltered = useMemo(() => {
    let rows = COMMENTS;
    if (comDelType !== 'All') rows = rows.filter((c) => c.deliverable_type === comDelType);
    if (comStatus !== 'All') rows = rows.filter((c) => c.status === comStatus);
    if (comIssueType !== 'All') rows = rows.filter((c) => c.issue_type === comIssueType);
    if (comSearch.trim()) {
      const q = comSearch.toLowerCase();
      rows = rows.filter((c) =>
        c.dataset.toLowerCase().includes(q) || c.issue.toLowerCase().includes(q) ||
        c.data_type.toLowerCase().includes(q) || c.issue_type.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [comSearch, comDelType, comStatus, comIssueType]);

  const comDelTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of COMMENTS) map[c.deliverable_type] = (map[c.deliverable_type] ?? 0) + 1;
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, []);

  const comIssueTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of COMMENTS) map[c.issue_type] = (map[c.issue_type] ?? 0) + 1;
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, []);

  const openCount = COMMENTS.filter((c) => c.status === 'Open').length;
  const closedCount = COMMENTS.filter((c) => c.status === 'Closed').length;

  const inputStyle = { background: '#1c2230', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' } as const;

  return (
    <div className="p-5 space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-0 rounded-lg overflow-hidden self-start" style={{ border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
        {([['p21', 'CDISC Validation Findings', findings.length], ['comments', 'Programming Comments', COMMENTS.length]] as const).map(([m, label, count]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="px-5 py-2 text-sm font-medium transition-colors"
            style={mode === m
              ? { background: '#2ea55e', color: '#fff' }
              : { background: 'transparent', color: '#8892a4' }}
          >
            {label}
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={{ background: mode === m ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)', color: mode === m ? '#fff' : '#6b7280' }}>{count}</span>
          </button>
        ))}
      </div>

      {/* ═══════ P21 CDISC FINDINGS ═══════ */}
      {mode === 'p21' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Findings', value: findings.length, color: '#ef4444' },
              { label: 'Studies Affected', value: new Set(findings.map((f) => f.study_id)).size, color: '#f97316' },
              { label: 'Categories', value: new Set(findings.map((f) => f.ai_category)).size, color: '#3b82f6' },
            ].map((k) => (
              <div key={k.label} className="rounded-lg p-5 text-center" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-3xl font-bold" style={{ color: k.color }}>{k.value}</div>
                <div className="text-sm mt-1" style={{ color: '#8892a4' }}>{k.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: '#e8eaf0' }}>Findings by Category</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={p21CategoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={2}>
                    {p21CategoryData.map((_, idx) => <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }} labelStyle={{ color: '#e8eaf0' }} itemStyle={{ color: '#8892a4' }} />
                  <Legend wrapperStyle={{ color: '#8892a4', fontSize: 11 }} formatter={(v) => v.length > 22 ? v.slice(0, 22) + '…' : v} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: '#e8eaf0' }}>Findings per Study</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart layout="vertical" data={p21StudyData} margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="study" tick={{ fill: '#8892a4', fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }} labelStyle={{ color: '#e8eaf0' }} itemStyle={{ color: '#8892a4' }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between p-4 pb-3">
              <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>All Findings ({p21Table.length})</p>
              <input type="text" value={p21Search} onChange={(e) => setP21Search(e.target.value)} placeholder="Search findings…" className="text-sm rounded px-3 py-1.5 border outline-none w-56" style={inputStyle} />
            </div>
            <div className="overflow-x-auto" style={{ maxHeight: 400 }}>
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {[{ key: 'severity', label: 'Severity' }, { key: 'study_id', label: 'Study' }, { key: null, label: 'Rule ID' }, { key: 'dataset', label: 'Dataset' }, { key: null, label: 'Variable' }, { key: 'ai_category', label: 'Category' }, { key: 'message', label: 'Message' }, { key: null, label: 'Avg Hrs' }].map((col) => (
                      <th key={col.label} onClick={() => col.key && handleP21Sort(col.key)} className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider whitespace-nowrap" style={{ color: '#8892a4', cursor: col.key ? 'pointer' : 'default' }}>
                        {col.label}{col.key && p21SortCol === col.key && <span className="ml-1">{p21SortAsc ? '↑' : '↓'}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p21Table.map((f) => (
                    <tr key={f.finding_id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${f.severity === 'Error' ? 'bg-red-900/30 text-red-400 border-red-700/40' : 'bg-orange-900/20 text-orange-400 border-orange-700/30'}`}>{f.severity}</span></td>
                      <td className="px-4 py-2 font-medium text-xs whitespace-nowrap" style={{ color: '#e8eaf0' }}>{f.study_id}</td>
                      <td className="px-4 py-2 text-xs" style={{ color: '#8892a4' }}>{f.rule_id}</td>
                      <td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: '#8892a4' }}>{f.dataset}</td>
                      <td className="px-4 py-2 text-xs" style={{ color: '#8892a4' }}>{f.variable}</td>
                      <td className="px-4 py-2 text-xs"><span className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{f.ai_category}</span></td>
                      <td className="px-4 py-2 text-xs max-w-xs truncate" style={{ color: '#8892a4' }} title={f.message}>{f.message}</td>
                      <td className="px-4 py-2 text-xs" style={{ color: '#8892a4' }}>{f.avg_resolution_hrs}h</td>
                    </tr>
                  ))}
                  {p21Table.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: '#8892a4' }}>No findings match the search.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════ PROGRAMMING COMMENTS ═══════ */}
      {mode === 'comments' && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Comments', value: COMMENTS.length, color: '#3b82f6' },
              { label: 'Open',           value: openCount,        color: '#f97316' },
              { label: 'Closed',         value: closedCount,      color: '#2ea55e' },
              { label: 'Showing',        value: comFiltered.length, color: '#8892a4' },
            ].map((k) => (
              <div key={k.label} className="rounded-lg p-4 text-center" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-3xl font-bold" style={{ color: k.color }}>{k.value}</div>
                <div className="text-xs mt-1" style={{ color: '#8892a4' }}>{k.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: '#e8eaf0' }}>By Deliverable Type</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={comDelTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={2}>
                    {comDelTypeData.map((entry, idx) => <Cell key={idx} fill={DEL_TYPE_COLOR[entry.name] ?? DONUT_COLORS[idx % DONUT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }} labelStyle={{ color: '#e8eaf0' }} itemStyle={{ color: '#8892a4' }} />
                  <Legend wrapperStyle={{ color: '#8892a4', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: '#e8eaf0' }}>By Issue Type</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart layout="vertical" data={comIssueTypeData} margin={{ top: 0, right: 24, left: 4, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#8892a4', fontSize: 9 }} axisLine={false} tickLine={false} width={165} />
                  <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }} labelStyle={{ color: '#e8eaf0' }} itemStyle={{ color: '#8892a4' }} />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                    {comIssueTypeData.map((entry, idx) => <Cell key={idx} fill={ISSUE_TYPE_COLOR[entry.name] ?? DONUT_COLORS[idx % DONUT_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select value={comDelType} onChange={(e) => setComDelType(e.target.value)} className="text-xs rounded px-2 py-1.5 border outline-none" style={inputStyle}>
              {delTypes.map((d) => <option key={d} value={d}>{d === 'All' ? 'All deliverable types' : d}</option>)}
            </select>
            <select value={comStatus} onChange={(e) => setComStatus(e.target.value)} className="text-xs rounded px-2 py-1.5 border outline-none" style={inputStyle}>
              <option value="All">All statuses</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>
            <select value={comIssueType} onChange={(e) => setComIssueType(e.target.value)} className="text-xs rounded px-2 py-1.5 border outline-none" style={inputStyle}>
              {issueTypes.map((t) => <option key={t} value={t}>{t === 'All' ? 'All issue types' : t}</option>)}
            </select>
            <input type="text" value={comSearch} onChange={(e) => setComSearch(e.target.value)} placeholder="Search dataset, issue…" className="text-xs rounded px-3 py-1.5 border outline-none w-48" style={inputStyle} />
            {(comDelType !== 'All' || comStatus !== 'All' || comIssueType !== 'All' || comSearch) && (
              <button onClick={() => { setComDelType('All'); setComStatus('All'); setComIssueType('All'); setComSearch(''); }} className="text-xs px-2.5 py-1 rounded font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>↺ Clear</button>
            )}
            <span className="text-xs ml-auto" style={{ color: '#6b7280' }}>{comFiltered.length} of {COMMENTS.length}</span>
          </div>

          <div className="rounded-lg" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'auto' }}>
              <table className="w-full text-xs" style={{ minWidth: 900, borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Type', 'Dataset', 'Description', 'Issue Type', 'Reported', 'Status', 'Resolution'].map((h) => (
                      <th key={h} className="text-left px-3 py-2 whitespace-nowrap" style={{ color: '#8892a4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comFiltered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: '#8892a4' }}>No comments match the filters.</td></tr>
                  ) : comFiltered.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: DEL_TYPE_COLOR[c.deliverable_type] ?? '#8892a4', background: `${DEL_TYPE_COLOR[c.deliverable_type] ?? '#6b7280'}18` }}>{c.deliverable_type}</span>
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap text-xs" style={{ color: '#e8eaf0' }}>{c.dataset}</td>
                      <td className="px-3 py-2 max-w-sm" style={{ color: '#8892a4' }} title={c.issue}>{c.issue.length > 100 ? c.issue.slice(0, 100) + '…' : c.issue}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: ISSUE_TYPE_COLOR[c.issue_type] ?? '#8892a4', background: `${ISSUE_TYPE_COLOR[c.issue_type] ?? '#6b7280'}18` }}>{c.issue_type}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: '#6b7280' }}>{c.report_date ?? '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ color: c.status === 'Closed' ? '#2ea55e' : '#f97316', background: c.status === 'Closed' ? 'rgba(46,165,94,0.12)' : 'rgba(249,115,22,0.12)' }}>{c.status}</span>
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
    </div>
  );
}
