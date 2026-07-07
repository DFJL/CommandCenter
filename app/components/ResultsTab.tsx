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

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center ml-1 cursor-help" style={{ color: '#6b7280', fontSize: 9 }}>
      ⓘ
      <span className="absolute bottom-full left-1/2 pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ transform: 'translateX(-50%)', marginBottom: 4, background: '#1c2230', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '4px 8px', color: '#e8eaf0', fontSize: 10, whiteSpace: 'nowrap', minWidth: 180, maxWidth: 260, lineHeight: 1.4 }}>
        {text}
      </span>
    </span>
  );
}

function scoreTier(score: number): Study['risk_tier'] {
  if (score > 0.8) return 'Critical';
  if (score > 0.6) return 'High';
  if (score > 0.4) return 'Elevated';
  if (score > 0.2) return 'Moderate';
  return 'Low';
}

function computeAiScore(study: Study): number {
  // Schedule pressure — exponential cliff near DBL
  const schedPressure = (() => {
    if (study.weeks_to_dbl === null) return 0.25;
    if (study.weeks_to_dbl < 0) return 1.0;
    if (study.weeks_to_dbl <= 4) return 0.75 + (4 - study.weeks_to_dbl) * 0.05;
    if (study.weeks_to_dbl <= 8) return 0.45 + (8 - study.weeks_to_dbl) * 0.075;
    return Math.max(0.05, 0.35 - (study.weeks_to_dbl - 8) * 0.006);
  })();
  const qcGap = study.qc_pct < 80 ? Math.pow((80 - study.qc_pct) / 80, 0.7) : 0;
  const prodGap = study.prod_pct < 80 ? Math.pow((80 - study.prod_pct) / 80, 0.8) : 0;
  const failRate = study.total_del > 0 ? Math.min(study.failed_qc / study.total_del, 1) : 0;
  const delayScore = Math.min(study.sig_delays / 25, 1);
  const raw =
    schedPressure * 0.28 +
    qcGap * 0.22 +
    failRate * 0.18 +
    prodGap * 0.12 +
    delayScore * 0.10 +
    (study.at_risk ? 0.06 : 0) +
    (study.delayed ? 0.04 : 0);
  return Math.min(Math.max(+raw.toFixed(3), 0.02), 0.98);
}

function effectiveScore(study: Study, updates: StudyUpdate[]): number {
  const upd = updates.find((u) => u.study === study.study);
  return Math.min(computeAiScore(study) + (upd?.riskBump ?? 0), 1);
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

const BASE_TREND_DATA = [
  { date: 'Oct 25', prod_pct: 58.2, qc_pct: 52.1 },
  { date: 'Nov 25', prod_pct: 61.8, qc_pct: 55.7 },
  { date: 'Dec 25', prod_pct: 64.3, qc_pct: 58.4 },
  { date: 'Jan 26', prod_pct: 67.1, qc_pct: 61.2 },
  { date: 'Feb 26', prod_pct: 69.8, qc_pct: 63.7 },
  { date: 'Mar 26', prod_pct: 71.4, qc_pct: 65.9 },
  { date: 'Apr 26', prod_pct: 73.2, qc_pct: 67.8 },
  { date: 'Today', prod_pct: 75.4, qc_pct: 70.2 },
];

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
    <div style={{ background: '#161b24', borderTop: '2px solid #1a5c38' }}>
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

      {/* Milestone row — subtle */}
      {(() => {
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const fmt = (d: string | null) => {
          if (!d) return null;
          const p = d.split('-');
          return p.length >= 3 ? `${p[2]}-${MONTHS[+p[1]-1]}-${p[0]}` : p.length === 2 ? `${MONTHS[+p[1]-1]}-${p[0]}` : d;
        };
        const fpi = fmt(study.fpi);
        const dbl = fmt(study.dbl);
        const wks = study.weeks_to_dbl;
        const wkColor = wks !== null && wks < 0 ? '#ef4444' : wks !== null && wks <= 8 ? '#f59e0b' : '#2ea55e';
        return (
          <div className="flex items-center gap-5 px-5 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(26,92,56,0.06)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>Milestones</span>
            <div className="flex items-center gap-1.5 text-xs">
              <span style={{ color: '#4b5563' }}>FPI</span>
              <span style={{ color: fpi ? '#86efac' : '#4b5563', fontWeight: 500 }}>{fpi ?? '—'}</span>
            </div>
            <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.08)' }} />
            <div className="flex items-center gap-1.5 text-xs">
              <span style={{ color: '#4b5563' }}>DBL</span>
              <span style={{ color: dbl ? wkColor : '#4b5563', fontWeight: 500 }}>{dbl ?? '—'}</span>
              {wks !== null && dbl && (
                <span style={{ color: '#4b5563' }}>({wks < 0 ? `${Math.abs(wks).toFixed(0)}w overdue` : `${wks.toFixed(0)}w left`})</span>
              )}
            </div>
            {study.sig_delays > 0 && (
              <>
                <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.08)' }} />
                <div className="flex items-center gap-1.5 text-xs">
                  <span style={{ color: '#4b5563' }}>Sig. Delays</span>
                  <span style={{ color: '#f97316', fontWeight: 500 }}>{study.sig_delays}</span>
                </div>
              </>
            )}
          </div>
        );
      })()}

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
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#3b82f6' }}>Risk Model</p>
            <div className="space-y-2 mb-3">
              {[
                { label: 'ML Score', value: computeAiScore(study), color: '#3b82f6', tip: 'Feature-engineered composite: schedule pressure (28%), QC gap (22%), failure rate (18%), production gap (12%), delay score (10%), risk flags (10%)' },
                { label: 'Rule-Based', value: study.risk_score, color: '#8892a4', tip: 'Weighted sum of discrete risk flags: missed milestones, QC threshold breaches, overdue deliverables' },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: '#8892a4' }}>{m.label}<InfoTip text={m.tip} /></span>
                    <span style={{ color: m.color }}>{(m.value * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ width: `${m.value * 100}%`, background: m.color }} /></div>
                </div>
              ))}
            </div>
            <div className="space-y-1 mt-3 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-xs mb-1" style={{ color: '#8892a4' }}>Key inputs</p>
              {[
                { label: 'Sig. Delays', value: study.sig_delays, tip: 'Deliverables ≥2 weeks past their planned delivery date' },
                { label: 'Failed QC', value: study.failed_qc, tip: 'Deliverables that failed QC review and require rework' },
                { label: 'Wks to DBL', value: study.weeks_to_dbl !== null ? study.weeks_to_dbl.toFixed(1) : 'N/A', tip: 'Weeks remaining until Database Lock. Negative = already past target date' },
                { label: 'Total del.', value: study.total_del, tip: 'Total planned deliverables: SDTMs + ADaMs + Tables + Listings + Figures' },
              ].map((m) => (
                <div key={m.label} className="flex justify-between text-xs">
                  <span style={{ color: '#8892a4' }}>{m.label}<InfoTip text={m.tip} /></span>
                  <span style={{ color: '#e8eaf0' }}>{m.value}</span>
                </div>
              ))}
            </div>
            {topFactors.length > 0 && (
              <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <p className="text-xs mb-1.5" style={{ color: '#8892a4' }}>Top risk drivers<InfoTip text="Rule-based risk factor contributions — individual signals that push the overall score up" /></p>
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
    let prodDoneLeft = d.prod_done, prodIPLeft = d.prod_in_progress;
    let qcPassedLeft = d.qc_passed, qcFailedLeft = d.qc_failed, qcIPLeft = d.qc_in_progress;
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

function InlineChart({ title, metric, metricLabel, data }: { title: string; metric: string; metricLabel: string; data: { name: string; value: number }[] }) {
  const color = metric === 'prod_pct' ? '#2ea55e' : metric === 'qc_pct' ? '#3b82f6' : metric === 'failed_qc' ? '#ef4444' : '#f97316';
  const isPct = metric.endsWith('_pct');
  return (
    <div className="mt-2 rounded overflow-hidden" style={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="px-3 py-1.5 text-xs font-medium" style={{ background: 'rgba(26,92,56,0.25)', color: '#2ea55e' }}>{title}</div>
      <div style={{ padding: '8px 4px 4px' }}>
        <ResponsiveContainer width="100%" height={data.length * 26 + 24}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 4, bottom: 0 }}>
            <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={isPct ? (v) => `${v}%` : undefined} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#e8eaf0', fontSize: 10 }} width={90} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }} formatter={(v) => [`${v}${isPct ? '%' : ''}`, metricLabel]} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Bar dataKey="value" fill={color} radius={[0, 3, 3, 0]} label={{ position: 'right', fill: '#8892a4', fontSize: 9, formatter: (v: any) => `${v ?? ''}${isPct ? '%' : ''}` }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function InlineTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  const RISK_CLR: Record<string, string> = { Critical: '#ef4444', High: '#f97316', Elevated: '#f59e0b', Moderate: '#eab308', Low: '#22c55e' };
  const cellColor = (col: string, val: string) => {
    if (RISK_CLR[val]) return RISK_CLR[val];
    if (col === 'Prod %' || col === 'QC %') { const n = parseFloat(val); return isNaN(n) ? '#8892a4' : n >= 80 ? '#2ea55e' : n >= 50 ? '#d97706' : '#ef4444'; }
    if (col === 'Wks DBL') { const n = parseFloat(val); return isNaN(n) ? '#8892a4' : n < 0 ? '#ef4444' : n <= 4 ? '#ef4444' : n <= 8 ? '#f97316' : '#8892a4'; }
    return undefined;
  };
  return (
    <div className="mt-2 rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="px-3 py-1.5 text-xs font-medium" style={{ background: 'rgba(26,92,56,0.25)', color: '#2ea55e' }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1c2230', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {columns.map((c) => <th key={c} className="px-2 py-1.5 text-left whitespace-nowrap" style={{ color: '#8892a4', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1.5 whitespace-nowrap" style={{ color: cellColor(columns[j], cell) ?? (j === 0 ? '#e8eaf0' : '#8892a4'), fontWeight: j === 0 ? 500 : 400 }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface AllRecordsPanelProps {
  label: string;
  studies: Study[];
  filterStudy?: string | null;
  granularMode?: boolean;
  onClear?: () => void;
  onGranularToggle?: () => void;
}

function AllRecordsPanel({ label, studies, filterStudy, granularMode, onClear, onGranularToggle }: AllRecordsPanelProps) {
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({
    client: '', portfolio: '', study: '', fpi: '', dbl: '',
    deliverable: '', prodStatus: '', qcStatus: '',
    delType: '', dataset: '',
  });
  const setCol = (key: keyof typeof colFilters, val: string) =>
    setColFilters((prev) => ({ ...prev, [key]: val }));
  const clearCols = () => setColFilters({ client: '', portfolio: '', study: '', fpi: '', dbl: '', deliverable: '', prodStatus: '', qcStatus: '', delType: '', dataset: '' });
  const hasColFilters = Object.values(colFilters).some(Boolean);

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

  // Dropdown option lists derived from current data
  const uClients = useMemo(() => [...new Set(aggRows.map((r) => r.client))].sort(), [aggRows]);
  const uPortfolios = useMemo(() => [...new Set(aggRows.map((r) => r.portfolio))].sort(), [aggRows]);
  const uDeliverables = useMemo(() => [...new Set(aggRows.map((r) => r.deliverable))].sort(), [aggRows]);
  const uAggProd = useMemo(() => [...new Set(aggRows.map((r) => r.prodStatus))], [aggRows]);
  const uAggQc = useMemo(() => [...new Set(aggRows.map((r) => r.qcStatus))], [aggRows]);
  const uDelTypes = useMemo(() => [...new Set(granRows.map((r) => r.deliverableType))].sort(), [granRows]);
  const uGranProd = useMemo(() => [...new Set(granRows.map((r) => r.prodStatus))], [granRows]);
  const uGranQc = useMemo(() => [...new Set(granRows.map((r) => r.qcStatus))], [granRows]);

  const filteredAgg = useMemo(() => {
    let rows = aggRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        r.study.toLowerCase().includes(q) || r.client.toLowerCase().includes(q) ||
        r.deliverable.toLowerCase().includes(q) || r.prodStatus.toLowerCase().includes(q) || r.qcStatus.toLowerCase().includes(q)
      );
    }
    if (colFilters.client) rows = rows.filter((r) => r.client === colFilters.client);
    if (colFilters.portfolio) rows = rows.filter((r) => r.portfolio === colFilters.portfolio);
    if (colFilters.study) rows = rows.filter((r) => r.study.toLowerCase().includes(colFilters.study.toLowerCase()));
    if (colFilters.fpi) rows = rows.filter((r) => r.fpi?.includes(colFilters.fpi) ?? false);
    if (colFilters.dbl) rows = rows.filter((r) => r.dbl?.includes(colFilters.dbl) ?? false);
    if (colFilters.deliverable) rows = rows.filter((r) => r.deliverable === colFilters.deliverable);
    if (colFilters.prodStatus) rows = rows.filter((r) => r.prodStatus === colFilters.prodStatus);
    if (colFilters.qcStatus) rows = rows.filter((r) => r.qcStatus === colFilters.qcStatus);
    return rows;
  }, [aggRows, search, colFilters]);

  const filteredGran = useMemo(() => {
    let rows = granRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        r.study.toLowerCase().includes(q) || r.client.toLowerCase().includes(q) ||
        r.deliverableType.toLowerCase().includes(q) || r.dataset.toLowerCase().includes(q) ||
        r.prodStatus.toLowerCase().includes(q) || r.qcStatus.toLowerCase().includes(q)
      );
    }
    if (colFilters.client) rows = rows.filter((r) => r.client === colFilters.client);
    if (colFilters.study) rows = rows.filter((r) => r.study.toLowerCase().includes(colFilters.study.toLowerCase()));
    if (colFilters.fpi) rows = rows.filter((r) => r.fpi?.includes(colFilters.fpi) ?? false);
    if (colFilters.dbl) rows = rows.filter((r) => r.dbl?.includes(colFilters.dbl) ?? false);
    if (colFilters.delType) rows = rows.filter((r) => r.deliverableType === colFilters.delType);
    if (colFilters.dataset) rows = rows.filter((r) => r.dataset.toLowerCase().includes(colFilters.dataset.toLowerCase()));
    if (colFilters.prodStatus) rows = rows.filter((r) => r.prodStatus === colFilters.prodStatus);
    if (colFilters.qcStatus) rows = rows.filter((r) => r.qcStatus === colFilters.qcStatus);
    return rows;
  }, [granRows, search, colFilters]);

  const totalRows = isGranular ? filteredGran.length : filteredAgg.length;
  const failRows = isGranular ? filteredGran.filter((r) => r.qcStatus === 'Failed QC').length : filteredAgg.filter((r) => r.qcStatus === 'Failed QC').length;
  const passRows = isGranular ? filteredGran.filter((r) => r.qcStatus === 'Passed QC').length : filteredAgg.filter((r) => r.qcStatus === 'Passed QC').length;
  const completedRows = isGranular ? filteredGran.filter((r) => r.prodStatus === 'Ready for QC').length : filteredAgg.filter((r) => r.prodStatus === 'Completed').length;

  const colStyle = { color: '#8892a4', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' };
  const fi = { background: '#0d1117', color: '#e8eaf0', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10, borderRadius: 3, width: '100%', padding: '2px 4px' } as const;

  return (
    <div className="rounded-lg mt-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between px-5 py-3 flex-wrap gap-2" style={{ background: '#1a5c38', borderRadius: '0.5rem 0.5rem 0 0' }}>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm font-bold text-white">
              Deliverable Tracker{label !== 'All Records' ? ` — ${label}` : ''}
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
              <button onClick={() => isGranular && onGranularToggle()} className="text-xs px-2.5 py-1 font-medium" style={{ background: !isGranular ? 'rgba(255,255,255,0.2)' : 'transparent', color: !isGranular ? '#fff' : 'rgba(255,255,255,0.5)' }}>Aggregated</button>
              <button onClick={() => !isGranular && onGranularToggle()} className="text-xs px-2.5 py-1 font-medium" style={{ background: isGranular ? '#3b82f6' : 'transparent', color: isGranular ? '#fff' : 'rgba(255,255,255,0.5)' }}>Granular</button>
            </div>
          )}
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search records…" className="text-xs rounded px-3 py-1.5 border outline-none w-44" style={{ background: '#1c2230', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' }} />
          {hasColFilters && (
            <button onClick={clearCols} className="text-xs px-2.5 py-1 rounded font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>↺ Clear col filters</button>
          )}
          {onClear && (
            <button onClick={onClear} className="text-xs px-3 py-1.5 rounded font-medium text-white/70 hover:text-white" style={{ background: 'rgba(255,255,255,0.15)' }}>✕ Clear filter</button>
          )}
        </div>
      </div>

      <div style={{ maxHeight: '380px', overflowY: 'auto', overflowX: 'auto' }}>
        {isGranular ? (
          <table className="w-full text-xs" style={{ minWidth: 800, borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Client', 'Portfolio', 'Study', 'FPI', 'DBL', 'Del. Type', 'Dataset', 'Prod Status', 'QC Status'].map((h) => (
                  <th key={h} className="text-left px-3 py-2 whitespace-nowrap" style={colStyle}>{h}</th>
                ))}
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#161b24' }}>
                <th className="px-2 py-1"><select value={colFilters.client} onChange={(e) => setCol('client', e.target.value)} style={fi}><option value="">All</option>{uClients.map((c) => <option key={c} value={c}>{c}</option>)}</select></th>
                <th className="px-2 py-1"><span style={{ color: '#444', fontSize: 9 }}>—</span></th>
                <th className="px-2 py-1"><input value={colFilters.study} onChange={(e) => setCol('study', e.target.value)} placeholder="filter…" style={fi} /></th>
                <th className="px-2 py-1"><input value={colFilters.fpi} onChange={(e) => setCol('fpi', e.target.value)} placeholder="yyyy-mm" style={fi} /></th>
                <th className="px-2 py-1"><input value={colFilters.dbl} onChange={(e) => setCol('dbl', e.target.value)} placeholder="yyyy-mm" style={fi} /></th>
                <th className="px-2 py-1"><select value={colFilters.delType} onChange={(e) => setCol('delType', e.target.value)} style={fi}><option value="">All</option>{uDelTypes.map((d) => <option key={d} value={d}>{d}</option>)}</select></th>
                <th className="px-2 py-1"><input value={colFilters.dataset} onChange={(e) => setCol('dataset', e.target.value)} placeholder="filter…" style={fi} /></th>
                <th className="px-2 py-1"><select value={colFilters.prodStatus} onChange={(e) => setCol('prodStatus', e.target.value)} style={fi}><option value="">All</option>{uGranProd.map((s) => <option key={s} value={s}>{s}</option>)}</select></th>
                <th className="px-2 py-1"><select value={colFilters.qcStatus} onChange={(e) => setCol('qcStatus', e.target.value)} style={fi}><option value="">All</option>{uGranQc.map((s) => <option key={s} value={s}>{s}</option>)}</select></th>
              </tr>
            </thead>
            <tbody>
              {filteredGran.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-sm" style={{ color: '#8892a4' }}>No records match.</td></tr>
              ) : filteredGran.map((r, i) => (
                <tr key={`gran-${i}`} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#8892a4' }}>{r.client}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#6b7280' }}>{r.portfolio}</td>
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap" style={{ color: '#e8eaf0' }}>{r.study}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#8892a4' }}>{r.fpi ?? '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#8892a4' }}>{r.dbl ?? '—'}</td>
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap" style={{ color: '#8892a4' }}>{r.deliverableType}</td>
                  <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: '#e8eaf0' }}>{r.dataset}</td>
                  <td className="px-3 py-1.5"><span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: STATUS_COLORS[r.prodStatus] ?? '#6b7280', background: `${STATUS_COLORS[r.prodStatus] ?? '#6b7280'}18` }}>{r.prodStatus}</span></td>
                  <td className="px-3 py-1.5"><span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: STATUS_COLORS[r.qcStatus] ?? '#6b7280', background: `${STATUS_COLORS[r.qcStatus] ?? '#6b7280'}18` }}>{r.qcStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs" style={{ minWidth: 900, borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Client', 'Portfolio', 'Study', 'FPI', 'DBL', 'Deliverable', 'Total', 'Prod Done', 'Prod %', 'Prod Status', 'QC Passed', 'QC Failed', 'QC %', 'QC Status'].map((h) => (
                  <th key={h} className="text-left px-3 py-2 whitespace-nowrap" style={colStyle}>{h}</th>
                ))}
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#161b24' }}>
                <th className="px-2 py-1"><select value={colFilters.client} onChange={(e) => setCol('client', e.target.value)} style={fi}><option value="">All</option>{uClients.map((c) => <option key={c} value={c}>{c}</option>)}</select></th>
                <th className="px-2 py-1"><select value={colFilters.portfolio} onChange={(e) => setCol('portfolio', e.target.value)} style={fi}><option value="">All</option>{uPortfolios.map((p) => <option key={p} value={p}>{p}</option>)}</select></th>
                <th className="px-2 py-1"><input value={colFilters.study} onChange={(e) => setCol('study', e.target.value)} placeholder="filter…" style={fi} /></th>
                <th className="px-2 py-1"><input value={colFilters.fpi} onChange={(e) => setCol('fpi', e.target.value)} placeholder="yyyy-mm" style={fi} /></th>
                <th className="px-2 py-1"><input value={colFilters.dbl} onChange={(e) => setCol('dbl', e.target.value)} placeholder="yyyy-mm" style={fi} /></th>
                <th className="px-2 py-1"><select value={colFilters.deliverable} onChange={(e) => setCol('deliverable', e.target.value)} style={fi}><option value="">All</option>{uDeliverables.map((d) => <option key={d} value={d}>{d}</option>)}</select></th>
                <th /><th /><th />
                <th className="px-2 py-1"><select value={colFilters.prodStatus} onChange={(e) => setCol('prodStatus', e.target.value)} style={fi}><option value="">All</option>{uAggProd.map((s) => <option key={s} value={s}>{s}</option>)}</select></th>
                <th /><th /><th />
                <th className="px-2 py-1"><select value={colFilters.qcStatus} onChange={(e) => setCol('qcStatus', e.target.value)} style={fi}><option value="">All</option>{uAggQc.map((s) => <option key={s} value={s}>{s}</option>)}</select></th>
              </tr>
            </thead>
            <tbody>
              {filteredAgg.length === 0 ? (
                <tr><td colSpan={14} className="px-3 py-6 text-center text-sm" style={{ color: '#8892a4' }}>No records match.</td></tr>
              ) : filteredAgg.map((r, i) => (
                <tr key={`agg-${i}`} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
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
                      <div className="h-1.5 w-10 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ width: `${r.prodPct}%`, background: '#2ea55e' }} /></div>
                      <span style={{ color: r.prodPct >= 80 ? '#2ea55e' : r.prodPct >= 40 ? '#d97706' : '#e8eaf0' }}>{r.prodPct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5"><span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: STATUS_COLORS[r.prodStatus] ?? '#6b7280', background: `${STATUS_COLORS[r.prodStatus] ?? '#6b7280'}18` }}>{r.prodStatus}</span></td>
                  <td className="px-3 py-1.5 text-center" style={{ color: r.qcPassed > 0 ? '#2ea55e' : '#8892a4' }}>{r.qcPassed}</td>
                  <td className="px-3 py-1.5 text-center font-medium" style={{ color: r.qcFailed > 0 ? '#ef4444' : '#8892a4' }}>{r.qcFailed > 0 ? r.qcFailed : '—'}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-10 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ width: `${r.qcPct}%`, background: '#3b82f6' }} /></div>
                      <span style={{ color: r.qcPct >= 80 ? '#2ea55e' : r.qcPct >= 40 ? '#d97706' : '#e8eaf0' }}>{r.qcPct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5"><span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: STATUS_COLORS[r.qcStatus] ?? '#6b7280', background: `${STATUS_COLORS[r.qcStatus] ?? '#6b7280'}18` }}>{r.qcStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

type ChatAction =
  | { type: 'filter'; risk_tier?: string; fso_fsp?: string; client?: string; search?: string }
  | { type: 'chart'; title: string; metric: string; metricLabel: string; data: { name: string; value: number }[] }
  | { type: 'table'; title: string; columns: string[]; rows: string[][] };

type ChatMessage = { role: 'user' | 'assistant'; content: string; action?: ChatAction };

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
  const [tableSponsorFilter, setTableSponsorFilter] = useState('All');
  const [tablePortfolioFilter, setTablePortfolioFilter] = useState('All');
  const [sortMode, setSortMode] = useState<'severity' | 'score'>('severity');
  const [selectedStudy, setSelectedStudy] = useState<string | null>(null);
  const [granularMode, setGranularMode] = useState(false);
  const [fsoFspFilter, setFsoFspFilter] = useState<'All' | 'FSO' | 'FSP'>('All');
  const [riskFilter, setRiskFilter] = useState<string>('All');
  const [downloadToast, setDownloadToast] = useState(false);
  const [groupBy, setGroupBy] = useState<'client' | 'portfolio' | 'fso_fsp'>('client');
  const [showTrend, setShowTrend] = useState(false);
  const [showAllGroups, setShowAllGroups] = useState(false);

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
      filtered = filtered.filter((s) => s.study.toLowerCase().includes(q) || s.client.toLowerCase().includes(q) || s.portfolio.toLowerCase().includes(q));
    }
    if (tableSponsorFilter !== 'All') {
      filtered = filtered.filter((s) => s.client === tableSponsorFilter);
    }
    if (tablePortfolioFilter !== 'All') {
      filtered = filtered.filter((s) => s.portfolio === tablePortfolioFilter);
    }
    if (riskFilter !== 'All') {
      filtered = filtered.filter((s) => effectiveTier(s, savedUpdates) === riskFilter);
    }
    return filtered;
  }, [nlqFiltered, tableSearch, tableSponsorFilter, tablePortfolioFilter, riskFilter, savedUpdates]);

  const sortedStudies = useMemo(() => [...tableFiltered].sort((a, b) =>
    sortMode === 'severity'
      ? RISK_ORDER[effectiveTier(a, savedUpdates)] - RISK_ORDER[effectiveTier(b, savedUpdates)]
      : effectiveScore(b, savedUpdates) - effectiveScore(a, savedUpdates)
  ), [tableFiltered, sortMode, savedUpdates]);

  const groupedCards = useMemo(() => {
    const map: Record<string, Study[]> = {};
    tableFiltered.forEach((s) => {
      const key = String(s[groupBy] ?? 'Unknown');
      (map[key] = map[key] || []).push(s);
    });
    return Object.entries(map).map(([key, grp]) => {
      const avgProd = grp.reduce((a, s) => a + s.prod_pct, 0) / grp.length;
      const avgQc   = grp.reduce((a, s) => a + s.qc_pct,   0) / grp.length;
      const critical  = grp.filter((s) => effectiveTier(s, savedUpdates) === 'Critical').length;
      const high      = grp.filter((s) => effectiveTier(s, savedUpdates) === 'High').length;
      const elevated  = grp.filter((s) => effectiveTier(s, savedUpdates) === 'Elevated').length;
      const sigDelays = grp.reduce((a, s) => a + s.sig_delays, 0);
      const failedQc  = grp.reduce((a, s) => a + s.failed_qc, 0);
      const worstScore = Math.max(...grp.map((s) => effectiveScore(s, savedUpdates)));
      return { key, count: grp.length, avgProd, avgQc, critical, high, elevated, sigDelays, failedQc, worstScore };
    }).sort((a, b) => b.worstScore - a.worstScore);
  }, [tableFiltered, groupBy, savedUpdates]);

  const delayed = sidebarFiltered.filter((s) => s.delayed).length;
  const atRisk = sidebarFiltered.filter((s) => s.at_risk).length;
  const avgProd = sidebarFiltered.length > 0 ? sidebarFiltered.reduce((a, s) => a + s.prod_pct, 0) / sidebarFiltered.length : 0;
  const avgQc = sidebarFiltered.length > 0 ? sidebarFiltered.reduce((a, s) => a + s.qc_pct, 0) / sidebarFiltered.length : 0;

  const bottomPanelStudies = tableFiltered;
  const bottomPanelLabel = selectedStudy ?? 'All Records';

  const chartStudies = useMemo(() => {
    if (selectedStudy) return tableFiltered.filter((s) => s.study === selectedStudy);
    return tableFiltered;
  }, [tableFiltered, selectedStudy]);

  const chartLabel = selectedStudy ?? null;

  const chartAvgProd = chartStudies.length > 0 ? chartStudies.reduce((a, s) => a + s.prod_pct, 0) / chartStudies.length : 0;
  const chartAvgQc = chartStudies.length > 0 ? chartStudies.reduce((a, s) => a + s.qc_pct, 0) / chartStudies.length : 0;

  const trendData = useMemo(() => {
    const baseProd = BASE_TREND_DATA[BASE_TREND_DATA.length - 1].prod_pct;
    const baseQc = BASE_TREND_DATA[BASE_TREND_DATA.length - 1].qc_pct;
    if (baseProd === 0 || baseQc === 0 || chartStudies.length === 0) return BASE_TREND_DATA;
    const prodScale = chartAvgProd / baseProd;
    const qcScale = chartAvgQc / baseQc;
    return BASE_TREND_DATA.map((d, i) =>
      i === BASE_TREND_DATA.length - 1
        ? { ...d, prod_pct: +chartAvgProd.toFixed(1), qc_pct: +chartAvgQc.toFixed(1) }
        : { ...d, prod_pct: +(d.prod_pct * prodScale).toFixed(1), qc_pct: +(d.qc_pct * qcScale).toFixed(1) }
    );
  }, [chartAvgProd, chartAvgQc, chartStudies.length]);

  const trendDeltaProd = +(trendData[trendData.length - 1].prod_pct - trendData[trendData.length - 2].prod_pct).toFixed(1);
  const trendDeltaQc = +(trendData[trendData.length - 1].qc_pct - trendData[trendData.length - 2].qc_pct).toFixed(1);

  const handleReset = () => {
    setSelectedStudy(null);
    setGranularMode(false);
    setFsoFspFilter('All');
    setRiskFilter('All');
    setNlqActive(false);
    setNlqQuery('');
    setTableSearch('');
    setTableSponsorFilter('All');
    setTablePortfolioFilter('All');
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
      const studyLines = sidebarFiltered.slice(0, 80).map((s) =>
        `- ${s.study}: client=${s.client}, TA=${s.ta}, type=${s.fso_fsp}, risk=${effectiveTier(s, savedUpdates)}, prod=${s.prod_pct}%, qc=${s.qc_pct}%, delayed=${s.delayed}, sig_delays=${s.sig_delays}, weeks_to_dbl=${s.weeks_to_dbl ?? 'N/A'}`
      ).join('\n');
      const context = `Portfolio: ${sidebarFiltered.length} studies across ${new Set(sidebarFiltered.map((s) => s.client)).size} clients. Delayed: ${delayed}, At-risk: ${atRisk}, Avg prod: ${avgProd.toFixed(1)}%, Avg QC: ${avgQc.toFixed(1)}%.\n\nStudies:\n${studyLines}`;
      const studiesPayload = sidebarFiltered.slice(0, 80).map((s) => ({
        study: s.study, client: s.client, ta: s.ta, fso_fsp: s.fso_fsp,
        risk_tier: effectiveTier(s, savedUpdates),
        prod_pct: s.prod_pct, qc_pct: s.qc_pct,
        failed_qc: s.failed_qc, sig_delays: s.sig_delays,
        weeks_to_dbl: s.weeks_to_dbl, delayed: s.delayed, at_risk: s.at_risk,
      }));
      const res = await fetch('/api/nlq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context, history: chatHistory, studies: studiesPayload }),
      });
      const data = await res.json();
      const action: ChatAction | undefined = data.action ?? undefined;

      if (action?.type === 'filter') {
        if (action.risk_tier) setRiskFilter(action.risk_tier === 'All' ? 'All' : action.risk_tier);
        if (action.fso_fsp) setFsoFspFilter((action.fso_fsp === 'All' ? 'All' : action.fso_fsp) as 'All' | 'FSO' | 'FSP');
        if (action.client) setTableSponsorFilter(action.client);
        if (action.search) setTableSearch(action.search);
      }

      setChatHistory([...updatedHistory, { role: 'assistant', content: data.response, action }]);
    } catch {
      setChatHistory([...updatedHistory, { role: 'assistant', content: 'Unable to process query.' }]);
    } finally {
      setNlqLoading(false);
    }
  };

  const clearNlq = () => { setNlqActive(false); setNlqQuery(''); setChatHistory([]); setNlqInput(''); };
  const QUICK_CHIPS = ['High-risk studies', 'Delayed studies', 'QC below 70%', 'Within 4 weeks of DBL'];

  const colStyle = { color: '#8892a4', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' };

  return (
    <div className="flex" style={{ minHeight: 'calc(100vh - 112px)' }}>
      {downloadToast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm" style={{ background: '#2ea55e', color: '#fff' }}>↓ Report download coming soon</div>
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
                    <input type="radio" name="portfolio" checked={portfolioFilter === p} onChange={() => setPortfolioFilter(p)} className="accent-green-500" />
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
              <span className="text-xs mb-1" style={{ color: trendDeltaProd >= 0 ? '#22c55e' : '#ef4444' }}>{trendDeltaProd >= 0 ? '↑' : '↓'} {Math.abs(trendDeltaProd)}% vs prev</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ width: `${Math.min(avgProd, 100)}%`, background: '#2ea55e' }} /></div>
            <div className="text-xs" style={{ color: '#8892a4' }}>Production Done</div>
          </div>
          <div className="rounded-lg px-4 pt-3 pb-2" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-end justify-between mb-1">
              <div className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{avgQc.toFixed(1)}%</div>
              <span className="text-xs mb-1" style={{ color: trendDeltaQc >= 0 ? '#22c55e' : '#ef4444' }}>{trendDeltaQc >= 0 ? '↑' : '↓'} {Math.abs(trendDeltaQc)}% vs prev</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full" style={{ width: `${Math.min(avgQc, 100)}%`, background: '#3b82f6' }} /></div>
            <div className="text-xs" style={{ color: '#8892a4' }}>QC Done</div>
          </div>
        </div>

        {/* AI Query */}
        <div className="rounded-lg" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8892a4' }}>AI Query</p>
            {chatHistory.length > 0 && <button onClick={clearNlq} className="text-xs px-2 py-0.5 rounded" style={{ color: '#8892a4', background: 'rgba(255,255,255,0.05)' }}>Clear chat</button>}
          </div>
          {chatHistory.length > 0 && (
            <div className="px-4 pb-2 space-y-2 max-h-80 overflow-y-auto">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="text-xs px-3 py-2 rounded-lg max-w-[92%]" style={msg.role === 'user' ? { background: 'rgba(46,165,94,0.15)', color: '#e8eaf0', border: '1px solid rgba(46,165,94,0.25)' } : { background: 'rgba(59,130,246,0.08)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}>
                    {msg.content}
                    {msg.role === 'assistant' && i === chatHistory.length - 1 && nlqActive && !msg.action && (
                      <span className="ml-2 text-xs" style={{ color: '#8892a4' }}>· {tableFiltered.length} studies shown</span>
                    )}
                    {msg.role === 'assistant' && msg.action?.type === 'filter' && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(46,165,94,0.15)', color: '#2ea55e', border: '1px solid rgba(46,165,94,0.3)' }}>
                        ✓ Filters applied · {tableFiltered.length} studies shown
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.action?.type === 'chart' && (
                      <InlineChart title={msg.action.title} metric={msg.action.metric} metricLabel={msg.action.metricLabel} data={msg.action.data} />
                    )}
                    {msg.role === 'assistant' && msg.action?.type === 'table' && (
                      <InlineTable title={msg.action.title} columns={msg.action.columns} rows={msg.action.rows} />
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
                  <button key={chip} onClick={() => { setNlqInput(chip); handleNlq(chip); }} className="text-xs px-3 py-1 rounded-full border" style={{ borderColor: 'rgba(46,165,94,0.4)', color: '#2ea55e', background: 'rgba(46,165,94,0.08)' }}>{chip}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Group metric cards */}
        <div className="rounded-lg overflow-hidden" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8892a4' }}>Group by</span>
              {([['client','Sponsor'],['portfolio','Portfolio'],['fso_fsp','Type']] as const).map(([val, label]) => (
                <button key={val} onClick={() => { setGroupBy(val); setShowAllGroups(false); }}
                  className="text-xs px-2.5 py-1 rounded font-medium"
                  style={{ background: groupBy === val ? 'rgba(46,165,94,0.15)' : 'rgba(255,255,255,0.05)', color: groupBy === val ? '#2ea55e' : '#8892a4', border: groupBy === val ? '1px solid rgba(46,165,94,0.3)' : '1px solid transparent' }}>
                  {label}
                </button>
              ))}
              <span className="text-xs" style={{ color: '#4b5563' }}>· {groupedCards.length} groups · {tableFiltered.length} studies</span>
            </div>
            <button onClick={() => setShowTrend((v) => !v)} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded" style={{ background: showTrend ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)', color: showTrend ? '#3b82f6' : '#8892a4', border: showTrend ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent' }}>
              📈 Delivery Trend {showTrend ? '▲' : '▼'}
            </button>
          </div>

          {/* Cards grid */}
          <div className="p-3">
            <div className="flex flex-wrap gap-3">
              {(showAllGroups ? groupedCards : groupedCards.slice(0, 6)).map((g) => {
                const prodColor = g.avgProd >= 80 ? '#22c55e' : g.avgProd >= 50 ? '#d97706' : '#ef4444';
                const qcColor   = g.avgQc   >= 80 ? '#22c55e' : g.avgQc   >= 50 ? '#d97706' : '#ef4444';
                const hasCrit = g.critical > 0 || g.high > 0;
                return (
                  <div key={g.key} className="rounded-lg p-3 flex flex-col gap-2" style={{ background: '#1c2230', border: `1px solid ${hasCrit ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`, minWidth: 180, flex: '1 1 180px', maxWidth: 240 }}>
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-semibold leading-tight" style={{ color: '#e8eaf0' }}>{g.key}</span>
                      <span className="text-xs flex-shrink-0" style={{ color: '#6b7280' }}>{g.count} {g.count === 1 ? 'study' : 'studies'}</span>
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span style={{ color: '#6b7280' }}>Prod</span>
                          <span style={{ color: prodColor, fontWeight: 600 }}>{g.avgProd.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full" style={{ width: `${g.avgProd}%`, background: prodColor }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span style={{ color: '#6b7280' }}>QC</span>
                          <span style={{ color: qcColor, fontWeight: 600 }}>{g.avgQc.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full" style={{ width: `${g.avgQc}%`, background: qcColor }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {g.critical > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>🔴 {g.critical}</span>}
                      {g.high     > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>🟠 {g.high}</span>}
                      {g.elevated > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>🟡 {g.elevated}</span>}
                      {g.sigDelays > 0 && <span className="text-xs ml-auto" style={{ color: '#6b7280' }}>⏱ {g.sigDelays}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {groupedCards.length > 6 && (
              <button onClick={() => setShowAllGroups((v) => !v)} className="mt-2 text-xs px-3 py-1 rounded" style={{ color: '#8892a4', background: 'rgba(255,255,255,0.04)' }}>
                {showAllGroups ? `▲ Show top 6` : `▼ Show all ${groupedCards.length} groups`}
              </button>
            )}
          </div>

          {/* Collapsible trend chart */}
          {showTrend && (
            <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-xs mb-2" style={{ color: '#6b7280' }}>
                Delivery Trend{chartLabel ? ` — ${chartLabel}` : ''} · {chartStudies.length} studies · Prod {chartAvgProd.toFixed(1)}% · QC {chartAvgQc.toFixed(1)}%
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={trendData} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto','auto']} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }} formatter={(v) => [`${v}%`]} />
                  <Line type="monotone" dataKey="prod_pct" name="Production" stroke="#2ea55e" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="qc_pct" name="QC" stroke="#3b82f6" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Client/Study Drill-Down Table */}
        <div className="rounded-lg overflow-hidden" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>
              Delivery Portfolio
              <span className="ml-2 text-xs font-normal" style={{ color: '#8892a4' }}>({tableFiltered.length} studies)</span>
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="text" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Search…" className="text-xs rounded px-3 py-1.5 border outline-none w-36" style={{ background: '#1c2230', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' }} />
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: 16 }} />
              <span className="text-xs" style={{ color: '#8892a4' }}>Sort:</span>
              {(['severity', 'score'] as const).map((mode) => (
                <button key={mode} onClick={() => setSortMode(mode)} className="text-xs px-2.5 py-1 rounded font-medium" style={{ background: sortMode === mode ? '#2ea55e' : 'rgba(255,255,255,0.05)', color: sortMode === mode ? '#fff' : '#8892a4' }}>
                  {mode === 'severity' ? 'Severity' : 'Score'}
                </button>
              ))}
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: 16 }} />
              <span className="text-xs" style={{ color: '#8892a4' }}>Type:</span>
              {(['All', 'FSO', 'FSP'] as const).map((f) => (
                <button key={f} onClick={() => setFsoFspFilter(f)} className="text-xs px-2.5 py-1 rounded font-medium" style={{ background: fsoFspFilter === f ? '#3b82f6' : 'rgba(255,255,255,0.05)', color: fsoFspFilter === f ? '#fff' : '#8892a4' }}>{f}</button>
              ))}
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: 16 }} />
              <span className="text-xs" style={{ color: '#8892a4' }}>Risk:</span>
              {(['All', 'Critical', 'High', 'Elevated', 'Moderate', 'Low'] as const).map((r) => {
                const riskColor: Record<string, string> = { All: '#8892a4', Critical: '#ef4444', High: '#f97316', Elevated: '#f59e0b', Moderate: '#eab308', Low: '#22c55e' };
                const active = riskFilter === r;
                return (
                  <button key={r} onClick={() => setRiskFilter(r)} className="text-xs px-2 py-1 rounded font-medium" style={{ background: active ? `${riskColor[r]}22` : 'rgba(255,255,255,0.05)', color: active ? riskColor[r] : '#8892a4', border: active ? `1px solid ${riskColor[r]}55` : '1px solid transparent' }}>
                    {r === 'All' ? 'All' : `${RISK_EMOJI[r]} ${r}`}
                  </button>
                );
              })}
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: 16 }} />
              <button onClick={handleReset} className="text-xs px-2.5 py-1 rounded font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>↺ Reset</button>
            </div>
          </div>

          {/* Flat study table */}
          <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
            {sortedStudies.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: '#8892a4' }}>No studies match the current filters.</div>
            ) : (
              <table className="w-full text-xs" style={{ minWidth: 1000, borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#1c2230' }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Sponsor', 'Portfolio', 'Study', 'TA', 'Type', 'Risk', 'FPI', 'DBL', 'Wks to DBL', 'Prod %', 'QC %', 'QC Fail', 'Sig. Delays'].map((h) => (
                      <th key={h} className="text-left px-3 py-2 whitespace-nowrap" style={colStyle}>{h}</th>
                    ))}
                  </tr>
                  {/* Inline column filters */}
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#161b24' }}>
                    <th className="px-2 py-1">
                      <select value={tableSponsorFilter} onChange={(e) => setTableSponsorFilter(e.target.value)} style={{ background: '#0d1117', color: '#e8eaf0', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10, borderRadius: 3, width: '100%', padding: '2px 4px' }}>
                        {clients.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </th>
                    <th className="px-2 py-1">
                      <select value={tablePortfolioFilter} onChange={(e) => setTablePortfolioFilter(e.target.value)} style={{ background: '#0d1117', color: '#e8eaf0', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10, borderRadius: 3, width: '100%', padding: '2px 4px' }}>
                        <option value="All">All</option>
                        {portfolios.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </th>
                    <th colSpan={11} />
                  </tr>
                </thead>
                <tbody>
                  {sortedStudies.map((study) => {
                    const eTier = effectiveTier(study, savedUpdates);
                    const bump = savedUpdates.find((u) => u.study === study.study)?.riskBump ?? 0;
                    const ms = nextUpcomingMilestone(study, savedUpdates);
                    const sFail = study.total_del > 0 ? ((study.failed_qc / study.total_del) * 100).toFixed(0) : '0';
                    const wkColor = study.weeks_to_dbl !== null && study.weeks_to_dbl <= 4 ? '#ef4444' : study.weeks_to_dbl !== null && study.weeks_to_dbl <= 8 ? '#f97316' : '#8892a4';
                    const isSelected = selectedStudy === study.study;
                    return (
                      <>
                        <tr
                          key={study.study}
                          className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isSelected ? 'rgba(59,130,246,0.08)' : undefined }}
                          onClick={() => { setSelectedStudy(isSelected ? null : study.study); if (isSelected) setGranularMode(false); }}
                        >
                          <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#8892a4' }}>{study.client}</td>
                          <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{study.portfolio}</td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: isSelected ? '#93c5fd' : '#e8eaf0' }}>
                            <span className="mr-1" style={{ color: '#8892a4' }}>{isSelected ? '▼' : '▶'}</span>
                            {study.study}
                            {ms && <span className="ml-2 text-xs" style={{ color: '#8892a4' }}>📅 {ms.date}</span>}
                            {bump > 0 && <span className="ml-2 text-xs font-semibold" style={{ color: '#ef4444' }}>+{(bump * 100).toFixed(0)}%</span>}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#8892a4' }}>{study.ta}</td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: study.fso_fsp === 'FSO' ? 'rgba(46,165,94,0.1)' : 'rgba(59,130,246,0.1)', color: study.fso_fsp === 'FSO' ? '#2ea55e' : '#3b82f6' }}>{study.fso_fsp}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${RISK_STYLES[eTier]}`}>{RISK_EMOJI[eTier]} {eTier}</span>
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
                        {isSelected && (
                          <tr key={`${study.study}-drilldown`}>
                            <td colSpan={13} style={{ padding: 0 }}>
                              <DrillDown study={study} onClose={() => { setSelectedStudy(null); setGranularMode(false); }} effectiveTier={eTier} riskBump={bump} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Deliverable Tracker */}
        <AllRecordsPanel
          label={bottomPanelLabel}
          studies={bottomPanelStudies}
          filterStudy={selectedStudy}
          granularMode={granularMode}
          onGranularToggle={() => setGranularMode((g) => !g)}
          onClear={selectedStudy ? () => { setSelectedStudy(null); setGranularMode(false); } : undefined}
        />
      </main>
    </div>
  );
}
