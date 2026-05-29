'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

type DQIssue = { study: string; issue: string; category: string; file: string };

const DQ_DATA: DQIssue[] = [
  { study: 'NOVA-103',     issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000000215932_CAP-100-1_qc_tracker.xlsm' },
  { study: 'NEBULA-105',   issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001009369_QRNT-012_Programming Deliverables QC and Issues Tracker_Dry Run 1.xlsm' },
  { study: 'LUMEN-110',    issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001010430_OBEZ-303_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'PULSAR-104',   issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001013153_YN001-203 Phase II-IV Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'ATLAS-118',    issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000000205053_000000205053_dsur_202605 QC Tracker.xlsm' },
  { study: 'LUMEN-116',    issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000000194066_20510 Phase II-IV Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'MERIDIAN-119', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000000205052_000000205052_dsur_202605 QC Tracker.xlsm' },
  { study: 'PULSAR-132',   issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000000242433_D3S-002-100 Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'EVEREST-156',  issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001007099_SAB_142_201_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'HORIZON-157',  issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001005962_D6940C00006_qc_tracker.xlsm' },
  { study: 'PIONEER-159',  issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001004722_D9260C00003_Programming_Tracker.xlsm' },
  { study: 'ATLAS-168',    issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001005264_D6800C00005_QC Tracker_SDTM_monthly.xlsm' },
  { study: 'MERIDIAN-169', issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001001800_ABX-001-01_Programming Tracker.xlsm' },
  { study: 'ATLAS-174',    issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001007948_QC Tracker.xlsm' },
  { study: 'AURORA-176',   issue: 'Only one deliverable type present: SDTMs', category: 'Incomplete deliverable coverage', file: '000001007525_ORT-2024-02_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'PIONEER-109',  issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001002481_D7060C00003_QC_tracker.xlsm' },
  { study: 'PIONEER-109',  issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001002481_D7060C00003_QC_tracker.xlsm' },
  { study: 'LUMEN-110',    issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001010430_OBEZ-303_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'LUMEN-110',    issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001010430_OBEZ-303_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'VENTURE-123',  issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000000230493_ITF_3756_01_Programming_Tracker_v2.xlsm' },
  { study: 'VENTURE-123',  issue: 'Incomplete cover page', category: 'Missing metadata', file: '000000230493_ITF_3756_01_Programming_Tracker_v2.xlsm' },
  { study: 'HORIZON-135',  issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000000242174_D8310C00001_Programming_Tracker.xlsm' },
  { study: 'HORIZON-135',  issue: 'Incomplete cover page', category: 'Missing metadata', file: '000000242174_D8310C00001_Programming_Tracker.xlsm' },
  { study: 'VENTURE-139',  issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001004982_TG-TPX-115-24-US-01 Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'VENTURE-139',  issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001004982_TG-TPX-115-24-US-01 Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'SOLSTICE-140', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000000237894_NMK89P101_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'SOLSTICE-140', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000000237894_NMK89P101_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'ATLAS-146',    issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000000246793_000000246793_TT-CSP-001_QC Tracker.xlsm' },
  { study: 'ATLAS-146',    issue: 'Incomplete cover page', category: 'Missing metadata', file: '000000246793_000000246793_TT-CSP-001_QC Tracker.xlsm' },
  { study: 'NOVA-147',     issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000000244992_CT7001_003_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'NOVA-147',     issue: 'Incomplete cover page', category: 'Missing metadata', file: '000000244992_CT7001_003_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'AURORA-148',   issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000000246894_LX4211_1_314_HCM Programming Tracker.xlsm' },
  { study: 'AURORA-148',   issue: 'Incomplete cover page', category: 'Missing metadata', file: '000000246894_LX4211_1_314_HCM Programming Tracker.xlsm' },
  { study: 'PIONEER-143',  issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001004822_TACTI-004_Programming_Tracker.xlsm' },
  { study: 'PIONEER-143',  issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001004822_TACTI-004_Programming_Tracker.xlsm' },
  { study: 'LUMEN-144',    issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001002760_OBEZ-302_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'LUMEN-144',    issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001002760_OBEZ-302_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'PULSAR-148',   issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001000300_D516AC00003_QC_tracker.xlsm' },
  { study: 'PULSAR-148',   issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001000300_D516AC00003_QC_tracker.xlsm' },
  { study: 'LUMEN-160',    issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001003782_D853AC00001_programming_tracker.xlsm' },
  { study: 'LUMEN-160',    issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001003782_D853AC00001_programming_tracker.xlsm' },
  { study: 'SOLSTICE-168', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001004763_D3250C00101_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'SOLSTICE-168', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001004763_D3250C00101_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'MERIDIAN-169', issue: 'Missing Therapeutic Area', category: 'Missing metadata', file: '000001001800_ABX-001-01_Programming Tracker.xlsm' },
  { study: 'MERIDIAN-169', issue: 'Incomplete cover page', category: 'Missing metadata', file: '000001001800_ABX-001-01_Programming Tracker.xlsm' },
  { study: 'PIONEER-115',  issue: 'Has TLFs (Figures, Listings, Tables) but no ADaMs or SDTMs', category: 'Missing upstream deliverables', file: '000000194827_d8227c00001_Tracker_IA_Final.xlsm' },
  { study: 'MERIDIAN-125', issue: 'Has ADaMs but no SDTMs', category: 'Missing upstream deliverables', file: '000000229452A_Pooled Pharming QC Tracker.xlsm' },
  { study: 'MERIDIAN-125', issue: 'Has ADaMs but no SDTMs', category: 'Missing upstream deliverables', file: '000000229452_000000229452 Analysis QC Documentation Apr2026.xlsm' },
  { study: 'VENTURE-145',  issue: 'Has ADaMs but no SDTMs', category: 'Missing upstream deliverables', file: '000000246212_000000246212 Analysis QC Documentation 5Aug2024.xlsm' },
  { study: 'NOVA-119',     issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000000186444_D3254C00001_OLEDR_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'EVEREST-112',  issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000000190065_D3615C00001_QC_tracker_China.xlsm' },
  { study: 'VENTURE-117',  issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000000215633_HS_19_657_QC Tracker_PFS_Analysis_Dry_Run_2c_new.xlsm' },
  { study: 'AURORA-126',   issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000000214374_MIN-003_AURORA-126_Tracking Sheet_DryRun2.xlsm' },
  { study: 'VENTURE-123',  issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000000230493_ITF_3756_01_Programming_Tracker_v2.xlsm' },
  { study: 'LUMEN-144',    issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000001002760_OBEZ-302_Programming Deliverables QC and Issues Tracker.xlsm' },
  { study: 'SOLSTICE-146', issue: "QC is 'Passed QC' but Production is not 'Ready for QC'", category: 'Status inconsistency', file: '000001004522_D5242C00002_dryrun_Programming Deliverables QC and Issues Tracker.xlsm' },
];

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  'Incomplete deliverable coverage': { label: 'COVERAGE',     color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  'Missing metadata':                { label: 'METADATA',     color: '#eab308', bg: 'rgba(234,179,8,0.12)'  },
  'Missing upstream deliverables':   { label: 'UPSTREAM',     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'Status inconsistency':            { label: 'INCONSISTENCY',color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
};

const CAT_KEYS = [
  'Incomplete deliverable coverage',
  'Missing metadata',
  'Missing upstream deliverables',
  'Status inconsistency',
] as const;
type CatKey = (typeof CAT_KEYS)[number];

const getClient = (study: string) => study.split('-')[0];

type ClientSummary = {
  client: string; total: number; studyCount: number;
  'Incomplete deliverable coverage': number; 'Missing metadata': number;
  'Missing upstream deliverables': number; 'Status inconsistency': number;
};
type StudySummary = {
  study: string; total: number;
  'Incomplete deliverable coverage': number; 'Missing metadata': number;
  'Missing upstream deliverables': number; 'Status inconsistency': number;
};

const TT_STYLE = {
  contentStyle: { background: '#1c2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 },
  labelStyle: { color: '#e8eaf0' }, itemStyle: { color: '#8892a4' },
};

function catBadge(val: number, cat: CatKey) {
  const m = CATEGORY_META[cat];
  return val > 0
    ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: m.bg, color: m.color }}>{val}</span>
    : <span style={{ color: '#374151' }}>—</span>;
}

function CatLegend() {
  return (
    <div className="flex flex-wrap gap-4 mt-3 px-1">
      {CAT_KEYS.map((cat) => (
        <div key={cat} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_META[cat].color }} />
          <span className="text-xs" style={{ color: '#8892a4' }}>{CATEGORY_META[cat].label}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
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

function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead style={{ background: '#1c2230' }}>
      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {cols.map((h) => (
          <th key={h} className="text-left px-4 py-2 whitespace-nowrap"
            style={{ color: '#8892a4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
        ))}
      </tr>
    </thead>
  );
}

function StackedChart({ data, yKey, height }: { data: object[]; yKey: string; height: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart layout="vertical" data={data} margin={{ top: 0, right: 60, left: 4, bottom: 0 }}>
        <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey={yKey} tick={{ fill: '#e8eaf0', fontSize: 11 }} axisLine={false} tickLine={false} width={88} />
        <Tooltip {...TT_STYLE} formatter={(v, n) => [v, CATEGORY_META[n as string]?.label ?? n]} />
        {CAT_KEYS.map((cat, i) => (
          <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_META[cat].color} name={cat}
            radius={i === CAT_KEYS.length - 1 ? [0, 3, 3, 0] : undefined}>
            {i === CAT_KEYS.length - 1 && (
              <LabelList dataKey="total" position="right" style={{ fill: '#8892a4', fontSize: 9 }} />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function DataQualityTab() {
  const [level, setLevel] = useState<0 | 1 | 2>(0);
  const [selClient, setSelClient] = useState('');
  const [selStudy, setSelStudy] = useState('');

  const go = (l: 0 | 1 | 2, client = '', study = '') => {
    setLevel(l);
    setSelClient(client);
    setSelStudy(study);
  };

  // ── Level 0: client aggregations ──────────────────────────
  const clientRows = useMemo<ClientSummary[]>(() => {
    const countMap: Record<string, ClientSummary> = {};
    const studySets: Record<string, Set<string>> = {};
    for (const r of DQ_DATA) {
      const c = getClient(r.study);
      if (!countMap[c]) {
        countMap[c] = { client: c, total: 0, studyCount: 0, 'Incomplete deliverable coverage': 0, 'Missing metadata': 0, 'Missing upstream deliverables': 0, 'Status inconsistency': 0 };
        studySets[c] = new Set();
      }
      countMap[c].total++;
      studySets[c].add(r.study);
      countMap[c][r.category as CatKey]++;
    }
    return Object.values(countMap)
      .map((row) => ({ ...row, studyCount: studySets[row.client].size }))
      .sort((a, b) => b.total - a.total);
  }, []);

  // ── Level 1: study aggregations for selected client ────────
  const studyRows = useMemo<StudySummary[]>(() => {
    const src = DQ_DATA.filter((r) => getClient(r.study) === selClient);
    const map: Record<string, StudySummary> = {};
    for (const r of src) {
      if (!map[r.study]) map[r.study] = { study: r.study, total: 0, 'Incomplete deliverable coverage': 0, 'Missing metadata': 0, 'Missing upstream deliverables': 0, 'Status inconsistency': 0 };
      map[r.study].total++;
      map[r.study][r.category as CatKey]++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [selClient]);

  // ── Level 2: raw issues for selected study ─────────────────
  const rawIssues = useMemo(() => DQ_DATA.filter((r) => r.study === selStudy), [selStudy]);

  const allStudies = useMemo(() => new Set(DQ_DATA.map((r) => r.study)).size, []);
  const clientKpis = { total: studyRows.reduce((s, r) => s + r.total, 0), studies: studyRows.length };

  return (
    <div className="p-5 space-y-4">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm font-medium">
        <button onClick={() => go(0)} style={{ color: level === 0 ? '#2ea55e' : '#8892a4' }}>
          Data Quality
        </button>
        {level >= 1 && (
          <>
            <span style={{ color: '#374151' }}>›</span>
            <button onClick={() => go(1, selClient)} style={{ color: level === 1 ? '#2ea55e' : '#8892a4' }}>
              {selClient}
            </button>
          </>
        )}
        {level === 2 && (
          <>
            <span style={{ color: '#374151' }}>›</span>
            <span style={{ color: '#2ea55e' }}>{selStudy}</span>
          </>
        )}
      </nav>

      {/* ══════════════════════════════════════════════════════
          LEVEL 0 — Client overview
      ══════════════════════════════════════════════════════ */}
      {level === 0 && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Total Issues"    value={DQ_DATA.length}     color="#ef4444" />
            <KpiCard label="Clients"          value={clientRows.length}  color="#8b5cf6" />
            <KpiCard label="Studies Affected" value={allStudies}         color="#f97316" />
            <KpiCard label="Issue Types"      value={CAT_KEYS.length}    color="#3b82f6" />
          </div>

          <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: '#e8eaf0' }}>Issues by Client — Category Breakdown</p>
            <StackedChart data={clientRows} yKey="client" height={clientRows.length * 34 + 40} />
            <CatLegend />
          </div>

          <div className="rounded-lg overflow-hidden" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionHeader>{clientRows.length} Clients with Issues · Click to explore studies</SectionHeader>
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <TableHead cols={['Client', 'Studies', 'Total', ...CAT_KEYS.map((k) => CATEGORY_META[k].label), '']} />
              <tbody>
                {clientRows.map((row) => (
                  <tr key={row.client}
                    className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onClick={() => go(1, row.client)}>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: '#e8eaf0' }}>{row.client}</td>
                    <td className="px-4 py-2.5 text-center" style={{ color: '#8892a4' }}>{row.studyCount}</td>
                    <td className="px-4 py-2.5 text-center font-bold" style={{ color: '#e8eaf0' }}>{row.total}</td>
                    {CAT_KEYS.map((cat) => (
                      <td key={cat} className="px-4 py-2.5 text-center">{catBadge(row[cat], cat)}</td>
                    ))}
                    <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#2ea55e' }}>→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          LEVEL 1 — Studies within client
      ══════════════════════════════════════════════════════ */}
      {level === 1 && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Issues in Client" value={clientKpis.total}   color="#ef4444" />
            <KpiCard label="Studies"           value={clientKpis.studies} color="#f97316" />
            <KpiCard label="Types Active"      value={CAT_KEYS.filter((k) => studyRows.some((s) => s[k] > 0)).length} color="#3b82f6" />
            <KpiCard label="Most per Study"    value={studyRows[0]?.total ?? 0} color="#8b5cf6" />
          </div>

          <div className="rounded-lg p-4" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: '#e8eaf0' }}>Issues by Study — {selClient}</p>
            <StackedChart data={studyRows} yKey="study" height={Math.max(studyRows.length * 34 + 40, 100)} />
            <CatLegend />
          </div>

          <div className="rounded-lg overflow-hidden" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionHeader>{selClient} — {studyRows.length} Studies · Click to view raw issues</SectionHeader>
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <TableHead cols={['Study', 'Total', ...CAT_KEYS.map((k) => CATEGORY_META[k].label), '']} />
              <tbody>
                {studyRows.map((row) => (
                  <tr key={row.study}
                    className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onClick={() => go(2, selClient, row.study)}>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: '#e8eaf0' }}>{row.study}</td>
                    <td className="px-4 py-2.5 text-center font-bold" style={{ color: '#e8eaf0' }}>{row.total}</td>
                    {CAT_KEYS.map((cat) => (
                      <td key={cat} className="px-4 py-2.5 text-center">{catBadge(row[cat], cat)}</td>
                    ))}
                    <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#2ea55e' }}>→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          LEVEL 2 — Raw issues for study
      ══════════════════════════════════════════════════════ */}
      {level === 2 && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {CAT_KEYS.map((cat) => {
              const count = rawIssues.filter((r) => r.category === cat).length;
              const m = CATEGORY_META[cat];
              return (
                <div key={cat} className="rounded-lg p-4 text-center"
                  style={{ background: '#161b24', border: `1px solid ${m.color}40` }}>
                  <div className="text-3xl font-bold" style={{ color: m.color }}>{count}</div>
                  <div className="text-xs mt-1" style={{ color: '#8892a4' }}>{m.label}</div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg overflow-hidden" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionHeader>{selStudy} — {rawIssues.length} Issue{rawIssues.length !== 1 ? 's' : ''}</SectionHeader>
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <TableHead cols={['#', 'Issue Description', 'Category', 'File']} />
              <tbody>
                {rawIssues.map((r, i) => {
                  const m = CATEGORY_META[r.category];
                  return (
                    <tr key={i} className="hover:bg-white/[0.02]"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-4 py-3 text-center w-8" style={{ color: '#6b7280' }}>{i + 1}</td>
                      <td className="px-4 py-3" style={{ color: '#e8eaf0' }}>{r.issue}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs px-2 py-0.5 rounded font-semibold"
                          style={{ color: m?.color, background: m?.bg }}>
                          {m?.label ?? r.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs truncate max-w-xs"
                        style={{ color: '#6b7280' }} title={r.file}>{r.file}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  );
}
