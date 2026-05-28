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

const SNAPSHOT_DATES = [
  'Today (28/05/2026)',
  'Apr 2026',
  'Mar 2026',
  'Feb 2026',
  'Jan 2026',
  'Dec 2025',
  'Nov 2025',
  'Oct 2025',
];

const TREND_DATA = [
  { date: 'Oct 25', prod_pct: 58.2, qc_pct: 52.1 },
  { date: 'Nov 25', prod_pct: 61.8, qc_pct: 55.7 },
  { date: 'Dec 25', prod_pct: 64.3, qc_pct: 58.4 },
  { date: 'Jan 26', prod_pct: 67.1, qc_pct: 61.2 },
  { date: 'Feb 26', prod_pct: 69.8, qc_pct: 63.7 },
  { date: 'Mar 26', prod_pct: 71.4, qc_pct: 65.9 },
  { date: 'Apr 26', prod_pct: 73.2, qc_pct: 67.8 },
  { date: 'Today', prod_pct: 75.4, qc_pct: 70.2 },
];

const TREND_DELTA_PROD = +(TREND_DATA[TREND_DATA.length - 1].prod_pct - TREND_DATA[TREND_DATA.length - 2].prod_pct).toFixed(1);
const TREND_DELTA_QC = +(TREND_DATA[TREND_DATA.length - 1].qc_pct - TREND_DATA[TREND_DATA.length - 2].qc_pct).toFixed(1);

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
  const clientNames = [...new Set(studies.map((s) => s.client.toLowerCase()))];
  const matchedClient = clientNames.find(
    (c) => q.includes(c) || c.includes(q.split(' ')[0])
  );
  if (matchedClient)
    return studies.filter((s) => s.client.toLowerCase() === matchedClient);
  const tas = ['oncology', 'cardiovascular', 'respiratory', 'neurology', 'immunology', 'rare disease', 'hepatology'];
  const matchedTa = tas.find((ta) => q.includes(ta));
  if (matchedTa) return studies.filter((s) => s.ta.toLowerCase() === matchedTa);
  return studies;
}

interface DrillDownProps {
  study: Study;
  onClose: () => void;
}

function DrillDown({ study, onClose }: DrillDownProps) {
  const prodQcGap = study.prod_pct - study.qc_pct;
  const topFactors = [...study.risk_factors].sort((a, b) => b.value - a.value).slice(0, 3);

  return (
    <div
      className="rounded-lg p-5 my-1 relative"
      style={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-xs px-2 py-1 rounded"
        style={{ color: '#8892a4', background: 'rgba(255,255,255,0.05)' }}
      >
        ✕ Close
      </button>
      <h3 className="text-sm font-semibold mb-4" style={{ color: '#e8eaf0' }}>
        {study.study} — Detail View
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: '#8892a4' }}>COMPLETION</p>
          <div className="space-y-3">
            {[
              { label: 'Production', value: study.prod_pct, color: '#2ea55e' },
              { label: 'QC', value: study.qc_pct, color: '#3b82f6' },
              { label: 'Overall', value: (study.prod_pct + study.qc_pct) / 2, color: undefined },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-xs mb-1" style={{ color: '#8892a4' }}>
                  <span>{m.label}</span>
                  <span style={{ color: m.color ?? '#e8eaf0' }}>{m.value.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(m.value, 100)}%`,
                      background: m.color ?? 'linear-gradient(90deg, #2ea55e, #3b82f6)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: '#8892a4' }}>KEY METRICS</p>
          <div className="space-y-2">
            {[
              { label: 'Prod–QC Gap', value: `${prodQcGap.toFixed(1)}pp` },
              { label: 'Sig. Delays', value: study.sig_delays },
              { label: 'Failed QC', value: study.failed_qc },
              { label: 'Weeks to DBL', value: study.weeks_to_dbl !== null ? study.weeks_to_dbl.toFixed(1) : 'N/A' },
              { label: 'Deliverables', value: study.total_del },
              { label: 'Portfolio', value: study.portfolio.replace(' Portfolio', '') },
            ].map((m) => (
              <div key={m.label} className="flex justify-between items-center py-1 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <span className="text-xs" style={{ color: '#8892a4' }}>{m.label}</span>
                <span className="text-xs font-medium" style={{ color: '#e8eaf0' }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: '#3b82f6' }}>AI RISK MODEL</p>
          <div className="space-y-2 mb-3">
            <div className="flex justify-between text-xs">
              <span style={{ color: '#8892a4' }}>AI Risk Score</span>
              <span style={{ color: '#3b82f6' }}>{(study.ai_risk_score * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: `${study.ai_risk_score * 100}%`, background: '#3b82f6' }} />
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: '#8892a4' }}>Rule-Based</span>
              <span style={{ color: '#e8eaf0' }}>{(study.risk_score * 100).toFixed(0)}%</span>
            </div>
          </div>
          <p className="text-xs mb-2" style={{ color: '#8892a4' }}>Top Risk Factors</p>
          <div className="space-y-2">
            {topFactors.length === 0 ? (
              <p className="text-xs" style={{ color: '#8892a4' }}>No significant factors</p>
            ) : topFactors.map((f) => (
              <div key={f.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: '#8892a4' }}>{f.label}</span>
                  <span style={{ color: '#3b82f6' }}>{(f.value * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(f.value * 100, 100)}%`, background: '#3b82f6' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultsTab({ studies }: { studies: Study[] }) {
  // SCOPE state
  const [allStudies, setAllStudies] = useState(true);
  const [allClients, setAllClients] = useState(true);
  const [allPortfolios, setAllPortfolios] = useState(true);
  const [clientScopeFilter, setClientScopeFilter] = useState('All');
  const [portfolioFilter, setPortfolioFilter] = useState('All');
  // TIME state
  const [snapshotDate, setSnapshotDate] = useState(SNAPSHOT_DATES[0]);
  const [onlyStarted, setOnlyStarted] = useState(false);
  // NLQ state
  const [nlqInput, setNlqInput] = useState('');
  const [nlqResponse, setNlqResponse] = useState('');
  const [nlqLoading, setNlqLoading] = useState(false);
  const [nlqActive, setNlqActive] = useState(false);
  const [nlqQuery, setNlqQuery] = useState('');
  // Table state
  const [tableSearch, setTableSearch] = useState('');
  const [clientTableFilter, setClientTableFilter] = useState('All');
  const [sortMode, setSortMode] = useState<'severity' | 'score'>('severity');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedStudy, setExpandedStudy] = useState<string | null>(null);
  // Download toast
  const [downloadToast, setDownloadToast] = useState(false);

  const clients = useMemo(
    () => ['All', ...Array.from(new Set(studies.map((s) => s.client))).sort()],
    [studies]
  );

  const portfolios = useMemo(
    () => Array.from(new Set(studies.map((s) => s.portfolio))).sort(),
    [studies]
  );

  const sidebarFiltered = useMemo(() => {
    return studies.filter((s) => {
      if (!allStudies && s.prod_pct === 0) return false;
      if (onlyStarted && s.prod_pct === 0) return false;
      if (!allClients && clientScopeFilter !== 'All' && s.client !== clientScopeFilter) return false;
      if (!allPortfolios && portfolioFilter !== 'All' && s.portfolio !== portfolioFilter) return false;
      return true;
    });
  }, [studies, allStudies, allClients, clientScopeFilter, allPortfolios, portfolioFilter, onlyStarted]);

  const nlqFiltered = useMemo(() => {
    if (!nlqActive || !nlqQuery) return sidebarFiltered;
    return filterByNlq(nlqQuery, sidebarFiltered);
  }, [sidebarFiltered, nlqActive, nlqQuery]);

  const tableFiltered = useMemo(() => {
    let filtered = nlqFiltered;
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      filtered = filtered.filter(
        (s) => s.study.toLowerCase().includes(q) || s.client.toLowerCase().includes(q)
      );
    }
    if (clientTableFilter !== 'All') {
      filtered = filtered.filter((s) => s.client === clientTableFilter);
    }
    return filtered;
  }, [nlqFiltered, tableSearch, clientTableFilter]);

  const groupedByClient = useMemo(() => {
    const groups: Record<string, Study[]> = {};
    tableFiltered.forEach((s) => {
      if (!groups[s.client]) groups[s.client] = [];
      groups[s.client].push(s);
    });
    return Object.entries(groups)
      .map(([client, clientStudies]) => {
        const sorted = [...clientStudies].sort((a, b) =>
          sortMode === 'severity'
            ? RISK_ORDER[a.risk_tier] - RISK_ORDER[b.risk_tier]
            : b.ai_risk_score - a.ai_risk_score
        );
        const worstRiskOrder = Math.min(...clientStudies.map((s) => RISK_ORDER[s.risk_tier]));
        return { client, studies: sorted, worstRiskOrder };
      })
      .sort((a, b) => a.worstRiskOrder - b.worstRiskOrder);
  }, [tableFiltered, sortMode]);

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

  const toggleClient = (client: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(client)) next.delete(client);
      else next.add(client);
      return next;
    });
  };

  const handleNlq = async (q?: string) => {
    const query = q ?? nlqInput;
    if (!query.trim()) return;
    setNlqLoading(true);
    setNlqActive(true);
    setNlqQuery(query);
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
  };

  const handleDownload = () => {
    setDownloadToast(true);
    setTimeout(() => setDownloadToast(false), 2500);
  };

  const QUICK_CHIPS = [
    'High-risk studies',
    'Delayed studies',
    'QC below 70%',
    'Within 4 weeks of DBL',
  ];

  return (
    <div className="flex" style={{ minHeight: 'calc(100vh - 112px)' }}>
      {/* Download toast */}
      {downloadToast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm" style={{ background: '#2ea55e', color: '#fff' }}>
          ↓ Report download coming soon
        </div>
      )}

      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 p-4 border-r flex flex-col gap-4"
        style={{ background: '#1c2230', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        {/* SCOPE */}
        <div>
          <p className="text-xs font-bold mb-3 uppercase tracking-widest" style={{ color: '#2ea55e' }}>SCOPE</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allStudies}
                onChange={(e) => setAllStudies(e.target.checked)}
                className="accent-green-500"
              />
              <span className="text-sm" style={{ color: '#e8eaf0' }}>All studies</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allClients}
                onChange={(e) => {
                  setAllClients(e.target.checked);
                  if (e.target.checked) setClientScopeFilter('All');
                }}
                className="accent-green-500"
              />
              <span className="text-sm" style={{ color: '#e8eaf0' }}>All clients</span>
            </label>
            {!allClients && (
              <select
                value={clientScopeFilter}
                onChange={(e) => setClientScopeFilter(e.target.value)}
                className="w-full text-xs rounded px-2 py-1.5 border ml-4"
                style={{ background: '#0d1117', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' }}
              >
                {clients.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allPortfolios}
                onChange={(e) => {
                  setAllPortfolios(e.target.checked);
                  if (e.target.checked) setPortfolioFilter('All');
                }}
                className="accent-green-500"
              />
              <span className="text-sm" style={{ color: '#e8eaf0' }}>All portfolios</span>
            </label>
            {!allPortfolios && (
              <div className="flex flex-col gap-1.5 ml-4 mt-1">
                {portfolios.map((p) => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="portfolio"
                      checked={portfolioFilter === p}
                      onChange={() => setPortfolioFilter(p)}
                      className="accent-green-500"
                    />
                    <span className="text-xs" style={{ color: portfolioFilter === p ? '#2ea55e' : '#e8eaf0' }}>
                      {p.replace(' Portfolio', '')}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

        {/* TIME */}
        <div>
          <p className="text-xs font-bold mb-3 uppercase tracking-widest" style={{ color: '#2ea55e' }}>TIME</p>
          <div className="flex flex-col gap-2">
            <select
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              className="w-full text-xs rounded px-2 py-1.5 border"
              style={{ background: '#0d1117', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              {SNAPSHOT_DATES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={onlyStarted}
                onChange={(e) => setOnlyStarted(e.target.checked)}
                className="accent-green-500"
              />
              <span className="text-xs" style={{ color: '#e8eaf0' }}>Only started studies</span>
            </label>
            <button
              onClick={handleDownload}
              className="w-full text-xs py-2 rounded mt-2 transition-opacity hover:opacity-80"
              style={{ background: 'rgba(46,165,94,0.1)', color: '#2ea55e', border: '1px solid rgba(46,165,94,0.3)' }}
            >
              ↓ Download Report
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 space-y-4 min-w-0">
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
              style={{ background: '#1c2230', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' }}
            />
            <button
              onClick={() => handleNlq()}
              disabled={nlqLoading}
              className="px-4 py-2 rounded text-sm font-medium"
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
          <div className="flex flex-wrap gap-2 mb-2">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => { setNlqInput(chip); handleNlq(chip); }}
                className="text-xs px-3 py-1 rounded-full border"
                style={{ borderColor: 'rgba(46,165,94,0.4)', color: '#2ea55e', background: 'rgba(46,165,94,0.08)' }}
              >
                {chip}
              </button>
            ))}
          </div>
          {nlqLoading && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#3b82f6', borderTopColor: 'transparent' }} />
              <span className="text-xs" style={{ color: '#8892a4' }}>Analyzing…</span>
            </div>
          )}
          {nlqResponse && !nlqLoading && (
            <div className="rounded px-3 py-2 text-sm mt-2" style={{ background: 'rgba(59,130,246,0.08)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}>
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
          {/* Total Studies */}
          <div className="rounded-lg p-4 text-center" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-2xl font-bold" style={{ color: '#e8eaf0' }}>{sidebarFiltered.length}</div>
            <div className="text-xs mt-1" style={{ color: '#8892a4' }}>Total Studies</div>
          </div>
          {/* Delayed */}
          <div className="rounded-lg p-4 text-center" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-2xl font-bold" style={{ color: '#dc2626' }}>{delayed}</div>
            <div className="text-xs mt-1" style={{ color: '#8892a4' }}>Delayed</div>
          </div>
          {/* At-Risk */}
          <div className="rounded-lg p-4 text-center" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-2xl font-bold" style={{ color: '#f97316' }}>{atRisk}</div>
            <div className="text-xs mt-1" style={{ color: '#8892a4' }}>At-Risk</div>
          </div>
          {/* Production Done */}
          <div className="rounded-lg px-4 pt-3 pb-2" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-end justify-between mb-1">
              <div className="text-2xl font-bold" style={{ color: '#2ea55e' }}>{avgProd.toFixed(1)}%</div>
              <span className="text-xs mb-1" style={{ color: TREND_DELTA_PROD >= 0 ? '#22c55e' : '#ef4444' }}>
                {TREND_DELTA_PROD >= 0 ? '↑' : '↓'} {Math.abs(TREND_DELTA_PROD)}% vs prev
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(avgProd, 100)}%`, background: '#2ea55e' }} />
            </div>
            <div className="text-xs" style={{ color: '#8892a4' }}>Production Done</div>
          </div>
          {/* QC Done */}
          <div className="rounded-lg px-4 pt-3 pb-2" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-end justify-between mb-1">
              <div className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{avgQc.toFixed(1)}%</div>
              <span className="text-xs mb-1" style={{ color: TREND_DELTA_QC >= 0 ? '#22c55e' : '#ef4444' }}>
                {TREND_DELTA_QC >= 0 ? '↑' : '↓'} {Math.abs(TREND_DELTA_QC)}% vs prev
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(avgQc, 100)}%`, background: '#3b82f6' }} />
            </div>
            <div className="text-xs" style={{ color: '#8892a4' }}>QC Done</div>
          </div>
        </div>

        {/* Completion Over Time */}
        <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Completion Over Time</p>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#8892a4' }}>
              <span>{SNAPSHOT_DATES.length} Snapshot dates</span>
              <span style={{ color: '#2ea55e' }}>▼</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={TREND_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
              <YAxis domain={[50, 80]} tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}
                labelStyle={{ color: '#e8eaf0', marginBottom: 4 }}
                itemStyle={{ color: '#8892a4' }}
                formatter={(value) => [`${value}%`]}
              />
              <Legend wrapperStyle={{ color: '#8892a4', fontSize: 12, paddingTop: 8 }} />
              <Line type="monotone" dataKey="prod_pct" name="Production" stroke="#2ea55e" strokeWidth={2} dot={{ fill: '#2ea55e', r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="qc_pct" name="QC" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Completion % by Study */}
        <div className="rounded-lg" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Table header */}
          <div className="flex items-center justify-between p-4 pb-2">
            <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>
              Completion % by Study
              <span className="ml-2 text-xs font-normal" style={{ color: '#8892a4' }}>({tableFiltered.length} studies)</span>
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search study or client…"
                className="text-sm rounded px-3 py-1.5 border outline-none w-44"
                style={{ background: '#1c2230', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' }}
              />
              <select
                value={clientTableFilter}
                onChange={(e) => setClientTableFilter(e.target.value)}
                className="text-xs rounded px-2 py-1.5 border"
                style={{ background: '#1c2230', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <option value="All">Filter by Client</option>
                {clients.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Sort toggle */}
          <div className="px-4 pb-3 flex items-center gap-2">
            <span className="text-xs" style={{ color: '#8892a4' }}>Sort:</span>
            {(['severity', 'score'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className="text-xs px-3 py-1 rounded font-medium transition-colors"
                style={{
                  background: sortMode === mode ? '#2ea55e' : 'rgba(255,255,255,0.05)',
                  color: sortMode === mode ? '#fff' : '#8892a4',
                }}
              >
                {mode === 'severity' ? 'Risk Severity' : 'Risk Score'}
              </button>
            ))}
          </div>

          {/* Client-grouped rows */}
          <div>
            {groupedByClient.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: '#8892a4' }}>
                No studies match the current filters.
              </div>
            ) : groupedByClient.map(({ client, studies: clientStudies }) => {
              const isExpanded = expandedClients.has(client);
              const riskCounts = clientStudies.reduce((acc, s) => {
                acc[s.risk_tier] = (acc[s.risk_tier] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              const cAvgProd = clientStudies.reduce((a, s) => a + s.prod_pct, 0) / clientStudies.length;
              const cAvgQc = clientStudies.reduce((a, s) => a + s.qc_pct, 0) / clientStudies.length;

              return (
                <div key={client} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {/* Client header row */}
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                    onClick={() => toggleClient(client)}
                    style={{ background: isExpanded ? 'rgba(46,165,94,0.04)' : 'transparent' }}
                    onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                  >
                    <span className="text-xs font-bold w-4" style={{ color: '#3b82f6' }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: '#e8eaf0' }}>
                      {client}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: '#8892a4' }}>
                      {clientStudies.length} {clientStudies.length === 1 ? 'study' : 'studies'}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs font-medium" style={{ color: '#2ea55e' }}>{cAvgProd.toFixed(0)}%</span>
                      <span className="text-xs" style={{ color: '#8892a4' }}>/</span>
                      <span className="text-xs font-medium" style={{ color: '#3b82f6' }}>{cAvgQc.toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(['Critical', 'High', 'Elevated', 'Moderate', 'Low'] as const)
                        .filter((t) => riskCounts[t])
                        .map((tier) => (
                          <span key={tier} className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${RISK_STYLES[tier]}`}>
                            {RISK_EMOJI[tier]} {riskCounts[tier]}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Expanded study rows */}
                  {isExpanded && clientStudies.map((study) => (
                    <div key={study.study}>
                      <div
                        className="flex items-center gap-3 px-4 py-2 cursor-pointer border-t"
                        style={{
                          borderColor: 'rgba(255,255,255,0.04)',
                          background: expandedStudy === study.study ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.015)',
                          paddingLeft: '2.5rem',
                        }}
                        onClick={() =>
                          setExpandedStudy(expandedStudy === study.study ? null : study.study)
                        }
                        onMouseEnter={(e) => { if (expandedStudy !== study.study) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={(e) => { if (expandedStudy !== study.study) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.015)'; }}
                      >
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${RISK_STYLES[study.risk_tier]}`}>
                          {RISK_EMOJI[study.risk_tier]} {study.risk_tier}
                        </span>
                        <span className="text-sm flex-1 min-w-0 truncate" style={{ color: '#e8eaf0' }}>
                          {study.study}
                        </span>
                        <span className="text-xs flex-shrink-0" style={{ color: '#8892a4' }}>
                          {study.ta}
                        </span>
                        <span className="text-xs flex-shrink-0 px-1.5 py-0.5 rounded" style={{
                          background: study.fso_fsp === 'FSO' ? 'rgba(46,165,94,0.1)' : 'rgba(59,130,246,0.1)',
                          color: study.fso_fsp === 'FSO' ? '#2ea55e' : '#3b82f6',
                        }}>
                          {study.fso_fsp}
                        </span>
                        {/* Mini completion bars */}
                        <div className="flex items-center gap-2 flex-shrink-0 w-48">
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-0.5">
                              <span style={{ color: '#8892a4' }}>P</span>
                              <span style={{ color: '#2ea55e' }}>{study.prod_pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                              <div className="h-full rounded-full" style={{ width: `${study.prod_pct}%`, background: '#2ea55e' }} />
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-0.5">
                              <span style={{ color: '#8892a4' }}>Q</span>
                              <span style={{ color: '#3b82f6' }}>{study.qc_pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                              <div className="h-full rounded-full" style={{ width: `${study.qc_pct}%`, background: '#3b82f6' }} />
                            </div>
                          </div>
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: '#8892a4' }}>
                          {study.dbl ?? '—'}
                        </span>
                        <span className="text-xs flex-shrink-0" style={{ color: expandedStudy === study.study ? '#93c5fd' : '#8892a4' }}>
                          {expandedStudy === study.study ? '▲ hide' : '▼ detail'}
                        </span>
                      </div>
                      {expandedStudy === study.study && (
                        <div className="px-4 pb-2" style={{ background: 'rgba(255,255,255,0.015)', paddingLeft: '2.5rem' }}>
                          <DrillDown study={study} onClose={() => setExpandedStudy(null)} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
