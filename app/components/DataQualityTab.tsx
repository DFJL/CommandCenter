'use client';

import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, LabelList } from 'recharts';

type DQIssue = {
  study: string;
  issue: string;
  category: string;
  file: string;
};

const DQ_DATA: DQIssue[] = [
  { study: 'NOVA-103', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000000215932_CAP-100-1_qc_tracker.xlsm' },
  { study: 'NEBULA-105', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001009369_QRNT-012_Programming Deliverables QC and Issues Tracker_Dry Run 1.xlsm' },
  { study: 'LUMEN-110', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001010430_OBEZ-303_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'PULSAR-104', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001013153_YN001-203 Phase II-IV Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'ATLAS-118', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000000205053_000000205053_dsur_202605 QC Tracker.xlsm' },
  { study: 'LUMEN-116', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000000194066_20510 Phase II-IV Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'MERIDIAN-119', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000000205052_000000205052_dsur_202605 QC Tracker.xlsm' },
  { study: 'PULSAR-132', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000000242433_D3S-002-100 Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'EVEREST-156', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001007099_SAB_142_201_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'HORIZON-157', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001005962_D6940C00006_qc_tracker.xlsm' },
  { study: 'PIONEER-159', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001004722_D9260C00003_Programming_Tracker.xlsm' },
  { study: 'ATLAS-168', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001005264_D6800C00005_QC Tracker_SDTM_monthly.xlsm' },
  { study: 'MERIDIAN-169', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001001800_ABX-001-01_Programming Tracker.xlsm' },
  { study: 'ATLAS-174', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001007948_QC Tracker.xlsm' },
  { study: 'AURORA-176', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001007525_ORT-2024-02_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'PIONEER-109', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001002481_D7060C00003_QC_tracker.xlsm' },
  { study: 'PIONEER-109', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001002481_D7060C00003_QC_tracker.xlsm' },
  { study: 'LUMEN-110', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001010430_OBEZ-303_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'LUMEN-110', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001010430_OBEZ-303_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'VENTURE-123', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000000230493_ITF_3756_01_Programming_Tracker_v2.xlsm' },
  { study: 'VENTURE-123', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000000230493_ITF_3756_01_Programming_Tracker_v2.xlsm' },
  { study: 'HORIZON-135', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000000242174_D8310C00001_Programming_Tracker.xlsm' },
  { study: 'HORIZON-135', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000000242174_D8310C00001_Programming_Tracker.xlsm' },
  { study: 'VENTURE-139', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001004982_TG-TPX-115-24-US-01 Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'VENTURE-139', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001004982_TG-TPX-115-24-US-01 Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'SOLSTICE-140', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000000237894_NMK89P101_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'SOLSTICE-140', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000000237894_NMK89P101_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'ATLAS-146', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000000246793_000000246793_TT-CSP-001_QC Tracker.xlsm' },
  { study: 'ATLAS-146', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000000246793_000000246793_TT-CSP-001_QC Tracker.xlsm' },
  { study: 'NOVA-147', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000000244992_CT7001_003_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'NOVA-147', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000000244992_CT7001_003_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'AURORA-148', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000000246894_LX4211_1_314_HCM Programming Tracker.xlsm' },
  { study: 'AURORA-148', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000000246894_LX4211_1_314_HCM Programming Tracker.xlsm' },
  { study: 'PIONEER-143', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001004822_TACTI-004_Programming_Tracker.xlsm' },
  { study: 'PIONEER-143', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001004822_TACTI-004_Programming_Tracker.xlsm' },
  { study: 'LUMEN-144', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001002760_OBEZ-302_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'LUMEN-144', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001002760_OBEZ-302_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'PULSAR-148', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001000300_D516AC00003_QC_tracker.xlsm' },
  { study: 'PULSAR-148', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001000300_D516AC00003_QC_tracker.xlsm' },
  { study: 'LUMEN-160', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001003782_D853AC00001_programming_tracker.xlsm' },
  { study: 'LUMEN-160', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001003782_D853AC00001_programming_tracker.xlsm' },
  { study: 'SOLSTICE-168', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001004763_D3250C00101_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'SOLSTICE-168', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001004763_D3250C00101_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'MERIDIAN-169', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001001800_ABX-001-01_Programming Tracker.xlsm' },
  { study: 'MERIDIAN-169', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001001800_ABX-001-01_Programming Tracker.xlsm' },
  { study: 'PIONEER-115', issue: 'Has TLFs (Figures, Listings, Tables) but no ADaMs or SDTMs', category: 'Missing upstream deliverables', file: '000000194827_d8227c00001_Tracker_IA_Final.xlsm' },
  { study: 'MERIDIAN-125', issue: 'Has ADaMs but no SDTMs', category: 'Missing upstream deliverables', file: '000000229452A_Pooled Pharming QC Tracker.xlsm' },
  { study: 'MERIDIAN-125', issue: 'Has ADaMs but no SDTMs', category: 'Missing upstream deliverables', file: '000000229452_000000229452 Analysis QC Documentation Apr2026.xlsm' },
  { study: 'VENTURE-145', issue: 'Has ADaMs but no SDTMs', category: 'Missing upstream deliverables', file: '000000246212_000000246212 Analysis QC Documentation 5Aug2024.xlsm' },
  { study: 'NOVA-119', issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000000186444_D3254C00001_OLEDR_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'EVEREST-112', issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000000190065_D3615C00001_QC_tracker_China.xlsm' },
  { study: 'VENTURE-117', issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000000215633_HS_19_657_QC Tracker_PFS_Analysis_Dry_Run_2c_new.xlsm' },
  { study: 'AURORA-126', issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000000214374_MIN-003_AURORA-126_Tracking Sheet_DryRun2.xlsm' },
  { study: 'VENTURE-123', issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000000230493_ITF_3756_01_Programming_Tracker_v2.xlsm' },
  { study: 'LUMEN-144', issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000001002760_OBEZ-302_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'SOLSTICE-146', issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000001004522_D5242C00002_dryrun_Programming Deliverables QC and Issues Tracker.xlsm' },
];

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  'Incomplete deliverable coverage': { label: 'COVERAGE',     color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  'Missing metadata':                { label: 'METADATA',     color: '#eab308', bg: 'rgba(234,179,8,0.12)'  },
  'Missing upstream deliverables':   { label: 'UPSTREAM',     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'Status inconsistency':            { label: 'INCONSISTENCY',color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
};

const DONUT_COLORS = ['#f97316', '#eab308', '#3b82f6', '#ef4444'];

const CAT_KEYS = Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[];

export default function DataQualityTab() {
  const [view, setView] = useState<'issues' | 'summary'>('issues');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');

  const categories = useMemo(() => ['All', ...CAT_KEYS], []);

  // Study-level summary: each study with a count per category
  const studySummary = useMemo(() => {
    const map: Record<string, Record<string, number> & { total: number }> = {};
    for (const r of DQ_DATA) {
      if (!map[r.study]) map[r.study] = { total: 0, 'Incomplete deliverable coverage': 0, 'Missing metadata': 0, 'Missing upstream deliverables': 0, 'Status inconsistency': 0 };
      map[r.study].total++;
      map[r.study][r.category]++;
    }
    return Object.entries(map)
      .map(([study, counts]) => ({ study, ...counts }))
      .sort((a, b) => b.total - a.total);
  }, []);

  const filtered = useMemo(() => {
    let rows = DQ_DATA;
    if (categoryFilter !== 'All') rows = rows.filter((r) => r.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        r.study.toLowerCase().includes(q) ||
        r.issue.toLowerCase().includes(q) ||
        r.file.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [categoryFilter, search]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of DQ_DATA) map[r.category] = (map[r.category] ?? 0) + 1;
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, []);

  const studyBarData = useMemo(() => {
    const src = categoryFilter === 'All' ? DQ_DATA : DQ_DATA.filter((r) => r.category === categoryFilter);
    const map: Record<string, number> = {};
    for (const r of src) map[r.study] = (map[r.study] ?? 0) + 1;
    return Object.entries(map).map(([study, count]) => ({ study, count })).sort((a, b) => b.count - a.count).slice(0, 20);
  }, [categoryFilter]);

  const studiesAffected = new Set(DQ_DATA.map((r) => r.study)).size;

  const exportCsv = () => {
    const header = 'Study,Issue,Category,File';
    const rows = filtered.map((r) => `"${r.study}","${r.issue}","${r.category}","${r.file}"`);
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'data_quality_issues.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 space-y-5">
      {/* KPI Cards + view toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="grid grid-cols-4 gap-3 flex-1">

        {[
          { label: 'Total Issues', value: DQ_DATA.length, color: '#ef4444' },
          { label: 'Studies Affected', value: studiesAffected, color: '#f97316' },
          { label: 'Issue Categories', value: Object.keys(CATEGORY_META).length, color: '#3b82f6' },
          { label: 'Showing (Filtered)', value: filtered.length, color: '#2ea55e' },
        ].map((k) => (
          <div key={k.label} className="rounded-lg p-4 text-center" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-3xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs mt-1" style={{ color: '#8892a4' }}>{k.label}</div>
          </div>
        ))}
        </div>
        {/* View toggle */}
        <div className="flex items-center gap-0 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.1)', height: 'fit-content' }}>
          {(['issues', 'summary'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className="px-4 py-2 text-sm font-medium transition-colors" style={view === v ? { background: '#2ea55e', color: '#fff' } : { background: 'transparent', color: '#8892a4' }}>
              {v === 'issues' ? 'Issue Detail' : 'Study Summary'}
            </button>
          ))}
        </div>
      </div>

      {/* ── STUDY SUMMARY VIEW ── */}
      {view === 'summary' && (
        <>
          {/* Stacked bar chart */}
          <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: '#e8eaf0' }}>Issues by Study — Category Breakdown</p>
            <ResponsiveContainer width="100%" height={studySummary.length * 28 + 40}>
              <BarChart layout="vertical" data={studySummary} margin={{ top: 0, right: 60, left: 4, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="study" tick={{ fill: '#e8eaf0', fontSize: 10 }} axisLine={false} tickLine={false} width={88} />
                <Tooltip
                  contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: '#e8eaf0' }} itemStyle={{ color: '#8892a4' }}
                  formatter={(value, name) => [value, CATEGORY_META[name as string]?.label ?? name]}
                />
                {CAT_KEYS.map((cat) => (
                  <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_META[cat].color} name={cat}
                    radius={cat === 'Status inconsistency' ? [0, 3, 3, 0] : undefined}>
                    {cat === 'Status inconsistency' && <LabelList dataKey="total" position="right" style={{ fill: '#8892a4', fontSize: 9 }} />}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-4 mt-3 px-1">
              {CAT_KEYS.map((cat) => (
                <div key={cat} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CATEGORY_META[cat].color }} />
                  <span className="text-xs" style={{ color: '#8892a4' }}>{CATEGORY_META[cat].label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary table */}
          <div className="rounded-lg overflow-hidden" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-4 py-3" style={{ background: '#1a5c38' }}>
              <p className="text-sm font-bold text-white">Study Summary — {studySummary.length} Studies Affected</p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead style={{ background: '#1c2230' }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <th className="text-left px-4 py-2" style={{ color: '#8892a4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Study</th>
                    <th className="text-center px-3 py-2" style={{ color: '#8892a4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</th>
                    {CAT_KEYS.map((cat) => (
                      <th key={cat} className="text-center px-3 py-2 whitespace-nowrap" style={{ color: CATEGORY_META[cat].color, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{CATEGORY_META[cat].label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {studySummary.map((row) => (
                    <tr
                      key={row.study}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onClick={() => { setView('issues'); setSearch(row.study); }}
                    >
                      <td className="px-4 py-2 font-medium" style={{ color: '#e8eaf0' }}>{row.study}</td>
                      <td className="px-3 py-2 text-center font-bold" style={{ color: '#e8eaf0' }}>{row.total}</td>
                      {CAT_KEYS.map((cat) => {
                        const val = (row as unknown as Record<string, number>)[cat] ?? 0;
                        return (
                          <td key={cat} className="px-3 py-2 text-center">
                            {val > 0 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: CATEGORY_META[cat].bg, color: CATEGORY_META[cat].color }}>{val}</span>
                            ) : <span style={{ color: '#374151' }}>—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── ISSUE DETAIL VIEW ── */}
      {view === 'issues' && (<>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-5">
        {/* Donut */}
        <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: '#e8eaf0' }}>Issues by Category</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={2}>
                {categoryData.map((entry, idx) => {
                  const meta = CATEGORY_META[entry.name];
                  return <Cell key={idx} fill={meta?.color ?? DONUT_COLORS[idx % DONUT_COLORS.length]} />;
                })}
              </Pie>
              <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }} labelStyle={{ color: '#e8eaf0' }} itemStyle={{ color: '#8892a4' }} />
              <Legend
                wrapperStyle={{ color: '#8892a4', fontSize: 10 }}
                formatter={(value) => {
                  const meta = CATEGORY_META[value];
                  return meta ? <span style={{ color: meta.color }}>{meta.label}</span> : value;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar: issues per study */}
        <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: '#e8eaf0' }}>
            Issues per Study
            {categoryFilter !== 'All' && <span className="ml-2 text-xs font-normal" style={{ color: CATEGORY_META[categoryFilter]?.color }}> — {CATEGORY_META[categoryFilter]?.label}</span>}
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart layout="vertical" data={studyBarData} margin={{ top: 0, right: 24, left: 4, bottom: 0 }}>
              <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="study" tick={{ fill: '#8892a4', fontSize: 9 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }} labelStyle={{ color: '#e8eaf0' }} itemStyle={{ color: '#8892a4' }} />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}
                fill={categoryFilter !== 'All' ? (CATEGORY_META[categoryFilter]?.color ?? '#3b82f6') : '#2ea55e'}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label={{ position: 'right', fill: '#8892a4', fontSize: 9, formatter: (v: any) => String(v ?? '') }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Issue Detail Table */}
      <div className="rounded-lg" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3 px-4 py-3 flex-wrap" style={{ background: '#1a5c38', borderRadius: '0.5rem 0.5rem 0 0' }}>
          <p className="text-sm font-bold text-white flex-1">Issue Detail</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">Filter:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs rounded px-2 py-1.5 border outline-none"
              style={{ background: '#1c2230', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.15)' }}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c === 'All' ? 'All categories' : (CATEGORY_META[c]?.label ?? c)}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 rounded px-2 py-1" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search studies, issues, files…"
                className="text-xs outline-none bg-transparent w-48"
                style={{ color: '#e8eaf0' }}
              />
            </div>
            <button
              onClick={exportCsv}
              className="text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            >
              ↓ Export CSV
            </button>
          </div>
        </div>
        <div style={{ maxHeight: 440, overflowY: 'auto' }}>
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Study', 'Issue description', 'Category', 'File name'].map((h) => (
                  <th key={h} className="text-left px-4 py-2 whitespace-nowrap" style={{ color: '#8892a4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: '#8892a4' }}>No issues match the filters.</td></tr>
              ) : filtered.map((r, i) => {
                const meta = CATEGORY_META[r.category];
                return (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="px-4 py-2 font-medium whitespace-nowrap" style={{ color: '#e8eaf0' }}>{r.study}</td>
                    <td className="px-4 py-2" style={{ color: '#8892a4', maxWidth: 400 }}>{r.issue}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ color: meta?.color ?? '#8892a4', background: meta?.bg ?? 'rgba(255,255,255,0.05)' }}>
                        {meta?.label ?? r.category}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs truncate max-w-xs" style={{ color: '#6b7280' }} title={r.file}>{r.file}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      </>)}  {/* end issues view */}
    </div>
  );
}
