'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Study } from '../types';

const RISK_STYLES: Record<string, string> = {
  Critical: 'bg-red-900/30 text-red-400 border border-red-700/40',
  High: 'bg-red-900/20 text-red-300 border border-red-700/30',
  Elevated: 'bg-orange-900/20 text-orange-400 border border-orange-700/30',
  Moderate: 'bg-yellow-900/20 text-yellow-400 border border-yellow-700/30',
  Low: 'bg-green-900/20 text-green-400 border border-green-700/30',
};

const RISK_EMOJI: Record<string, string> = {
  Critical: '🔴',
  High: '🔴',
  Elevated: '🟠',
  Moderate: '🟡',
  Low: '🟢',
};

const RISK_ORDER: Record<string, number> = {
  Critical: 0,
  High: 1,
  Elevated: 2,
  Moderate: 3,
  Low: 4,
};

const TREND_DATA = [
  { date: 'Dec 25', prod_pct: 61.2, qc_pct: 54.7 },
  { date: 'Jan 26', prod_pct: 64.8, qc_pct: 58.3 },
  { date: 'Feb 26', prod_pct: 68.1, qc_pct: 62.0 },
  { date: 'Mar 26', prod_pct: 70.9, qc_pct: 65.1 },
  { date: 'Apr 26', prod_pct: 73.2, qc_pct: 67.8 },
  { date: 'May 26', prod_pct: 75.4, qc_pct: 70.2 },
  { date: 'Jun 26', prod_pct: 77.1, qc_pct: 72.4 },
  { date: 'Today', prod_pct: 78.6, qc_pct: 73.9 },
];

function filterByNlq(query: string, studies: Study[]): Study[] {
  const q = query.toLowerCase();
  if (/high.risk|critical/.test(q))
    return studies.filter((s) => ['Critical', 'High'].includes(s.risk_tier));
  if (/delayed|overdue|behind/.test(q)) return studies.filter((s) => s.delayed);
  if (/at.risk/.test(q)) return studies.filter((s) => s.at_risk);
  if (/qc.below|qc under/.test(q)) {
    const m = q.match(/\d+/);
    const pct = m ? +m[0] : 70;
    return studies.filter((s) => s.qc_pct < pct);
  }
  if (/4 week/.test(q))
    return studies.filter(
      (s) => s.weeks_to_dbl !== null && s.weeks_to_dbl >= 0 && s.weeks_to_dbl <= 4
    );
  if (/fsp/.test(q)) return studies.filter((s) => s.fso_fsp === 'FSP');
  if (/fso/.test(q)) return studies.filter((s) => s.fso_fsp === 'FSO');
  const clients = [...new Set(studies.map((s) => s.client.toLowerCase()))];
  const matchedClient = clients.find(
    (c) => q.includes(c) || c.includes(q.split(' ')[0])
  );
  if (matchedClient)
    return studies.filter((s) => s.client.toLowerCase() === matchedClient);
  const tas = [
    'oncology',
    'cardiovascular',
    'respiratory',
    'neurology',
    'immunology',
    'rare disease',
    'hepatology',
  ];
  const matchedTa = tas.find((ta) => q.includes(ta));
  if (matchedTa) return studies.filter((s) => s.ta.toLowerCase() === matchedTa);
  return studies;
}

type SortKey = 'risk' | 'prod_pct' | 'qc_pct';

interface DrillDownProps {
  study: Study;
  onClose: () => void;
}

function DrillDown({ study, onClose }: DrillDownProps) {
  const prodQcGap = study.prod_pct - study.qc_pct;
  const topFactors = [...study.risk_factors]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  return (
    <div
      className="rounded-lg p-5 mt-1 mb-2 relative"
      style={{
        background: '#1c2230',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-xs px-2 py-1 rounded"
        style={{ color: '#8892a4', background: 'rgba(255,255,255,0.05)' }}
      >
        ✕ Close
      </button>
      <h3 className="text-sm font-semibold mb-4" style={{ color: '#e8eaf0' }}>
        {study.study} — Drill Down
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {/* Completion */}
        <div>
          <p className="text-xs font-medium mb-3" style={{ color: '#8892a4' }}>
            COMPLETION
          </p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: '#8892a4' }}>
                <span>Production</span>
                <span style={{ color: '#2ea55e' }}>{study.prod_pct.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${study.prod_pct}%`, background: '#2ea55e' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: '#8892a4' }}>
                <span>QC</span>
                <span style={{ color: '#3b82f6' }}>{study.qc_pct.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${study.qc_pct}%`, background: '#3b82f6' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: '#8892a4' }}>
                <span>Overall Progress</span>
                <span style={{ color: '#e8eaf0' }}>
                  {((study.prod_pct + study.qc_pct) / 2).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(study.prod_pct + study.qc_pct) / 2}%`,
                    background: 'linear-gradient(90deg, #2ea55e, #3b82f6)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div>
          <p className="text-xs font-medium mb-3" style={{ color: '#8892a4' }}>
            KEY METRICS
          </p>
          <div className="space-y-2">
            {[
              { label: 'Prod–QC Gap', value: `${prodQcGap.toFixed(1)}pp` },
              { label: 'Sig. Delays', value: study.sig_delays },
              { label: 'Failed QC', value: study.failed_qc },
              {
                label: 'Weeks to DBL',
                value:
                  study.weeks_to_dbl !== null ? study.weeks_to_dbl.toFixed(1) : 'N/A',
              },
              { label: 'Deliverables', value: study.total_del },
            ].map((m) => (
              <div
                key={m.label}
                className="flex justify-between items-center py-1 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <span className="text-xs" style={{ color: '#8892a4' }}>
                  {m.label}
                </span>
                <span className="text-xs font-medium" style={{ color: '#e8eaf0' }}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Risk Model */}
        <div
          className="rounded-lg p-3"
          style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}
        >
          <p className="text-xs font-medium mb-3" style={{ color: '#3b82f6' }}>
            AI RISK MODEL
          </p>
          <div className="space-y-2 mb-3">
            <div className="flex justify-between text-xs">
              <span style={{ color: '#8892a4' }}>AI Risk Score</span>
              <span style={{ color: '#3b82f6' }}>
                {(study.ai_risk_score * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${study.ai_risk_score * 100}%`, background: '#3b82f6' }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: '#8892a4' }}>Rule-Based Score</span>
              <span style={{ color: '#e8eaf0' }}>
                {(study.risk_score * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <p className="text-xs mb-2" style={{ color: '#8892a4' }}>
            Top Risk Factors
          </p>
          <div className="space-y-2">
            {topFactors.length === 0 ? (
              <p className="text-xs" style={{ color: '#8892a4' }}>
                No significant factors
              </p>
            ) : (
              topFactors.map((f) => (
                <div key={f.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: '#8892a4' }}>{f.label}</span>
                    <span style={{ color: '#3b82f6' }}>
                      {(f.value * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(f.value * 100, 100)}%`,
                        background: '#3b82f6',
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultsTab({ studies }: { studies: Study[] }) {
  const [businessLine, setBusinessLine] = useState<'All' | 'FSO' | 'FSP'>('All');
  const [clientFilter, setClientFilter] = useState('All');
  const [onlyStarted, setOnlyStarted] = useState(false);
  const [nlqInput, setNlqInput] = useState('');
  const [nlqResponse, setNlqResponse] = useState('');
  const [nlqLoading, setNlqLoading] = useState(false);
  const [nlqActive, setNlqActive] = useState(false);
  const [nlqQuery, setNlqQuery] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('risk');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedStudy, setExpandedStudy] = useState<string | null>(null);

  const clients = useMemo(
    () => ['All', ...Array.from(new Set(studies.map((s) => s.client))).sort()],
    [studies]
  );

  // Base filters (sidebar)
  const sidebarFiltered = useMemo(() => {
    return studies.filter((s) => {
      if (businessLine !== 'All' && s.fso_fsp !== businessLine) return false;
      if (clientFilter !== 'All' && s.client !== clientFilter) return false;
      if (onlyStarted && s.prod_pct === 0) return false;
      return true;
    });
  }, [studies, businessLine, clientFilter, onlyStarted]);

  // NLQ filter
  const nlqFiltered = useMemo(() => {
    if (!nlqActive || !nlqQuery) return sidebarFiltered;
    return filterByNlq(nlqQuery, sidebarFiltered);
  }, [sidebarFiltered, nlqActive, nlqQuery]);

  // Table search + sort
  const tableFiltered = useMemo(() => {
    let filtered = nlqFiltered;
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      filtered = filtered.filter(
        (s) => s.study.toLowerCase().includes(q) || s.client.toLowerCase().includes(q)
      );
    }
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'risk') {
        const diff = RISK_ORDER[a.risk_tier] - RISK_ORDER[b.risk_tier];
        return sortAsc ? diff : -diff;
      }
      if (sortKey === 'prod_pct') return sortAsc ? a.prod_pct - b.prod_pct : b.prod_pct - a.prod_pct;
      if (sortKey === 'qc_pct') return sortAsc ? a.qc_pct - b.qc_pct : b.qc_pct - a.qc_pct;
      return 0;
    });
    return sorted;
  }, [nlqFiltered, tableSearch, sortKey, sortAsc]);

  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(tableFiltered.length / pageSize));
  const paginated = tableFiltered.slice((page - 1) * pageSize, page * pageSize);

  // KPIs from sidebar-filtered (not nlq-filtered)
  const delayed = sidebarFiltered.filter((s) => s.delayed).length;
  const atRisk = sidebarFiltered.filter((s) => s.at_risk).length;
  const avgProd =
    sidebarFiltered.length > 0
      ? sidebarFiltered.reduce((a, s) => a + s.prod_pct, 0) / sidebarFiltered.length
      : 0;
  const avgQc =
    sidebarFiltered.length > 0
      ? sidebarFiltered.reduce((a, s) => a + s.qc_pct, 0) / sidebarFiltered.length
      : 0;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
    setPage(1);
  };

  const handleNlq = async (q?: string) => {
    const query = q ?? nlqInput;
    if (!query.trim()) return;
    setNlqLoading(true);
    setNlqActive(true);
    setNlqQuery(query);
    setPage(1);
    try {
      const context = `Total studies: ${studies.length}, Delayed: ${delayed}, At-risk: ${atRisk}, Avg prod: ${avgProd.toFixed(1)}%, Avg QC: ${avgQc.toFixed(1)}%`;
      const res = await fetch('/api/nlq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context }),
      });
      const data = await res.json();
      setNlqResponse(data.response);
    } catch {
      setNlqResponse('Unable to process query.');
    } finally {
      setNlqLoading(false);
    }
  };

  const clearNlq = () => {
    setNlqActive(false);
    setNlqQuery('');
    setNlqResponse('');
    setNlqInput('');
    setPage(1);
  };

  const QUICK_CHIPS = [
    'High-risk studies',
    'Delayed studies',
    'QC below 70%',
    'Within 4 weeks of DBL',
  ];

  return (
    <div className="flex" style={{ minHeight: 'calc(100vh - 112px)' }}>
      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 p-4 border-r flex flex-col gap-5"
        style={{ background: '#1c2230', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        {/* Business Line */}
        <div>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#8892a4' }}>
            Business Line
          </p>
          <div className="flex flex-col gap-1.5">
            {(['All', 'FSO', 'FSP'] as const).map((bl) => (
              <label key={bl} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bl"
                  checked={businessLine === bl}
                  onChange={() => { setBusinessLine(bl); setPage(1); }}
                  className="accent-green-500"
                />
                <span className="text-sm" style={{ color: businessLine === bl ? '#2ea55e' : '#e8eaf0' }}>
                  {bl}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Client Filter */}
        <div>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#8892a4' }}>
            Client
          </p>
          <select
            value={clientFilter}
            onChange={(e) => { setClientFilter(e.target.value); setPage(1); }}
            className="w-full text-sm rounded px-2 py-1.5 border"
            style={{
              background: '#0d1117',
              color: '#e8eaf0',
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            {clients.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Only started */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyStarted}
              onChange={(e) => { setOnlyStarted(e.target.checked); setPage(1); }}
              className="accent-green-500"
            />
            <span className="text-sm" style={{ color: '#e8eaf0' }}>Only started studies</span>
          </label>
          <p className="text-xs mt-1" style={{ color: '#8892a4' }}>
            Hide 0% production
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 space-y-5 min-w-0">
        {/* NLQ Card */}
        <div
          className="rounded-lg p-4"
          style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#8892a4' }}>
            Portfolio Query
          </p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={nlqInput}
              onChange={(e) => setNlqInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNlq()}
              placeholder="Ask about your portfolio…"
              className="flex-1 text-sm rounded px-3 py-2 border outline-none"
              style={{
                background: '#1c2230',
                color: '#e8eaf0',
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            />
            <button
              onClick={() => handleNlq()}
              disabled={nlqLoading}
              className="px-4 py-2 rounded text-sm font-medium transition-opacity"
              style={{ background: '#2ea55e', color: '#fff', opacity: nlqLoading ? 0.6 : 1 }}
            >
              {nlqLoading ? '…' : 'Ask'}
            </button>
            {nlqActive && (
              <button
                onClick={clearNlq}
                className="px-3 py-2 rounded text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#8892a4' }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => { setNlqInput(chip); handleNlq(chip); }}
                className="text-xs px-3 py-1 rounded-full border transition-colors"
                style={{
                  borderColor: 'rgba(46,165,94,0.4)',
                  color: '#2ea55e',
                  background: 'rgba(46,165,94,0.08)',
                }}
              >
                {chip}
              </button>
            ))}
          </div>
          {nlqLoading && (
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: '#3b82f6', borderTopColor: 'transparent' }}
              />
              <span className="text-xs" style={{ color: '#8892a4' }}>Analyzing…</span>
            </div>
          )}
          {nlqResponse && !nlqLoading && (
            <div
              className="rounded px-3 py-2 text-sm"
              style={{ background: 'rgba(59,130,246,0.08)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              {nlqResponse}
              {nlqActive && (
                <span className="ml-2 text-xs" style={{ color: '#8892a4' }}>
                  · {tableFiltered.length} studies shown
                </span>
              )}
            </div>
          )}
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total Studies', value: sidebarFiltered.length, color: '#e8eaf0' },
            { label: 'Delayed', value: delayed, color: '#dc2626' },
            { label: 'At-Risk', value: atRisk, color: '#f97316' },
            { label: 'Avg Prod %', value: `${avgProd.toFixed(1)}%`, color: '#2ea55e' },
            { label: 'Avg QC %', value: `${avgQc.toFixed(1)}%`, color: '#3b82f6' },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg p-4 text-center"
              style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="text-2xl font-bold" style={{ color: kpi.color }}>
                {kpi.value}
              </div>
              <div className="text-xs mt-1" style={{ color: '#8892a4' }}>
                {kpi.label}
              </div>
            </div>
          ))}
        </div>

        {/* Completion Over Time */}
        <div
          className="rounded-lg p-4"
          style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-sm font-semibold mb-4" style={{ color: '#e8eaf0' }}>
            Completion Over Time
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={TREND_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#8892a4', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
              />
              <YAxis
                domain={[50, 85]}
                tick={{ fill: '#8892a4', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}
                labelStyle={{ color: '#e8eaf0', marginBottom: 4 }}
                itemStyle={{ color: '#8892a4' }}
                formatter={(value) => [`${value}%`]}
              />
              <Legend
                wrapperStyle={{ color: '#8892a4', fontSize: 12, paddingTop: 8 }}
              />
              <Line
                type="monotone"
                dataKey="prod_pct"
                name="Production"
                stroke="#2ea55e"
                strokeWidth={2}
                dot={{ fill: '#2ea55e', r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="qc_pct"
                name="QC"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Study Table */}
        <div
          className="rounded-lg"
          style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between p-4 pb-3">
            <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>
              Studies ({tableFiltered.length})
            </p>
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => { setTableSearch(e.target.value); setPage(1); }}
              placeholder="Search study or client…"
              className="text-sm rounded px-3 py-1.5 border outline-none w-52"
              style={{
                background: '#1c2230',
                color: '#e8eaf0',
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {[
                    { key: 'risk' as SortKey, label: 'Risk' },
                    { key: null, label: 'Study' },
                    { key: null, label: 'Client' },
                    { key: null, label: 'TA' },
                    { key: null, label: 'Type' },
                    { key: 'prod_pct' as SortKey, label: 'Prod %' },
                    { key: 'qc_pct' as SortKey, label: 'QC %' },
                    { key: null, label: 'DBL' },
                    { key: null, label: 'Wks' },
                  ].map((col) => (
                    <th
                      key={col.label}
                      className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider"
                      style={{ color: '#8892a4', cursor: col.key ? 'pointer' : 'default' }}
                      onClick={() => col.key && handleSort(col.key)}
                    >
                      {col.label}
                      {col.key && sortKey === col.key && (
                        <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((study) => (
                  <>
                    <tr
                      key={study.study}
                      onClick={() =>
                        setExpandedStudy(
                          expandedStudy === study.study ? null : study.study
                        )
                      }
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background:
                          expandedStudy === study.study
                            ? 'rgba(46,165,94,0.06)'
                            : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (expandedStudy !== study.study)
                          (e.currentTarget as HTMLTableRowElement).style.background =
                            'rgba(255,255,255,0.03)';
                      }}
                      onMouseLeave={(e) => {
                        if (expandedStudy !== study.study)
                          (e.currentTarget as HTMLTableRowElement).style.background =
                            'transparent';
                      }}
                    >
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${RISK_STYLES[study.risk_tier]}`}
                        >
                          <span>{RISK_EMOJI[study.risk_tier]}</span>
                          {study.risk_tier}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-medium" style={{ color: '#e8eaf0' }}>
                        {study.study}
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: '#8892a4' }}>
                        {study.client}
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: '#8892a4' }}>
                        {study.ta}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            background:
                              study.fso_fsp === 'FSO'
                                ? 'rgba(46,165,94,0.1)'
                                : 'rgba(59,130,246,0.1)',
                            color: study.fso_fsp === 'FSO' ? '#2ea55e' : '#3b82f6',
                          }}
                        >
                          {study.fso_fsp}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          style={{
                            color:
                              study.prod_pct >= 80
                                ? '#22c55e'
                                : study.prod_pct >= 60
                                ? '#eab308'
                                : '#ef4444',
                          }}
                        >
                          {study.prod_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          style={{
                            color:
                              study.qc_pct >= 80
                                ? '#22c55e'
                                : study.qc_pct >= 60
                                ? '#eab308'
                                : '#ef4444',
                          }}
                        >
                          {study.qc_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: '#8892a4' }}>
                        {study.dbl ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: '#8892a4' }}>
                        {study.weeks_to_dbl !== null ? study.weeks_to_dbl.toFixed(1) : '—'}
                      </td>
                    </tr>
                    {expandedStudy === study.study && (
                      <tr key={`${study.study}-drill`}>
                        <td colSpan={9} className="px-4">
                          <DrillDown
                            study={study}
                            onClose={() => setExpandedStudy(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-sm"
                      style={{ color: '#8892a4' }}
                    >
                      No studies match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between px-4 py-3 border-t"
              style={{ borderColor: 'rgba(255,255,255,0.07)' }}
            >
              <span className="text-xs" style={{ color: '#8892a4' }}>
                Page {page} of {totalPages} · {tableFiltered.length} studies
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded text-xs disabled:opacity-40"
                  style={{ background: '#1c2230', color: '#e8eaf0' }}
                >
                  ‹ Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="px-3 py-1 rounded text-xs"
                      style={{
                        background: p === page ? '#2ea55e' : '#1c2230',
                        color: p === page ? '#fff' : '#e8eaf0',
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded text-xs disabled:opacity-40"
                  style={{ background: '#1c2230', color: '#e8eaf0' }}
                >
                  Next ›
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
