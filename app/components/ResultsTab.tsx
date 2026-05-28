'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import type { Study, StudyUpdate } from '../types';

const RISK_STYLES: Record<string, string> = {
  Critical: 'bg-red-900/30 text-red-400 border border-red-700/40',
  High: 'bg-red-900/20 text-red-300 border border-red-700/30',
  Elevated: 'bg-orange-900/20 text-orange-400 border border-orange-700/30',
  Moderate: 'bg-yellow-900/20 text-yellow-400 border border-yellow-700/30',
  Low: 'bg-green-900/20 text-green-400 border border-green-700/30',
};

const RISK_EMOJI: Record<string, string> = {
  Critical: '🔴', High: '🔴', Elevated: '🟠', Moderate: '🟡', Low: '🟢',
};

const RISK_ORDER: Record<string, number> = {
  Critical: 0, High: 1, Elevated: 2, Moderate: 3, Low: 4,
};

function scoreTier(score: number): Study['risk_tier'] {
  if (score > 0.8) return 'Critical';
  if (score > 0.6) return 'High';
  if (score > 0.4) return 'Elevated';
  if (score > 0.2) return 'Moderate';
  return 'Low';
}

function effectiveScore(study: Study, updates: StudyUpdate[]): number {
  const upd = updates.find((u) => u.study === study.study);
  return Math.min(study.ai_risk_score + (upd?.riskBump ?? 0), 1);
}

function effectiveTier(study: Study, updates: StudyUpdate[]): Study['risk_tier'] {
  return scoreTier(effectiveScore(study, updates));
}

function nextUpcomingMilestone(study: Study, updates: StudyUpdate[]): { type: string; date: string } | null {
  const today = '2026-05-28';
  const upd = updates.find((u) => u.study === study.study);
  if (upd && Array.isArray(upd.milestones)) {
    const upcoming = upd.milestones
      .filter((m) => m.planned && m.planned >= today)
      .sort((a, b) => a.planned.localeCompare(b.planned));
    if (upcoming.length > 0) return { type: upcoming[0].type, date: upcoming[0].planned };
  }
  const candidates: { type: string; date: string }[] = [];
  if (study.fpi && study.fpi >= today) candidates.push({ type: 'FPI', date: study.fpi });
  if (study.dbl && study.dbl >= today) candidates.push({ type: 'DBL', date: study.dbl });
  candidates.sort((a, b) => a.date.localeCompare(b.date));
  return candidates.length > 0 ? candidates[0] : null;
}

const DEL_TYPES = ['SDTMs', 'ADaMs', 'Tables', 'Listings', 'Figures'] as const;

const SNAPSHOT_DATES = [
  'Today (28/05/2026)', 'Apr 2026', 'Mar 2026', 'Feb 2026',
  'Jan 2026', 'Dec 2025', 'Nov 2025', 'Oct 2025',
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
  if (/high.risk|critical/.test(q)) return studies.filter((s) => ['Critical', 'High'].includes(s.risk_tier));
  if (/delayed|overdue|behind/.test(q)) return studies.filter((s) => s.delayed);
  if (/at.risk/.test(q)) return studies.filter((s) => s.at_risk);
  if (/qc.below|qc under/.test(q)) {
    const m = q.match(/\d+/);
    return studies.filter((s) => s.qc_pct < (m ? +m[0] : 70));
  }
  if (/4 week/.test(q))
    return studies.filter((s) => s.weeks_to_dbl !== null && s.weeks_to_dbl >= 0 && s.weeks_to_dbl <= 4);
  if (/fsp/.test(q)) return studies.filter((s) => s.fso_fsp === 'FSP');
  if (/fso/.test(q)) return studies.filter((s) => s.fso_fsp === 'FSO');
  const clientNames = [...new Set(studies.map((s) => s.client.toLowerCase()))];
  const matchedClient = clientNames.find((c) => q.includes(c) || c.includes(q.split(' ')[0]));
  if (matchedClient) return studies.filter((s) => s.client.toLowerCase() === matchedClient);
  const tas = ['oncology', 'cardiovascular', 'respiratory', 'neurology', 'immunology', 'rare disease', 'hepatology'];
  const matchedTa = tas.find((ta) => q.includes(ta));
  if (matchedTa) return studies.filter((s) => s.ta.toLowerCase() === matchedTa);
  return studies;
}

function StatusBar({ done, inProg, failed, onHold, total }: { done: number; inProg: number; failed: number; onHold: number; total: number }) {
  if (total === 0) return <span className="text-xs" style={{ color: '#8892a4' }}>—</span>;
  const pDone = (done / total) * 100;
  const pIP = (inProg / total) * 100;
  const pFail = (failed / total) * 100;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-2 rounded-full overflow-hidden flex-1 min-w-16" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ width: `${pDone}%`, background: '#1a5c38' }} />
        <div style={{ width: `${pIP}%`, background: '#d97706' }} />
        <div style={{ width: `${pFail}%`, background: '#dc2626' }} />
      </div>
      <span className="text-xs font-medium flex-shrink-0" style={{ color: pDone >= 80 ? '#2ea55e' : pDone >= 40 ? '#d97706' : '#e8eaf0' }}>
        {done}/{total}
        <span className="ml-0.5" style={{ color: '#8892a4' }}>({((done / total) * 100).toFixed(0)}%)</span>
      </span>
    </div>
  );
}

interface DrillDownProps { study: Study; onClose: () => void; effectiveTier: Study['risk_tier']; riskBump: number; }

function DrillDown({ study, onClose, effectiveTier: eTier, riskBump }: DrillDownProps) {
  const bd = study.deliverable_breakdown ?? {};
  const presentTypes = DEL_TYPES.filter((t) => bd[t]);

  const prodChartData = presentTypes.map((t) => {
    const d = bd[t]!;
    return { name: t, Done: d.prod_done, 'In Progress': d.prod_in_progress, 'Not Started': d.prod_not_started, 'On Hold': d.prod_on_hold };
  });
  const qcChartData = presentTypes.map((t) => {
    const d = bd[t]!;
    return { name: t, Passed: d.qc_passed, Failed: d.qc_failed, 'In Progress': d.qc_in_progress, 'Not Started': d.qc_not_started };
  });

  const topFactors = [...study.risk_factors].sort((a, b) => b.value - a.value).slice(0, 4);
  const colStyle = { color: '#8892a4', fontSize: 11, fontWeight: 500 };
  const cellStyle = { color: '#e8eaf0', fontSize: 12 };

  return (
    <div className="rounded-b-lg" style={{ background: '#161b24', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between px-5 py-3" style={{ background: '#1a5c38' }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">{study.study}</span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${RISK_STYLES[eTier]}`}>
            {RISK_EMOJI[eTier]} {eTier}{riskBump > 0 ? ` (+${(riskBump * 100).toFixed(0)}%)` : ''}
          </span>
          <span className="text-xs text-white/60">{study.client} · {study.ta} · {study.fso_fsp}</span>
        </div>
        <button onClick={onClose} className="text-xs px-2 py-1 rounded text-white/60 hover:text-white">✕ Close</button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#2ea55e' }}>Completion by Study</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded" style={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-3 py-2 rounded-t text-xs font-semibold" style={{ background: 'rgba(26,92,56,0.4)', color: '#2ea55e' }}>Production</div>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <th className="text-left px-3 py-1.5" style={colStyle}>Deliverable</th>
                    <th className="text-left px-3 py-1.5" style={colStyle}>Total progress</th>
                    {presentTypes.map((t) => <th key={t} className="px-2 py-1.5 text-center" style={colStyle}>{t}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2 font-medium truncate max-w-24" style={{ color: '#e8eaf0' }}>{study.study}</td>
                    <td className="px-3 py-2" style={{ minWidth: 140 }}>
                      <StatusBar done={Math.round(study.prod_pct / 100 * study.total_del)} inProg={study.total_del - Math.round(study.prod_pct / 100 * study.total_del)} failed={0} onHold={0} total={study.total_del} />
                    </td>
                    {presentTypes.map((t) => {
                      const d = bd[t]!;
                      return (
                        <td key={t} className="px-2 py-2 text-center" style={cellStyle}>
                          {d.prod_done > 0 || d.total > 0 ? <span style={{ color: d.prod_pct >= 80 ? '#2ea55e' : d.prod_pct >= 40 ? '#d97706' : '#e8eaf0' }}>{d.prod_done} ({d.prod_pct}%)</span> : '—'}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="rounded" style={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-3 py-2 rounded-t text-xs font-semibold" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>QC</div>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <th className="text-left px-3 py-1.5" style={colStyle}>Deliverable</th>
                    <th className="text-left px-3 py-1.5" style={colStyle}>Total progress</th>
                    {presentTypes.map((t) => <th key={t} className="px-2 py-1.5 text-center" style={colStyle}>{t}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2 font-medium truncate max-w-24" style={{ color: '#e8eaf0' }}>{study.study}</td>
                    <td className="px-3 py-2" style={{ minWidth: 140 }}>
                      <StatusBar done={Math.round(study.qc_pct / 100 * study.total_del)} inProg={study.failed_qc} failed={study.failed_qc} onHold={0} total={study.total_del} />
                    </td>
                    {presentTypes.map((t) => {
                      const d = bd[t]!;
                      return (
                        <td key={t} className="px-2 py-2 text-center" style={cellStyle}>
                          {d.total > 0 ? <span style={{ color: d.qc_pct >= 80 ? '#2ea55e' : d.qc_pct >= 40 ? '#d97706' : d.qc_failed > 0 ? '#ef4444' : '#e8eaf0' }}>{d.qc_passed} ({d.qc_pct}%)</span> : '—'}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 rounded" style={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs font-bold uppercase tracking-wider px-3 pt-3 pb-1" style={{ color: '#2ea55e' }}>Status Distribution — {presentTypes.length} deliverable types</p>
            <div className="grid grid-cols-2 gap-0 px-2 pb-2">
              <div>
                <p className="text-xs font-medium px-1 pb-1" style={{ color: '#2ea55e' }}>Production</p>
                <ResponsiveContainer width="100%" height={presentTypes.length * 28 + 20}>
                  <BarChart data={prodChartData} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#8892a4', fontSize: 10 }} width={55} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 11 }} labelStyle={{ color: '#e8eaf0' }} />
                    <Bar dataKey="Done" stackId="a" fill="#1a5c38">{prodChartData.map((_, i) => <Cell key={i} fill="#1a5c38" />)}</Bar>
                    <Bar dataKey="In Progress" stackId="a" fill="#d97706">{prodChartData.map((_, i) => <Cell key={i} fill="#d97706" />)}</Bar>
                    <Bar dataKey="Not Started" stackId="a" fill="#374151">{prodChartData.map((_, i) => <Cell key={i} fill="#374151" />)}</Bar>
                    <Bar dataKey="On Hold" stackId="a" fill="#6b7280" radius={[0, 2, 2, 0]}>{prodChartData.map((_, i) => <Cell key={i} fill="#6b7280" />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs font-medium px-1 pb-1" style={{ color: '#3b82f6' }}>QC</p>
                <ResponsiveContainer width="100%" height={presentTypes.length * 28 + 20}>
                  <BarChart data={qcChartData} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#8892a4', fontSize: 10 }} width={55} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 11 }} labelStyle={{ color: '#e8eaf0' }} />
                    <Bar dataKey="Passed" stackId="b" fill="#1a5c38">{qcChartData.map((_, i) => <Cell key={i} fill="#1a5c38" />)}</Bar>
                    <Bar dataKey="Failed" stackId="b" fill="#dc2626">{qcChartData.map((_, i) => <Cell key={i} fill="#dc2626" />)}</Bar>
                    <Bar dataKey="In Progress" stackId="b" fill="#d97706">{qcChartData.map((_, i) => <Cell key={i} fill="#d97706" />)}</Bar>
                    <Bar dataKey="Not Started" stackId="b" fill="#374151" radius={[0, 2, 2, 0]}>{qcChartData.map((_, i) => <Cell key={i} fill="#374151" />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 px-3 pb-2">
              {[{ color: '#1a5c38', label: 'Done / Passed' }, { color: '#d97706', label: 'In Progress' }, { color: '#dc2626', label: 'Failed QC' }, { color: '#374151', label: 'Not Started' }, { color: '#6b7280', label: 'On Hold' }].map((l) => (
                <div key={l.label} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: l.color }} />
                  <span className="text-xs" style={{ color: '#8892a4' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded p-3" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#3b82f6' }}>AI Risk Model</p>
            <div className="space-y-2 mb-3">
              {[{ label: 'AI Risk Score', value: study.ai_risk_score, color: '#3b82f6' }, { label: 'Rule-Based', value: study.risk_score, color: '#8892a4' }].map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs mb-1"><span style={{ color: '#8892a4' }}>{m.label}</span><span style={{ color: m.color }}>{(m.value * 100).toFixed(0)}%</span></div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ width: `${m.value * 100}%`, background: m.color }} /></div>
                </div>
              ))}
            </div>
            <div className="space-y-1 mt-3 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-xs mb-1" style={{ color: '#8892a4' }}>Key metrics</p>
              {[{ label: 'Sig. Delays', value: study.sig_delays }, { label: 'Failed QC', value: study.failed_qc }, { label: 'Wks to DBL', value: study.weeks_to_dbl !== null ? study.weeks_to_dbl.toFixed(1) : 'N/A' }, { label: 'Total del.', value: study.total_del }].map((m) => (
                <div key={m.label} className="flex justify-between text-xs"><span style={{ color: '#8892a4' }}>{m.label}</span><span style={{ color: '#e8eaf0' }}>{m.value}</span></div>
              ))}
            </div>
            {topFactors.length > 0 && (
              <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <p className="text-xs mb-1.5" style={{ color: '#8892a4' }}>Top risk factors</p>
                {topFactors.map((f) => (
                  <div key={f.label} className="mb-1.5">
                    <div className="flex justify-between text-xs mb-0.5"><span style={{ color: '#8892a4' }}>{f.label}</span><span style={{ color: '#3b82f6' }}>{(f.value * 100).toFixed(0)}%</span></div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ width: `${Math.min(f.value * 100, 100)}%`, background: '#3b82f6' }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface EntityStudyPanelProps {
  label: string;
  labelType: string;
  studies: Study[];
  savedUpdates: StudyUpdate[];
  onClose: () => void;
  selectedStudy: string | null;
  onStudySelect: (s: string | null) => void;
}

function EntityStudyPanel({ label, labelType, studies, savedUpdates, onClose, selectedStudy, onStudySelect }: EntityStudyPanelProps) {
  const sorted = [...studies].sort((a, b) => RISK_ORDER[effectiveTier(a, savedUpdates)] - RISK_ORDER[effectiveTier(b, savedUpdates)]);
  const avgProd = studies.length ? studies.reduce((a, s) => a + s.prod_pct, 0) / studies.length : 0;
  const avgQc = studies.length ? studies.reduce((a, s) => a + s.qc_pct, 0) / studies.length : 0;
  const totalFail = studies.reduce((a, s) => a + s.failed_qc, 0);
  const totalDel = studies.reduce((a, s) => a + s.total_del, 0);
  const failPct = totalDel > 0 ? ((totalFail / totalDel) * 100).toFixed(1) : '0';
  const colStyle = { color: '#8892a4', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' };

  const selStudy = selectedStudy ? sorted.find((s) => s.study === selectedStudy) : null;
  const selBump = selStudy ? (savedUpdates.find((u) => u.study === selStudy.study)?.riskBump ?? 0) : 0;

  return (
    <div className="rounded-lg mt-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between px-5 py-3" style={{ background: '#1a5c38', borderRadius: '0.5rem 0.5rem 0 0' }}>
        <div className="flex items-center gap-4">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-white/50">{labelType} view</span>
            <p className="text-sm font-bold text-white">{label}</p>
          </div>
          <div className="flex items-center gap-5 ml-4">
            <div className="text-center"><p className="text-lg font-bold text-white">{studies.length}</p><p className="text-xs text-white/60">Studies</p></div>
            <div className="text-center"><p className="text-lg font-bold" style={{ color: '#86efac' }}>{avgProd.toFixed(1)}%</p><p className="text-xs text-white/60">Avg Prod</p></div>
            <div className="text-center"><p className="text-lg font-bold" style={{ color: '#93c5fd' }}>{avgQc.toFixed(1)}%</p><p className="text-xs text-white/60">Avg QC</p></div>
            <div className="text-center"><p className="text-lg font-bold" style={{ color: totalFail > 0 ? '#fca5a5' : '#86efac' }}>{totalFail} ({failPct}%)</p><p className="text-xs text-white/60">QC Failures</p></div>
            <div className="flex items-center gap-1">
              {(['Critical', 'High', 'Elevated', 'Moderate', 'Low'] as const).map((t) => {
                const cnt = sorted.filter((s) => effectiveTier(s, savedUpdates) === t).length;
                return cnt > 0 ? <span key={t} className={`text-xs px-1.5 py-0.5 rounded-full ${RISK_STYLES[t]}`}>{RISK_EMOJI[t]} {cnt}</span> : null;
              })}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded font-medium text-white/70 hover:text-white" style={{ background: 'rgba(255,255,255,0.1)' }}>✕ Close</button>
      </div>
      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
        <table className="w-full text-xs" style={{ minWidth: 800 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Study', 'TA', 'Type', 'Risk', 'FPI', 'DBL', 'Wks to DBL', 'Prod %', 'QC %', 'QC Fail (n / %)', 'Sig. Delays'].map((h) => (
                <th key={h} className="text-left px-3 py-2 whitespace-nowrap" style={colStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((study) => {
              const eTier = effectiveTier(study, savedUpdates);
              const bump = savedUpdates.find((u) => u.study === study.study)?.riskBump ?? 0;
              const sFail = study.total_del > 0 ? ((study.failed_qc / study.total_del) * 100).toFixed(0) : '0';
              const wkColor = study.weeks_to_dbl !== null && study.weeks_to_dbl <= 4 ? '#ef4444' : study.weeks_to_dbl !== null && study.weeks_to_dbl <= 8 ? '#f97316' : '#8892a4';
              const isSelected = selectedStudy === study.study;
              return (
                <tr
                  key={study.study}
                  className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isSelected ? 'rgba(59,130,246,0.1)' : undefined }}
                  onClick={() => onStudySelect(isSelected ? null : study.study)}
                >
                  <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: isSelected ? '#93c5fd' : '#e8eaf0' }}>
                    {isSelected ? '▶ ' : ''}{study.study}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#8892a4' }}>{study.ta}</td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: study.fso_fsp === 'FSO' ? 'rgba(46,165,94,0.1)' : 'rgba(59,130,246,0.1)', color: study.fso_fsp === 'FSO' ? '#2ea55e' : '#3b82f6' }}>{study.fso_fsp}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${RISK_STYLES[eTier]}`}>
                      {RISK_EMOJI[eTier]} {eTier}{bump > 0 ? ` +${(bump * 100).toFixed(0)}%` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#8892a4' }}>{study.fpi ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#8892a4' }}>{study.dbl ?? '—'}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: wkColor }}>{study.weeks_to_dbl !== null ? study.weeks_to_dbl.toFixed(1) : '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-14 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ width: `${study.prod_pct}%`, background: '#2ea55e' }} /></div>
                      <span style={{ color: study.prod_pct >= 80 ? '#2ea55e' : study.prod_pct >= 40 ? '#d97706' : '#e8eaf0' }}>{study.prod_pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-14 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ width: `${study.qc_pct}%`, background: '#3b82f6' }} /></div>
                      <span style={{ color: study.qc_pct >= 80 ? '#2ea55e' : study.qc_pct >= 40 ? '#d97706' : '#e8eaf0' }}>{study.qc_pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-medium" style={{ color: study.failed_qc > 0 ? '#ef4444' : '#2ea55e' }}>
                    {study.failed_qc > 0 ? `${study.failed_qc} (${sFail}%)` : '0 ✓'}
                  </td>
                  <td className="px-3 py-2" style={{ color: study.sig_delays > 0 ? '#f97316' : '#8892a4' }}>{study.sig_delays}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selStudy && (
        <DrillDown
          study={selStudy}
          onClose={() => onStudySelect(null)}
          effectiveTier={effectiveTier(selStudy, savedUpdates)}
          riskBump={selBump}
        />
      )}
    </div>
  );
}

const DATASET_NAMES: Record<string, string[]> = {
  SDTMs: ['DM','AE','CM','EX','MH','LB','VS','EG','DS','SV','TA','TE','TI','TS','TV','QS','FA','PR','SK','SS','SU','TU','DA','DD','ML','IE','PE','RE','SE','TR'],
  ADaMs: ['ADSL','ADAE','ADCM','ADMH','ADLB','ADVS','ADEG','ADTTE','ADRS','ADTR','ADPC','ADPP','ADEX','ADIS'],
  Tables: ['T-14-1-1','T-14-1-2','T-14-2-1','T-14-2-2','T-14-3-1','T-14-3-2','T-14-4-1','T-14-5-1','T-14-6-1','T-14-7-1','T-14-8-1','T-14-8-2'],
  Listings: ['L-14-1-1','L-14-2-1','L-14-2-2','L-14-3-1','L-14-4-1','L-14-5-1','L-14-6-1','L-14-7-1'],
  Figures: ['F-12-1-1','F-12-2-1','F-14-1-1','F-14-2-1','F-14-3-1','F-14-4-1'],
};

type GranularRow = {
  client: string; portfolio: string; study: string;
  fpi: string | null; dbl: string | null;
  deliverableType: string; dataset: string;
  prodStatus: string; qcStatus: string;
};

function generateGranularRows(study: Study): GranularRow[] {
  const rows: GranularRow[] = [];
  const bd = study.deliverable_breakdown ?? {};
  DEL_TYPES.forEach((delType) => {
    const d = bd[delType];
    if (!d || d.total === 0) return;
    const names = DATASET_NAMES[delType] ?? [];
    let prodDoneLeft = d.prod_done;
    let prodIPLeft = d.prod_in_progress;
    let qcPassedLeft = d.qc_passed;
    let qcFailedLeft = d.qc_failed;
    let qcIPLeft = d.qc_in_progress;
    for (let i = 0; i < d.total; i++) {
      const suffix = i >= names.length ? `-${Math.floor(i / names.length) + 1}` : '';
      const dataset = (names[i % names.length] ?? `${delType}-${i + 1}`) + suffix;
      let prodStatus: string;
      if (prodDoneLeft > 0) { prodStatus = 'Ready for QC'; prodDoneLeft--; }
      else if (prodIPLeft > 0) { prodStatus = 'In Progress'; prodIPLeft--; }
      else { prodStatus = 'Not Started'; }
      let qcStatus: string;
      if (qcPassedLeft > 0 && (prodStatus === 'Ready for QC' || prodStatus === 'Completed')) { qcStatus = 'Passed QC'; qcPassedLeft--; }
      else if (qcFailedLeft > 0 && (prodStatus === 'Ready for QC' || prodStatus === 'Completed')) { qcStatus = 'Failed QC'; qcFailedLeft--; }
      else if (qcIPLeft > 0) { qcStatus = 'In Progress'; qcIPLeft--; }
      else { qcStatus = 'Not Started'; }
      rows.push({ client: study.client, portfolio: study.portfolio, study: study.study, fpi: study.fpi, dbl: study.dbl, deliverableType: delType, dataset, prodStatus, qcStatus });
    }
  });
  return rows;
}

type DelRow = {
  client: string; portfolio: string; study: string;
  fpi: string | null; dbl: string | null;
  deliverable: string; total: number;
  prodDone: number; prodPct: number; prodStatus: string;
  qcPassed: number; qcFailed: number; qcPct: number; qcStatus: string;
};

function deriveDelRows(studies: Study[]): DelRow[] {
  const rows: DelRow[] = [];
  studies.forEach((s) => {
    const bd = s.deliverable_breakdown ?? {};
    DEL_TYPES.forEach((t) => {
      const d = bd[t];
      if (!d || d.total === 0) return;
      let prodStatus = 'Not Started';
      if (d.prod_done === d.total) prodStatus = 'Completed';
      else if (d.prod_in_progress > 0) prodStatus = 'In Progress';
      else if (d.prod_done > 0) prodStatus = 'Ready for QC';
      let qcStatus = 'Not Started';
      if (d.qc_failed > 0) qcStatus = 'Failed QC';
      else if (d.qc_passed >= d.total * 0.9 && d.total > 0) qcStatus = 'Passed QC';
      else if (d.qc_in_progress > 0 || d.qc_passed > 0) qcStatus = 'In Progress';
      rows.push({
        client: s.client, portfolio: s.portfolio, study: s.study,
        fpi: s.fpi, dbl: s.dbl, deliverable: t, total: d.total,
        prodDone: d.prod_done, prodPct: d.prod_pct, prodStatus,
        qcPassed: d.qc_passed, qcFailed: d.qc_failed, qcPct: d.qc_pct, qcStatus,
      });
    });
  });
  return rows;
}

const STATUS_COLORS: Record<string, string> = {
  'Completed': '#2ea55e', 'Ready for QC': '#3b82f6',
  'In Progress': '#d97706', 'Not Started': '#6b7280',
  'Passed QC': '#2ea55e', 'Failed QC': '#ef4444',
};

interface AllRecordsPanelProps {
  label: string;
  labelType?: string;
  studies: Study[];
  filterStudy?: string | null;
  granularMode?: boolean;
  onClear?: () => void;
  onGranularToggle?: () => void;
}

function AllRecordsPanel({ label, labelType, studies, filterStudy, granularMode, onClear, onGranularToggle }: AllRecordsPanelProps) {
  const [search, setSearch] = useState('');

  const sourceStudies = useMemo(
    () => (filterStudy ? studies.filter((s) => s.study === filterStudy) : studies),
    [studies, filterStudy]
  );

  const aggRows = useMemo(() => deriveDelRows(sourceStudies), [sourceStudies]);

  const granRows = useMemo((): GranularRow[] => {
    if (!granularMode || !filterStudy) return [];
    const sel = sourceStudies.find((s) => s.study === filterStudy);
    return sel ? generateGranularRows(sel) : [];
  }, [granularMode, filterStudy, sourceStudies]);

  const isGranular = !!granularMode && !!filterStudy;

  const filteredAgg = useMemo(() => {
    if (!search.trim()) return aggRows;
    const q = search.toLowerCase();
    return aggRows.filter((r) =>
      r.study.toLowerCase().includes(q) ||
      r.client.toLowerCase().includes(q) ||
      r.deliverable.toLowerCase().includes(q) ||
      r.prodStatus.toLowerCase().includes(q) ||
      r.qcStatus.toLowerCase().includes(q)
    );
  }, [aggRows, search]);

  const filteredGran = useMemo(() => {
    if (!search.trim()) return granRows;
    const q = search.toLowerCase();
    return granRows.filter((r) =>
      r.study.toLowerCase().includes(q) ||
      r.client.toLowerCase().includes(q) ||
      r.deliverableType.toLowerCase().includes(q) ||
      r.dataset.toLowerCase().includes(q) ||
      r.prodStatus.toLowerCase().includes(q) ||
      r.qcStatus.toLowerCase().includes(q)
    );
  }, [granRows, search]);

  const totalRows = isGranular ? filteredGran.length : filteredAgg.length;
  const failRows = isGranular
    ? filteredGran.filter((r) => r.qcStatus === 'Failed QC').length
    : filteredAgg.filter((r) => r.qcStatus === 'Failed QC').length;
  const passRows = isGranular
    ? filteredGran.filter((r) => r.qcStatus === 'Passed QC').length
    : filteredAgg.filter((r) => r.qcStatus === 'Passed QC').length;
  const completedRows = isGranular
    ? filteredGran.filter((r) => r.prodStatus === 'Ready for QC').length
    : filteredAgg.filter((r) => r.prodStatus === 'Completed').length;

  const colStyle = { color: '#8892a4', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' };
  const inputStyle = { background: '#1c2230', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' };

  return (
    <div className="rounded-lg mt-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between px-5 py-3 flex-wrap gap-2" style={{ background: '#1a5c38', borderRadius: '0.5rem 0.5rem 0 0' }}>
        <div className="flex items-center gap-4">
          <div>
            {labelType && <span className="text-xs font-medium uppercase tracking-wider text-white/50">{labelType}</span>}
            <p className="text-sm font-bold text-white">
              All Records{label !== 'All Records' ? ` — ${label}` : ''}
              {filterStudy && <span className="ml-2 text-white/60 font-normal text-xs">· {filterStudy}</span>}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center"><p className="text-base font-bold text-white">{totalRows}</p><p className="text-xs text-white/60">Records</p></div>
            <div className="text-center"><p className="text-base font-bold" style={{ color: '#86efac' }}>{completedRows}</p><p className="text-xs text-white/60">Prod Done</p></div>
            <div className="text-center"><p className="text-base font-bold" style={{ color: '#93c5fd' }}>{passRows}</p><p className="text-xs text-white/60">QC Passed</p></div>
            <div className="text-center"><p className="text-base font-bold" style={{ color: failRows > 0 ? '#fca5a5' : '#86efac' }}>{failRows}</p><p className="text-xs text-white/60">QC Failed</p></div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {filterStudy && onGranularToggle && (
            <div className="flex items-center gap-1 rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
              <button
                onClick={() => isGranular && onGranularToggle()}
                className="text-xs px-2.5 py-1 font-medium"
                style={{ background: !isGranular ? 'rgba(255,255,255,0.2)' : 'transparent', color: !isGranular ? '#fff' : 'rgba(255,255,255,0.5)' }}
              >
                Aggregated
              </button>
              <button
                onClick={() => !isGranular && onGranularToggle()}
                className="text-xs px-2.5 py-1 font-medium"
                style={{ background: isGranular ? '#3b82f6' : 'transparent', color: isGranular ? '#fff' : 'rgba(255,255,255,0.5)' }}
              >
                Granular
              </button>
            </div>
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records…"
            className="text-xs rounded px-3 py-1.5 border outline-none w-44"
            style={inputStyle}
          />
          {onClear && (
            <button onClick={onClear} className="text-xs px-3 py-1.5 rounded font-medium text-white/70 hover:text-white" style={{ background: 'rgba(255,255,255,0.15)' }}>
              ✕ Clear filter
            </button>
          )}
        </div>
      </div>

      <div style={{ maxHeight: '380px', overflowY: 'auto', overflowX: 'auto' }}>
        {isGranular ? (
          <table className="w-full text-xs" style={{ minWidth: 800 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Client', 'Portfolio', 'Study', 'FPI', 'DBL', 'Del. Type', 'Dataset', 'Prod Status', 'QC Status'].map((h) => (
                  <th key={h} className="text-left px-3 py-2 whitespace-nowrap" style={colStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredGran.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-sm" style={{ color: '#8892a4' }}>No records match.</td></tr>
              ) : filteredGran.map((r, i) => (
                <tr key={`gran-${r.study}-${r.deliverableType}-${r.dataset}-${i}`} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#8892a4' }}>{r.client}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#6b7280', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.portfolio}</td>
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap" style={{ color: '#e8eaf0' }}>{r.study}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#8892a4' }}>{r.fpi ?? '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#8892a4' }}>{r.dbl ?? '—'}</td>
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap" style={{ color: '#8892a4' }}>{r.deliverableType}</td>
                  <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: '#e8eaf0' }}>{r.dataset}</td>
                  <td className="px-3 py-1.5">
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: STATUS_COLORS[r.prodStatus] ?? '#6b7280', background: `${STATUS_COLORS[r.prodStatus] ?? '#6b7280'}18` }}>
                      {r.prodStatus}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: STATUS_COLORS[r.qcStatus] ?? '#6b7280', background: `${STATUS_COLORS[r.qcStatus] ?? '#6b7280'}18` }}>
                      {r.qcStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs" style={{ minWidth: 900 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Client', 'Portfolio', 'Study', 'FPI', 'DBL', 'Deliverable', 'Total', 'Prod Done', 'Prod %', 'Prod Status', 'QC Passed', 'QC Failed', 'QC %', 'QC Status'].map((h) => (
                  <th key={h} className="text-left px-3 py-2 whitespace-nowrap" style={colStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAgg.length === 0 ? (
                <tr><td colSpan={14} className="px-3 py-6 text-center text-sm" style={{ color: '#8892a4' }}>No records match.</td></tr>
              ) : filteredAgg.map((r, i) => (
                <tr key={`${r.study}-${r.deliverable}-${i}`} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#8892a4' }}>{r.client}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs" style={{ color: '#6b7280', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.portfolio}</td>
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap" style={{ color: '#e8eaf0' }}>{r.study}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#8892a4' }}>{r.fpi ?? '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#8892a4' }}>{r.dbl ?? '—'}</td>
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap" style={{ color: '#e8eaf0' }}>{r.deliverable}</td>
                  <td className="px-3 py-1.5 text-center" style={{ color: '#8892a4' }}>{r.total}</td>
                  <td className="px-3 py-1.5 text-center" style={{ color: r.prodDone === r.total ? '#2ea55e' : '#8892a4' }}>{r.prodDone}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-10 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${r.prodPct}%`, background: '#2ea55e' }} />
                      </div>
                      <span style={{ color: r.prodPct >= 80 ? '#2ea55e' : r.prodPct >= 40 ? '#d97706' : '#e8eaf0' }}>{r.prodPct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: STATUS_COLORS[r.prodStatus] ?? '#6b7280', background: `${STATUS_COLORS[r.prodStatus] ?? '#6b7280'}18` }}>
                      {r.prodStatus}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-center" style={{ color: r.qcPassed > 0 ? '#2ea55e' : '#8892a4' }}>{r.qcPassed}</td>
                  <td className="px-3 py-1.5 text-center font-medium" style={{ color: r.qcFailed > 0 ? '#ef4444' : '#8892a4' }}>{r.qcFailed > 0 ? r.qcFailed : '—'}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-10 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${r.qcPct}%`, background: '#3b82f6' }} />
                      </div>
                      <span style={{ color: r.qcPct >= 80 ? '#2ea55e' : r.qcPct >= 40 ? '#d97706' : '#e8eaf0' }}>{r.qcPct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: STATUS_COLORS[r.qcStatus] ?? '#6b7280', background: `${STATUS_COLORS[r.qcStatus] ?? '#6b7280'}18` }}>
                      {r.qcStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export default function ResultsTab({ studies, savedUpdates = [] }: { studies: Study[]; savedUpdates?: StudyUpdate[] }) {
  const [allStudies, setAllStudies] = useState(true);
  const [allClients, setAllClients] = useState(true);
  const [allPortfolios, setAllPortfolios] = useState(true);
  const [clientScopeFilter, setClientScopeFilter] = useState('All');
  const [portfolioFilter, setPortfolioFilter] = useState('All');
  const [snapshotDate, setSnapshotDate] = useState(SNAPSHOT_DATES[0]);
  const [onlyStarted, setOnlyStarted] = useState(false);
  const [nlqInput, setNlqInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [nlqLoading, setNlqLoading] = useState(false);
  const [nlqActive, setNlqActive] = useState(false);
  const [nlqQuery, setNlqQuery] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [clientTableFilter, setClientTableFilter] = useState('All');
  const [sortMode, setSortMode] = useState<'severity' | 'score'>('severity');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedStudy, setExpandedStudy] = useState<string | null>(null);
  const [downloadToast, setDownloadToast] = useState(false);
  const [focusedEntity, setFocusedEntity] = useState<{ type: 'client' | 'portfolio'; value: string } | null>(null);
  const [selectedStudy, setSelectedStudy] = useState<string | null>(null);
  const [granularMode, setGranularMode] = useState(false);
  const [fsoFspFilter, setFsoFspFilter] = useState<'All' | 'FSO' | 'FSP'>('All');

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
      if (fsoFspFilter !== 'All' && s.fso_fsp !== fsoFspFilter) return false;
      return true;
    });
  }, [studies, allStudies, allClients, clientScopeFilter, allPortfolios, portfolioFilter, onlyStarted, fsoFspFilter]);

  const nlqFiltered = useMemo(() => {
    if (!nlqActive || !nlqQuery) return sidebarFiltered;
    return filterByNlq(nlqQuery, sidebarFiltered);
  }, [sidebarFiltered, nlqActive, nlqQuery]);

  const tableFiltered = useMemo(() => {
    let filtered = nlqFiltered;
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      filtered = filtered.filter((s) => s.study.toLowerCase().includes(q) || s.client.toLowerCase().includes(q));
    }
    if (clientTableFilter !== 'All') {
      filtered = filtered.filter((s) => s.client === clientTableFilter);
    }
    if (focusedEntity) {
      filtered = filtered.filter((s) =>
        focusedEntity.type === 'client' ? s.client === focusedEntity.value : s.portfolio === focusedEntity.value
      );
    }
    return filtered;
  }, [nlqFiltered, tableSearch, clientTableFilter, focusedEntity]);

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
            ? RISK_ORDER[effectiveTier(a, savedUpdates)] - RISK_ORDER[effectiveTier(b, savedUpdates)]
            : effectiveScore(b, savedUpdates) - effectiveScore(a, savedUpdates)
        );
        const worstRiskOrder = Math.min(...clientStudies.map((s) => RISK_ORDER[effectiveTier(s, savedUpdates)]));
        const avgScore = clientStudies.reduce((sum, s) => sum + effectiveScore(s, savedUpdates), 0) / clientStudies.length;
        return { client, studies: sorted, worstRiskOrder, avgScore };
      })
      .sort((a, b) =>
        sortMode === 'severity' ? a.worstRiskOrder - b.worstRiskOrder : b.avgScore - a.avgScore
      );
  }, [tableFiltered, sortMode, savedUpdates]);

  const delayed = sidebarFiltered.filter((s) => s.delayed).length;
  const atRisk = sidebarFiltered.filter((s) => s.at_risk).length;
  const avgProd = sidebarFiltered.length > 0 ? sidebarFiltered.reduce((a, s) => a + s.prod_pct, 0) / sidebarFiltered.length : 0;
  const avgQc = sidebarFiltered.length > 0 ? sidebarFiltered.reduce((a, s) => a + s.qc_pct, 0) / sidebarFiltered.length : 0;

  const handleReset = () => {
    setFocusedEntity(null);
    setSelectedStudy(null);
    setGranularMode(false);
    setExpandedStudy(null);
    setFsoFspFilter('All');
    setNlqActive(false);
    setNlqQuery('');
    setClientTableFilter('All');
    setTableSearch('');
  };

  const toggleClient = (client: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(client)) next.delete(client); else next.add(client);
      return next;
    });
  };

  const handleNlq = async (q?: string) => {
    const query = q ?? nlqInput;
    if (!query.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content: query };
    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);
    setNlqInput('');
    setNlqLoading(true);
    setNlqActive(true);
    setNlqQuery(query);
    try {
      const context = `Total studies: ${studies.length}, Delayed: ${delayed}, At-risk: ${atRisk}, Avg prod: ${avgProd.toFixed(1)}%, Avg QC: ${avgQc.toFixed(1)}%, Clients: ${clients.slice(1).join(', ')}`;
      const res = await fetch('/api/nlq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context, history: chatHistory }),
      });
      const data = await res.json();
      setChatHistory([...updatedHistory, { role: 'assistant', content: data.response }]);
    } catch {
      setChatHistory([...updatedHistory, { role: 'assistant', content: 'Unable to process query.' }]);
    } finally {
      setNlqLoading(false);
    }
  };

  const clearNlq = () => {
    setNlqActive(false);
    setNlqQuery('');
    setChatHistory([]);
    setNlqInput('');
  };

  const QUICK_CHIPS = ['High-risk studies', 'Delayed studies', 'QC below 70%', 'Within 4 weeks of DBL'];

  const activeStudyFilter = selectedStudy ?? expandedStudy;

  return (
    <div className="flex" style={{ minHeight: 'calc(100vh - 112px)' }}>
      {downloadToast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm" style={{ background: '#2ea55e', color: '#fff' }}>
          ↓ Report download coming soon
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 p-4 border-r flex flex-col gap-4" style={{ background: '#1c2230', borderColor: 'rgba(255,255,255,0.07)' }}>
        <div>
          <p className="text-xs font-bold mb-3 uppercase tracking-widest" style={{ color: '#2ea55e' }}>SCOPE</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allStudies} onChange={(e) => setAllStudies(e.target.checked)} className="accent-green-500" />
              <span className="text-sm" style={{ color: '#e8eaf0' }}>All studies</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allClients} onChange={(e) => { setAllClients(e.target.checked); if (e.target.checked) setClientScopeFilter('All'); }} className="accent-green-500" />
              <span className="text-sm" style={{ color: '#e8eaf0' }}>All clients</span>
            </label>
            {!allClients && (
              <select value={clientScopeFilter} onChange={(e) => setClientScopeFilter(e.target.value)} className="w-full text-xs rounded px-2 py-1.5 border ml-4" style={{ background: '#0d1117', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' }}>
                {clients.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allPortfolios} onChange={(e) => { setAllPortfolios(e.target.checked); if (e.target.checked) setPortfolioFilter('All'); }} className="accent-green-500" />
              <span className="text-sm" style={{ color: '#e8eaf0' }}>All portfolios</span>
            </label>
            {!allPortfolios && (
              <div className="flex flex-col gap-1.5 ml-4 mt-1">
                {portfolios.map((p) => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="portfolio" checked={portfolioFilter === p} onChange={() => {
                      setPortfolioFilter(p);
                      setFocusedEntity({ type: 'portfolio', value: p });
                    }} className="accent-green-500" />
                    <span className="text-xs" style={{ color: portfolioFilter === p ? '#2ea55e' : '#e8eaf0' }}>{p.replace(' Portfolio', '')}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
        <div>
          <p className="text-xs font-bold mb-3 uppercase tracking-widest" style={{ color: '#2ea55e' }}>TIME</p>
          <div className="flex flex-col gap-2">
            <select value={snapshotDate} onChange={(e) => setSnapshotDate(e.target.value)} className="w-full text-xs rounded px-2 py-1.5 border" style={{ background: '#0d1117', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' }}>
              {SNAPSHOT_DATES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" checked={onlyStarted} onChange={(e) => setOnlyStarted(e.target.checked)} className="accent-green-500" />
              <span className="text-xs" style={{ color: '#e8eaf0' }}>Only started studies</span>
            </label>
            <button onClick={() => { setDownloadToast(true); setTimeout(() => setDownloadToast(false), 2500); }} className="w-full text-xs py-2 rounded mt-2" style={{ background: 'rgba(46,165,94,0.1)', color: '#2ea55e', border: '1px solid rgba(46,165,94,0.3)' }}>
              ↓ Download Report
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 space-y-4 min-w-0">
        {/* NLQ Chat Card */}
        <div className="rounded-lg" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8892a4' }}>Portfolio Query</p>
            {chatHistory.length > 0 && (
              <button onClick={clearNlq} className="text-xs px-2 py-0.5 rounded" style={{ color: '#8892a4', background: 'rgba(255,255,255,0.05)' }}>Clear chat</button>
            )}
          </div>
          {chatHistory.length > 0 && (
            <div className="px-4 pb-2 space-y-2 max-h-48 overflow-y-auto">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="text-xs px-3 py-2 rounded-lg max-w-[85%]"
                    style={msg.role === 'user'
                      ? { background: 'rgba(46,165,94,0.15)', color: '#e8eaf0', border: '1px solid rgba(46,165,94,0.25)' }
                      : { background: 'rgba(59,130,246,0.08)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}>
                    {msg.content}
                    {msg.role === 'assistant' && i === chatHistory.length - 1 && nlqActive && (
                      <span className="ml-2 text-xs" style={{ color: '#8892a4' }}>· {tableFiltered.length} studies shown</span>
                    )}
                  </div>
                </div>
              ))}
              {nlqLoading && (
                <div className="flex justify-start">
                  <div className="text-xs px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: 'rgba(59,130,246,0.08)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: '#3b82f6', borderTopColor: 'transparent' }} />
                    Analyzing…
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="px-4 pb-3">
            <div className="flex gap-2 mb-2">
              <input type="text" value={nlqInput} onChange={(e) => setNlqInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleNlq()} placeholder={chatHistory.length > 0 ? 'Continue the conversation…' : 'Ask about your portfolio…'} className="flex-1 text-sm rounded px-3 py-2 border outline-none" style={{ background: '#1c2230', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' }} />
              <button onClick={() => handleNlq()} disabled={nlqLoading} className="px-4 py-2 rounded text-sm font-medium" style={{ background: '#2ea55e', color: '#fff', opacity: nlqLoading ? 0.6 : 1 }}>
                {nlqLoading ? '…' : chatHistory.length > 0 ? 'Send' : 'Ask'}
              </button>
            </div>
            {chatHistory.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {QUICK_CHIPS.map((chip) => (
                  <button key={chip} onClick={() => { setNlqInput(chip); handleNlq(chip); }} className="text-xs px-3 py-1 rounded-full border" style={{ borderColor: 'rgba(46,165,94,0.4)', color: '#2ea55e', background: 'rgba(46,165,94,0.08)' }}>
                    {chip}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-5 gap-3">
          <div className="rounded-lg p-4 text-center" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-2xl font-bold" style={{ color: '#e8eaf0' }}>{sidebarFiltered.length}</div>
            <div className="text-xs mt-1" style={{ color: '#8892a4' }}>Total Studies</div>
          </div>
          <div className="rounded-lg p-4 text-center" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-2xl font-bold" style={{ color: '#dc2626' }}>{delayed}</div>
            <div className="text-xs mt-1" style={{ color: '#8892a4' }}>Delayed</div>
          </div>
          <div className="rounded-lg p-4 text-center" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-2xl font-bold" style={{ color: '#f97316' }}>{atRisk}</div>
            <div className="text-xs mt-1" style={{ color: '#8892a4' }}>At-Risk</div>
          </div>
          <div className="rounded-lg px-4 pt-3 pb-2" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-end justify-between mb-1">
              <div className="text-2xl font-bold" style={{ color: '#2ea55e' }}>{avgProd.toFixed(1)}%</div>
              <span className="text-xs mb-1" style={{ color: TREND_DELTA_PROD >= 0 ? '#22c55e' : '#ef4444' }}>{TREND_DELTA_PROD >= 0 ? '↑' : '↓'} {Math.abs(TREND_DELTA_PROD)}% vs prev</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ width: `${Math.min(avgProd, 100)}%`, background: '#2ea55e' }} /></div>
            <div className="text-xs" style={{ color: '#8892a4' }}>Production Done</div>
          </div>
          <div className="rounded-lg px-4 pt-3 pb-2" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-end justify-between mb-1">
              <div className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{avgQc.toFixed(1)}%</div>
              <span className="text-xs mb-1" style={{ color: TREND_DELTA_QC >= 0 ? '#22c55e' : '#ef4444' }}>{TREND_DELTA_QC >= 0 ? '↑' : '↓'} {Math.abs(TREND_DELTA_QC)}% vs prev</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ width: `${Math.min(avgQc, 100)}%`, background: '#3b82f6' }} /></div>
            <div className="text-xs" style={{ color: '#8892a4' }}>QC Done</div>
          </div>
        </div>

        {/* Completion Over Time */}
        <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Completion Over Time</p>
            <span className="text-xs" style={{ color: '#8892a4' }}>{SNAPSHOT_DATES.length} Snapshot dates ▼</span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={TREND_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
              <YAxis domain={[50, 80]} tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }} labelStyle={{ color: '#e8eaf0', marginBottom: 4 }} itemStyle={{ color: '#8892a4' }} formatter={(value) => [`${value}%`]} />
              <Legend wrapperStyle={{ color: '#8892a4', fontSize: 12, paddingTop: 8 }} />
              <Line type="monotone" dataKey="prod_pct" name="Production" stroke="#2ea55e" strokeWidth={2} dot={{ fill: '#2ea55e', r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="qc_pct" name="QC" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Completion % by Study */}
        <div className="rounded-lg" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between p-4 pb-2">
            <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>
              Completion % by Study
              <span className="ml-2 text-xs font-normal" style={{ color: '#8892a4' }}>({tableFiltered.length} studies)</span>
            </p>
            <div className="flex items-center gap-2">
              <input type="text" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Search…" className="text-sm rounded px-3 py-1.5 border outline-none w-40" style={{ background: '#1c2230', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' }} />
              <select value={clientTableFilter} onChange={(e) => setClientTableFilter(e.target.value)} className="text-xs rounded px-2 py-1.5 border" style={{ background: '#1c2230', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' }}>
                <option value="All">Filter by Client</option>
                {clients.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Toolbar: sort + FSO/FSP + reset */}
          <div className="px-4 pb-3 flex items-center gap-2 pt-2 flex-wrap">
            <span className="text-xs" style={{ color: '#8892a4' }}>Sort:</span>
            {(['severity', 'score'] as const).map((mode) => (
              <button key={mode} onClick={() => { setSortMode(mode); setExpandedClients(new Set(tableFiltered.map((s) => s.client))); }}
                className="text-xs px-3 py-1 rounded font-medium"
                style={{ background: sortMode === mode ? '#2ea55e' : 'rgba(255,255,255,0.05)', color: sortMode === mode ? '#fff' : '#8892a4' }}>
                {mode === 'severity' ? 'Risk Severity' : 'Risk Score'}
              </button>
            ))}
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: 16, margin: '0 2px' }} />
            <span className="text-xs" style={{ color: '#8892a4' }}>Type:</span>
            {(['All', 'FSO', 'FSP'] as const).map((f) => (
              <button key={f} onClick={() => setFsoFspFilter(f)}
                className="text-xs px-3 py-1 rounded font-medium"
                style={{ background: fsoFspFilter === f ? '#3b82f6' : 'rgba(255,255,255,0.05)', color: fsoFspFilter === f ? '#fff' : '#8892a4' }}>
                {f}
              </button>
            ))}
            <button
              onClick={handleReset}
              className="text-xs px-3 py-1 rounded font-medium ml-auto"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              ↺ Reset All
            </button>
          </div>

          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {groupedByClient.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: '#8892a4' }}>No studies match the current filters.</div>
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
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                    onClick={() => {
                      toggleClient(client);
                      setFocusedEntity((prev) => prev?.type === 'client' && prev.value === client ? null : { type: 'client', value: client });
                      setSelectedStudy(null);
                    }}
                    style={{ background: focusedEntity?.value === client ? 'rgba(46,165,94,0.08)' : isExpanded ? 'rgba(46,165,94,0.04)' : 'transparent' }}
                  >
                    <span className="text-xs font-bold w-4" style={{ color: '#3b82f6' }}>{isExpanded ? '▼' : '▶'}</span>
                    <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: '#e8eaf0' }}>{client}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: '#8892a4' }}>{clientStudies.length} {clientStudies.length === 1 ? 'study' : 'studies'}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: '#8892a4' }}>
                      <span style={{ color: '#2ea55e' }}>Prod {cAvgProd.toFixed(0)}%</span>
                      {' | '}
                      <span style={{ color: '#3b82f6' }}>QC {cAvgQc.toFixed(0)}%</span>
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(['Critical', 'High', 'Elevated', 'Moderate', 'Low'] as const).filter((t) => riskCounts[t]).map((tier) => (
                        <span key={tier} className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${RISK_STYLES[tier]}`}>
                          {RISK_EMOJI[tier]} {riskCounts[tier]}
                        </span>
                      ))}
                    </div>
                  </div>

                  {isExpanded && clientStudies.map((study) => {
                    const eTier = effectiveTier(study, savedUpdates);
                    const bump = savedUpdates.find((u) => u.study === study.study)?.riskBump ?? 0;
                    const ms = nextUpcomingMilestone(study, savedUpdates);
                    return (
                      <div key={study.study}>
                        <div
                          className="flex items-center gap-3 px-4 py-2 cursor-pointer border-t"
                          style={{ borderColor: 'rgba(255,255,255,0.04)', background: expandedStudy === study.study ? 'rgba(59,130,246,0.04)' : 'rgba(255,255,255,0.015)', paddingLeft: '2.5rem' }}
                          onClick={() => setExpandedStudy(expandedStudy === study.study ? null : study.study)}
                        >
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${RISK_STYLES[eTier]}`}>
                            {RISK_EMOJI[eTier]} {eTier}
                          </span>
                          {bump > 0 && <span className="text-xs flex-shrink-0 font-medium" style={{ color: '#ef4444' }}>+{(bump * 100).toFixed(0)}%</span>}
                          {ms && <span className="text-xs flex-shrink-0" title={ms.type} style={{ color: '#8892a4' }}>📅 {ms.date}</span>}
                          <span className="text-sm flex-1 min-w-0 truncate" style={{ color: '#e8eaf0' }}>{study.study}</span>
                          <span className="text-xs flex-shrink-0" style={{ color: '#8892a4' }}>{study.ta}</span>
                          <span className="text-xs flex-shrink-0 px-1.5 py-0.5 rounded" style={{ background: study.fso_fsp === 'FSO' ? 'rgba(46,165,94,0.1)' : 'rgba(59,130,246,0.1)', color: study.fso_fsp === 'FSO' ? '#2ea55e' : '#3b82f6' }}>{study.fso_fsp}</span>
                          <div className="flex items-center gap-2 flex-shrink-0 w-48">
                            <div className="flex-1">
                              <div className="flex justify-between text-xs mb-0.5"><span style={{ color: '#8892a4' }}>P</span><span style={{ color: '#2ea55e' }}>{study.prod_pct.toFixed(0)}%</span></div>
                              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ width: `${study.prod_pct}%`, background: '#2ea55e' }} /></div>
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between text-xs mb-0.5"><span style={{ color: '#8892a4' }}>Q</span><span style={{ color: '#3b82f6' }}>{study.qc_pct.toFixed(0)}%</span></div>
                              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ width: `${study.qc_pct}%`, background: '#3b82f6' }} /></div>
                            </div>
                          </div>
                          {study.failed_qc > 0 && <span className="text-xs flex-shrink-0 font-medium" title="QC Failures" style={{ color: '#ef4444' }}>{study.failed_qc}✗</span>}
                          <span className="text-xs flex-shrink-0" style={{ color: '#8892a4' }}>{study.dbl ?? '—'}</span>
                          <span className="text-xs flex-shrink-0" style={{ color: expandedStudy === study.study ? '#93c5fd' : '#8892a4' }}>
                            {expandedStudy === study.study ? '▲ hide' : '▼ detail'}
                          </span>
                        </div>
                        {expandedStudy === study.study && (
                          <DrillDown study={study} onClose={() => setExpandedStudy(null)} effectiveTier={eTier} riskBump={bump} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Entity study-level panel */}
        {focusedEntity && (
          <EntityStudyPanel
            label={focusedEntity.value}
            labelType={focusedEntity.type}
            studies={tableFiltered}
            savedUpdates={savedUpdates}
            selectedStudy={selectedStudy}
            onStudySelect={(s) => { setSelectedStudy(s); if (!s) setGranularMode(false); }}
            onClose={() => {
              setFocusedEntity(null);
              setSelectedStudy(null);
              setGranularMode(false);
              if (focusedEntity.type === 'portfolio') { setPortfolioFilter('All'); setAllPortfolios(true); }
            }}
          />
        )}

        {/* All Records */}
        <AllRecordsPanel
          label={focusedEntity ? focusedEntity.value : 'All Records'}
          labelType={focusedEntity?.type}
          studies={tableFiltered}
          filterStudy={activeStudyFilter}
          granularMode={granularMode}
          onGranularToggle={() => setGranularMode((g) => !g)}
          onClear={focusedEntity ? () => {
            setFocusedEntity(null);
            setSelectedStudy(null);
            setGranularMode(false);
            if (focusedEntity.type === 'portfolio') { setPortfolioFilter('All'); setAllPortfolios(true); }
          } : undefined}
        />
      </main>
    </div>
  );
}
