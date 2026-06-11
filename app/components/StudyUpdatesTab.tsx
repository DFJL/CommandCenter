'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Study, StudyUpdate, StudyMetadata, IssueLogEntry, CustomStudy, MilestoneEntry, DeliverableRow } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────
const MILESTONE_TYPES = [
  'First Patient In (FPI)', 'Last Patient Out (LPO)', 'Database Lock (DBL)',
  'SAP Finalization', 'Programming Start', 'TFL Delivery', 'Interim Analysis',
  'DMC Meeting', 'Protocol Amendment', 'SDTM Delivery', 'ADaM Delivery', 'CSR Submission', 'Other',
];

const DEL_TYPES = ['SDTMs', 'ADaMs', 'Tables', 'Figures', 'Listings', 'Define.xml'] as const;
type DelType = (typeof DEL_TYPES)[number];

const QC_METHODS = ['IP FC', 'IP DC', 'QC Review', 'Self-check', 'N/A'];
const PROG_STATUSES = ['Not Started', 'In Progress', 'Ready for QC', 'Passed QC', 'Delivered', 'On Hold'];
const QC_STATUSES = ['Not Started', 'In Progress', 'Passed QC', 'Failed QC', 'N/A'];

const ISSUE_TYPES = [
  'Calculations/Logic', 'Mock Shell / Spec Update', 'Mock Shell Inconsistency',
  'New Programming Request', 'Data Issue', 'Coding Incorrect or Inefficient',
  'Cosmetic Update', 'Log', 'Other',
];
const ISSUE_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'] as const;
const RESPONSIBLE_PARTIES = ['Production Programmer', 'QC Reviewer', 'Lead Statistician', 'Lead Programmer', 'Data Manager', 'Client', 'Other'];
const TA_OPTIONS = ['Oncology', 'Cardiovascular', 'Respiratory', 'Neurology', 'Immunology', 'Rare Disease', 'Hepatology', 'Endocrinology', 'Infectious Disease', 'Other'];
const STUDY_PHASES = ['Phase I', 'Phase I/II', 'Phase II', 'Phase II/III', 'Phase III', 'Phase III/IV', 'Phase IV', 'Other'];

type SubTab = 'register' | 'metadata' | 'issues' | 'deliverables' | 'milestones';

let msCounter = 0;
function newMilestone(): MilestoneEntry {
  return { id: `ms-${++msCounter}`, type: MILESTONE_TYPES[0], planned: '', actual: '' };
}

const PROG_STATUS_COLOR: Record<string, string> = {
  'Not Started': '#6b7280', 'In Progress': '#eab308', 'Ready for QC': '#3b82f6',
  'Passed QC': '#2ea55e', 'Delivered': '#06b6d4', 'On Hold': '#8b5cf6',
};
const QC_STATUS_COLOR: Record<string, string> = {
  'Not Started': '#6b7280', 'In Progress': '#eab308',
  'Passed QC': '#2ea55e', 'Failed QC': '#ef4444', 'N/A': '#6b7280',
};

const BLANK_META: Omit<StudyMetadata, 'id' | 'study' | 'savedAt'> = {
  protocol_plan_no: '', sponsor: '', fortrea_study_id: '', timesheet_billing_code: '',
  lead_statistician: '', lead_programmer: '', study_project_manager: '', data_mgmt_contact: '',
  deliverable_description: '', deliverable_date: '',
  therapeutic_area: '', study_phase: '', raw_data_path: '', sdtm_data_path: '',
  adam_path: '', sdtm_spec_path: '', adam_spec_path: '', client_comments_tracker: '',
  tlfs_path: '', key_programmers: '', project_tracker_path: '',
};

const BLANK_ISSUE: Omit<IssueLogEntry, 'id' | 'study' | 'savedAt' | 'no'> = {
  title: '', table_number: '', issue_description: '', issue_type: ISSUE_TYPES[0],
  initially_reported_by: '', initial_report_date: '', responsible_party: RESPONSIBLE_PARTIES[0],
  issue_status: 'Open', resolved_by: '', final_date_resolved: '', comments: '', resolution: '',
};

function blankDelRow(study: string, deliverable_type: DelType): DeliverableRow {
  return {
    id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    study, deliverable_type, savedAt: new Date().toISOString(),
    data_type_description: '', dataset_name: '', data_spec_author: '',
    qc_method: QC_METHODS[0], production_programmer: '', program_name: '',
    program_status: PROG_STATUSES[0], date_prod_last_run: '',
    qc_reviewer: '', qc_program_name: '',
    qc_status: QC_STATUSES[0], date_qc_last_run: '', comments: '',
  };
}

interface Props {
  studies: Study[];
  onSave: (update: StudyUpdate) => void;
  savedUpdates: StudyUpdate[];
}

export default function StudyUpdatesTab({ studies, onSave, savedUpdates }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('register');
  const [toast, setToast] = useState<string | null>(null);

  // ── Persisted state ──────────────────────────────────────────────────────
  const [customStudies, setCustomStudies] = useState<CustomStudy[]>([]);
  const [savedMetadata, setSavedMetadata] = useState<StudyMetadata[]>([]);
  const [issueLog, setIssueLog] = useState<IssueLogEntry[]>([]);
  const [delRows, setDelRows] = useState<DeliverableRow[]>([]);

  useEffect(() => {
    try {
      const cs = localStorage.getItem('customStudies'); if (cs) setCustomStudies(JSON.parse(cs));
      const sm = localStorage.getItem('studyMetadata'); if (sm) setSavedMetadata(JSON.parse(sm));
      const il = localStorage.getItem('issueLog'); if (il) setIssueLog(JSON.parse(il));
      const dr = localStorage.getItem('deliverableRows'); if (dr) setDelRows(JSON.parse(dr));
    } catch { /* ignore */ }
  }, []);

  const allStudyNames = useMemo(() => {
    const built = studies.map((s) => ({ name: s.study, client: s.client, custom: false }));
    const custom = customStudies.map((s) => ({ name: s.study, client: s.client, custom: true }));
    return [...built, ...custom].sort((a, b) => a.name.localeCompare(b.name));
  }, [studies, customStudies]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Shared style helpers
  const isf = { background: '#0d1117', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' } as const;
  const ic = 'w-full text-xs rounded px-2.5 py-1.5 border outline-none focus:ring-1';
  const lc = 'text-xs font-medium mb-1 block'; const ls = { color: '#8892a4' };
  const sc = 'rounded-lg p-4'; const ss = { background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' };

  // ── REGISTER ─────────────────────────────────────────────────────────────
  const [showAddStudy, setShowAddStudy] = useState(false);
  const [newStudy, setNewStudy] = useState<Omit<CustomStudy, 'id' | 'addedAt'>>({ study: '', client: '', ta: '', fso_fsp: 'FSO', phase: '' });
  const [regSearch, setRegSearch] = useState('');

  const handleAddStudy = () => {
    if (!newStudy.study.trim() || !newStudy.client.trim()) { showToast('Study name and client are required.'); return; }
    const entry: CustomStudy = { ...newStudy, id: `cs-${Date.now()}`, addedAt: new Date().toISOString() };
    const next = [...customStudies, entry];
    setCustomStudies(next); localStorage.setItem('customStudies', JSON.stringify(next));
    setNewStudy({ study: '', client: '', ta: '', fso_fsp: 'FSO', phase: '' });
    setShowAddStudy(false); showToast(`Study ${entry.study} added.`);
  };

  // ── METADATA ─────────────────────────────────────────────────────────────
  const [metaStudy, setMetaStudy] = useState('');
  const [meta, setMeta] = useState({ ...BLANK_META });
  const setM = (k: keyof typeof meta, v: string) => setMeta((p) => ({ ...p, [k]: v }));

  const handleSaveMeta = () => {
    if (!metaStudy) { showToast('Select a study.'); return; }
    const entry: StudyMetadata = { ...meta, id: `sm-${Date.now()}`, study: metaStudy, savedAt: new Date().toISOString() };
    const next = [...savedMetadata.filter((m) => m.study !== metaStudy), entry];
    setSavedMetadata(next); localStorage.setItem('studyMetadata', JSON.stringify(next));
    showToast(`Metadata saved for ${metaStudy}.`);
  };

  const loadMeta = (study: string) => {
    setMetaStudy(study);
    const existing = savedMetadata.find((m) => m.study === study);
    setMeta(existing ? { ...BLANK_META, ...existing } : { ...BLANK_META });
  };

  // ── ISSUE LOG ────────────────────────────────────────────────────────────
  const [issueStudy, setIssueStudy] = useState('');
  const [issueForm, setIssueForm] = useState({ ...BLANK_ISSUE });
  const setIf = (k: keyof typeof issueForm, v: string) => setIssueForm((p) => ({ ...p, [k]: v }));
  const studyIssues = useMemo(() => issueLog.filter((e) => e.study === issueStudy), [issueLog, issueStudy]);

  const handleSaveIssue = () => {
    if (!issueStudy) { showToast('Select a study.'); return; }
    if (!issueForm.issue_description.trim()) { showToast('Issue description is required.'); return; }
    const entry: IssueLogEntry = { ...issueForm, id: `il-${Date.now()}`, study: issueStudy, savedAt: new Date().toISOString(), no: studyIssues.length + 1 };
    const next = [...issueLog, entry];
    setIssueLog(next); localStorage.setItem('issueLog', JSON.stringify(next));
    setIssueForm({ ...BLANK_ISSUE }); showToast(`Issue #${entry.no} logged for ${issueStudy}.`);
  };

  // ── DELIVERABLES ─────────────────────────────────────────────────────────
  const [delStudy, setDelStudy] = useState('');
  const [activeDel, setActiveDel] = useState<DelType>('SDTMs');

  const visibleDelRows = useMemo(
    () => delRows.filter((r) => r.study === delStudy && r.deliverable_type === activeDel),
    [delRows, delStudy, activeDel]
  );

  const saveDelRows = (next: DeliverableRow[]) => {
    setDelRows(next);
    localStorage.setItem('deliverableRows', JSON.stringify(next));
  };

  const addDelRow = () => {
    if (!delStudy) { showToast('Select a study first.'); return; }
    saveDelRows([...delRows, blankDelRow(delStudy, activeDel)]);
  };

  const updateDelRow = (id: string, field: keyof DeliverableRow, value: string) => {
    saveDelRows(delRows.map((r) => r.id === id ? { ...r, [field]: value } : r));
  };

  const deleteDelRow = (id: string) => {
    saveDelRows(delRows.filter((r) => r.id !== id));
  };

  // ── MILESTONES ───────────────────────────────────────────────────────────
  const [msStudy, setMsStudy] = useState('');
  const [milestones, setMilestones] = useState<MilestoneEntry[]>([newMilestone()]);
  const [msComments, setMsComments] = useState('');

  const updateMilestone = (id: string, field: keyof MilestoneEntry, value: string) =>
    setMilestones((p) => p.map((m) => m.id === id ? { ...m, [field]: value } : m));
  const isLate = (m: MilestoneEntry) => m.planned && m.actual && m.actual > m.planned;

  const handleSaveMs = () => {
    if (!msStudy) { showToast('Select a study.'); return; }
    const tflLate = milestones.some((m) => m.type === 'TFL Delivery' && isLate(m));
    const update: StudyUpdate = {
      id: `upd-${Date.now()}`, study: msStudy, savedAt: new Date().toISOString(),
      milestones, deliverables: { sdtm: '', adam: '', tfls: '', define: '' },
      issue: { date: '', category: '', severity: '', description: '' },
      comments: msComments, riskBump: tflLate ? 0.15 : 0,
    };
    onSave(update);
    showToast(`Milestones saved for ${msStudy}${tflLate ? ' · Risk +0.15 (TFL late)' : ''}`);
  };

  // ── Inline cell helpers ──────────────────────────────────────────────────
  const cellInputStyle = {
    background: 'transparent', color: '#e8eaf0', border: 'none', outline: 'none',
    width: '100%', fontSize: 11,
  } as const;
  const cellSelectStyle = {
    background: '#0d1117', color: '#e8eaf0', border: 'none', outline: 'none',
    width: '100%', fontSize: 11,
  } as const;

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-5">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm"
          style={{ background: '#2ea55e', color: '#fff' }}>✓ {toast}</div>
      )}

      {/* Sub-tab bar */}
      <div className="flex gap-0 border-b mb-5" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        {([
          ['register',    'Study Register'],
          ['metadata',    'Study Metadata'],
          ['issues',      'Issue Log'],
          ['deliverables','Deliverables'],
          ['milestones',  'Milestones'],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)}
            className="px-5 py-2 text-sm font-medium mr-1 transition-colors"
            style={subTab === id ? { color: '#2ea55e', borderBottom: '2px solid #2ea55e' } : { color: '#8892a4' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══ STUDY REGISTER ═══════════════════════════════════════════════ */}
      {subTab === 'register' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input type="text" value={regSearch} onChange={(e) => setRegSearch(e.target.value)}
                placeholder="Search studies…" className="text-xs rounded px-3 py-1.5 border outline-none w-48" style={isf} />
              <span className="text-xs" style={{ color: '#6b7280' }}>
                {allStudyNames.filter((s) => s.name.toLowerCase().includes(regSearch.toLowerCase())).length} studies
              </span>
            </div>
            <button onClick={() => setShowAddStudy(!showAddStudy)}
              className="text-xs px-3 py-1.5 rounded font-medium"
              style={{ background: 'rgba(46,165,94,0.12)', color: '#2ea55e', border: '1px solid rgba(46,165,94,0.3)' }}>
              {showAddStudy ? '✕ Cancel' : '+ Add New Study'}
            </button>
          </div>

          {showAddStudy && (
            <div className={sc} style={ss}>
              <p className="text-sm font-semibold mb-3" style={{ color: '#2ea55e' }}>Register New Study</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div><label className={lc} style={ls}>Study Name *</label><input className={ic} style={isf} value={newStudy.study} onChange={(e) => setNewStudy((p) => ({ ...p, study: e.target.value }))} placeholder="e.g. NOVA-201" /></div>
                <div><label className={lc} style={ls}>Client *</label><input className={ic} style={isf} value={newStudy.client} onChange={(e) => setNewStudy((p) => ({ ...p, client: e.target.value }))} placeholder="Client name" /></div>
                <div><label className={lc} style={ls}>Therapeutic Area</label>
                  <select className={ic} style={isf} value={newStudy.ta} onChange={(e) => setNewStudy((p) => ({ ...p, ta: e.target.value }))}>
                    <option value="">— Select TA —</option>
                    {TA_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className={lc} style={ls}>Study Phase</label>
                  <select className={ic} style={isf} value={newStudy.phase} onChange={(e) => setNewStudy((p) => ({ ...p, phase: e.target.value }))}>
                    <option value="">— Select phase —</option>
                    {STUDY_PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div><label className={lc} style={ls}>Service Type</label>
                  <select className={ic} style={isf} value={newStudy.fso_fsp} onChange={(e) => setNewStudy((p) => ({ ...p, fso_fsp: e.target.value as 'FSO' | 'FSP' }))}>
                    <option value="FSO">FSO</option><option value="FSP">FSP</option>
                  </select>
                </div>
              </div>
              <button onClick={handleAddStudy} className="text-sm px-4 py-2 rounded font-medium" style={{ background: '#2ea55e', color: '#fff' }}>Register Study</button>
            </div>
          )}

          <div className="rounded-lg overflow-hidden" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Study', 'Client', 'TA', 'Type', 'Phase', 'Source', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-3 py-2 whitespace-nowrap"
                        style={{ color: '#8892a4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allStudyNames
                    .filter((s) => s.name.toLowerCase().includes(regSearch.toLowerCase()))
                    .map((s) => {
                      const full = studies.find((st) => st.study === s.name);
                      const custom = customStudies.find((cs) => cs.study === s.name);
                      const fsp = full?.fso_fsp ?? custom?.fso_fsp;
                      return (
                        <tr key={s.name} className="hover:bg-white/[0.02] transition-colors"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td className="px-3 py-2 font-medium" style={{ color: '#e8eaf0' }}>{s.name}</td>
                          <td className="px-3 py-2" style={{ color: '#8892a4' }}>{s.client}</td>
                          <td className="px-3 py-2" style={{ color: '#8892a4' }}>{full?.ta ?? custom?.ta ?? '—'}</td>
                          <td className="px-3 py-2">{fsp && <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: fsp === 'FSO' ? 'rgba(46,165,94,0.1)' : 'rgba(59,130,246,0.1)', color: fsp === 'FSO' ? '#2ea55e' : '#3b82f6' }}>{fsp}</span>}</td>
                          <td className="px-3 py-2" style={{ color: '#8892a4' }}>{custom?.phase ?? '—'}</td>
                          <td className="px-3 py-2"><span className="text-xs px-1.5 py-0.5 rounded" style={{ color: s.custom ? '#f97316' : '#2ea55e', background: s.custom ? 'rgba(249,115,22,0.1)' : 'rgba(46,165,94,0.1)' }}>{s.custom ? 'Custom' : 'Portfolio'}</span></td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 flex-wrap">
                              <button onClick={() => { setSubTab('metadata'); loadMeta(s.name); }} className="text-xs px-2 py-0.5 rounded" style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)' }}>Metadata</button>
                              <button onClick={() => { setSubTab('issues'); setIssueStudy(s.name); }} className="text-xs px-2 py-0.5 rounded" style={{ color: '#f97316', background: 'rgba(249,115,22,0.1)' }}>Issues</button>
                              <button onClick={() => { setSubTab('deliverables'); setDelStudy(s.name); }} className="text-xs px-2 py-0.5 rounded" style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.1)' }}>Deliverables</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STUDY METADATA ════════════════════════════════════════════════ */}
      {subTab === 'metadata' && (
        <div className="grid grid-cols-5 gap-5">
          <div className="col-span-3 space-y-4">
            <div className={sc} style={ss}>
              <label className={lc} style={ls}>Study *</label>
              <select className={ic} style={isf} value={metaStudy} onChange={(e) => loadMeta(e.target.value)}>
                <option value="">— Select study —</option>
                {allStudyNames.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.client})</option>)}
              </select>
            </div>
            <div className={sc} style={ss}>
              <p className="text-sm font-semibold mb-3" style={{ color: '#2ea55e' }}>General Study Information</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['protocol_plan_no', 'Protocol / CIP No.'],
                  ['sponsor', 'Sponsor'],
                  ['fortrea_study_id', 'Internal Study ID'],
                  ['timesheet_billing_code', 'Timesheet Billing Code'],
                  ['lead_statistician', 'Lead Statistician'],
                  ['lead_programmer', 'Lead Programmer'],
                  ['study_project_manager', 'Study Project Manager'],
                  ['data_mgmt_contact', 'Data Management Contact'],
                  ['deliverable_description', 'Deliverable Description'],
                  ['deliverable_date', 'Deliverable Date'],
                ] as const).map(([k, label]) => (
                  <div key={k}>
                    <label className={lc} style={ls}>{label}</label>
                    <input className={ic} style={isf} value={meta[k]}
                      onChange={(e) => setM(k, e.target.value)}
                      type={k === 'deliverable_date' ? 'date' : 'text'} />
                  </div>
                ))}
              </div>
            </div>
            <div className={sc} style={ss}>
              <p className="text-sm font-semibold mb-3" style={{ color: '#3b82f6' }}>Study Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lc} style={ls}>Therapeutic Area</label>
                  <select className={ic} style={isf} value={meta.therapeutic_area} onChange={(e) => setM('therapeutic_area', e.target.value)}>
                    <option value="">—</option>{TA_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className={lc} style={ls}>Study Phase</label>
                  <select className={ic} style={isf} value={meta.study_phase} onChange={(e) => setM('study_phase', e.target.value)}>
                    <option value="">—</option>{STUDY_PHASES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
                {([
                  ['raw_data_path', 'Raw Data Path'], ['sdtm_data_path', 'SDTM Data Path'],
                  ['adam_path', 'ADaM Path'], ['sdtm_spec_path', 'SDTM Spec Path'],
                  ['adam_spec_path', 'ADaM Spec Path'], ['client_comments_tracker', 'Client Comments Tracker'],
                  ['tlfs_path', 'TLFs Path'], ['key_programmers', 'Key Programmers'],
                  ['project_tracker_path', 'Project Tracker Path'],
                ] as const).map(([k, label]) => (
                  <div key={k}>
                    <label className={lc} style={ls}>{label}</label>
                    <input className={ic} style={isf} value={meta[k]} onChange={(e) => setM(k, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleSaveMeta} className="w-full py-2.5 rounded-lg font-semibold text-sm" style={{ background: '#2ea55e', color: '#fff' }}>Save Metadata</button>
          </div>
          <div className="col-span-2">
            <div className="rounded-lg" style={ss}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Saved ({savedMetadata.length})</p>
              </div>
              <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {savedMetadata.length === 0
                  ? <p className="p-4 text-xs text-center" style={{ color: '#8892a4' }}>No metadata saved yet.</p>
                  : savedMetadata.map((m) => (
                    <div key={m.id} className="p-3 border-b hover:bg-white/[0.02] cursor-pointer"
                      style={{ borderColor: 'rgba(255,255,255,0.05)' }} onClick={() => loadMeta(m.study)}>
                      <p className="text-xs font-semibold" style={{ color: '#e8eaf0' }}>{m.study}</p>
                      {m.sponsor && <p className="text-xs" style={{ color: '#8892a4' }}>{m.sponsor}</p>}
                      {m.protocol_plan_no && <p className="text-xs" style={{ color: '#6b7280' }}>{m.protocol_plan_no}</p>}
                      <p className="text-xs mt-1" style={{ color: '#4b5563' }}>{new Date(m.savedAt).toLocaleDateString()}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ISSUE LOG ═════════════════════════════════════════════════════ */}
      {subTab === 'issues' && (
        <div className="grid grid-cols-5 gap-5">
          <div className="col-span-2 space-y-3">
            <div className={sc} style={ss}>
              <p className="text-sm font-semibold mb-3" style={{ color: '#e8eaf0' }}>Log New Issue</p>
              <div className="space-y-2.5">
                <div><label className={lc} style={ls}>Study *</label>
                  <select className={ic} style={isf} value={issueStudy} onChange={(e) => setIssueStudy(e.target.value)}>
                    <option value="">— Select study —</option>
                    {allStudyNames.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.client})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lc} style={ls}>Title (Deliverable)</label><input className={ic} style={isf} value={issueForm.title} onChange={(e) => setIf('title', e.target.value)} placeholder="e.g. ADAE" /></div>
                  <div><label className={lc} style={ls}>Table / Dataset No.</label><input className={ic} style={isf} value={issueForm.table_number} onChange={(e) => setIf('table_number', e.target.value)} placeholder="e.g. T-14-2-1" /></div>
                </div>
                <div><label className={lc} style={ls}>Issue Description *</label>
                  <textarea rows={3} className="w-full text-xs rounded px-2.5 py-1.5 border outline-none resize-none" style={isf} value={issueForm.issue_description} onChange={(e) => setIf('issue_description', e.target.value)} placeholder="Describe the issue…" />
                </div>
                <div><label className={lc} style={ls}>Issue Type</label>
                  <select className={ic} style={isf} value={issueForm.issue_type} onChange={(e) => setIf('issue_type', e.target.value)}>
                    {ISSUE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lc} style={ls}>Initially Reported By</label><input className={ic} style={isf} value={issueForm.initially_reported_by} onChange={(e) => setIf('initially_reported_by', e.target.value)} /></div>
                  <div><label className={lc} style={ls}>Initial Report Date</label><input type="date" className={ic} style={isf} value={issueForm.initial_report_date} onChange={(e) => setIf('initial_report_date', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lc} style={ls}>Responsible Party</label>
                    <select className={ic} style={isf} value={issueForm.responsible_party} onChange={(e) => setIf('responsible_party', e.target.value)}>
                      {RESPONSIBLE_PARTIES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div><label className={lc} style={ls}>Issue Status</label>
                    <select className={ic} style={isf} value={issueForm.issue_status} onChange={(e) => setIf('issue_status', e.target.value as IssueLogEntry['issue_status'])}>
                      {ISSUE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                {(issueForm.issue_status === 'Resolved' || issueForm.issue_status === 'Closed') && (
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lc} style={ls}>Resolved By</label><input className={ic} style={isf} value={issueForm.resolved_by} onChange={(e) => setIf('resolved_by', e.target.value)} /></div>
                    <div><label className={lc} style={ls}>Final Date Resolved</label><input type="date" className={ic} style={isf} value={issueForm.final_date_resolved} onChange={(e) => setIf('final_date_resolved', e.target.value)} /></div>
                  </div>
                )}
                <div><label className={lc} style={ls}>Comments</label><textarea rows={2} className="w-full text-xs rounded px-2.5 py-1.5 border outline-none resize-none" style={isf} value={issueForm.comments} onChange={(e) => setIf('comments', e.target.value)} /></div>
                <div><label className={lc} style={ls}>Resolution</label><input className={ic} style={isf} value={issueForm.resolution} onChange={(e) => setIf('resolution', e.target.value)} placeholder="e.g. Prog update required" /></div>
                <button onClick={handleSaveIssue} className="w-full py-2 rounded font-semibold text-sm" style={{ background: '#2ea55e', color: '#fff' }}>Log Issue</button>
              </div>
            </div>
          </div>

          <div className="col-span-3">
            <div className="rounded-lg overflow-hidden" style={ss}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#1a5c38' }}>
                <p className="text-sm font-bold text-white">
                  Issue Log{issueStudy ? ` — ${issueStudy}` : ' — All Studies'}
                  <span className="ml-2 text-xs font-normal text-white/60">({(issueStudy ? studyIssues : issueLog).length})</span>
                </p>
                {issueStudy && <button onClick={() => setIssueStudy('')} className="text-xs text-white/60 hover:text-white">✕ Clear</button>}
              </div>
              <div style={{ maxHeight: '65vh', overflowY: 'auto', overflowX: 'auto' }}>
                <table className="w-full text-xs" style={{ minWidth: 900, borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {['No.', 'Study', 'Title', 'Table No.', 'Issue Description', 'Type', 'Reported By', 'Date', 'Party', 'Status', 'Resolved By', 'Resolved Date', 'Comments', 'Resolution'].map((h) => (
                        <th key={h} className="text-left px-2.5 py-2 whitespace-nowrap"
                          style={{ color: '#8892a4', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(issueStudy ? studyIssues : issueLog).length === 0
                      ? <tr><td colSpan={14} className="px-4 py-8 text-center" style={{ color: '#8892a4' }}>No issues logged.</td></tr>
                      : (issueStudy ? studyIssues : issueLog).map((e) => {
                        const sc2 = e.issue_status === 'Open' ? '#f97316' : e.issue_status === 'In Progress' ? '#eab308' : '#2ea55e';
                        return (
                          <tr key={e.id} className="hover:bg-white/[0.02] transition-colors"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td className="px-2.5 py-2 text-center font-bold" style={{ color: '#8892a4' }}>{e.no}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap font-medium" style={{ color: '#e8eaf0' }}>{e.study}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: '#8892a4' }}>{e.title || '—'}</td>
                            <td className="px-2.5 py-2 font-mono" style={{ color: '#8892a4' }}>{e.table_number || '—'}</td>
                            <td className="px-2.5 py-2 max-w-[180px] truncate" style={{ color: '#8892a4' }} title={e.issue_description}>{e.issue_description}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap"><span className="px-1.5 py-0.5 rounded text-xs" style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)' }}>{e.issue_type}</span></td>
                            <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: '#8892a4' }}>{e.initially_reported_by || '—'}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: '#6b7280' }}>{e.initial_report_date || '—'}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: '#8892a4' }}>{e.responsible_party}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap"><span className="px-1.5 py-0.5 rounded-full text-xs font-medium" style={{ color: sc2, background: `${sc2}18` }}>{e.issue_status}</span></td>
                            <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: '#6b7280' }}>{e.resolved_by || '—'}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: '#6b7280' }}>{e.final_date_resolved || '—'}</td>
                            <td className="px-2.5 py-2 max-w-[120px] truncate" style={{ color: '#6b7280' }} title={e.comments}>{e.comments || '—'}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: '#6b7280' }}>{e.resolution || '—'}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELIVERABLES ══════════════════════════════════════════════════ */}
      {subTab === 'deliverables' && (
        <div className="space-y-4">
          {/* Study + type selector toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <select className="text-xs rounded px-2.5 py-1.5 border outline-none" style={{ ...isf, minWidth: 220 }}
              value={delStudy} onChange={(e) => setDelStudy(e.target.value)}>
              <option value="">— Select study —</option>
              {allStudyNames.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.client})</option>)}
            </select>

            {/* Deliverable type mini-tabs */}
            <div className="flex gap-0 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              {DEL_TYPES.map((t) => (
                <button key={t} onClick={() => setActiveDel(t)}
                  className="px-3 py-1.5 text-xs font-medium transition-colors"
                  style={activeDel === t
                    ? { background: '#2ea55e', color: '#fff' }
                    : { background: 'transparent', color: '#8892a4' }}>
                  {t}
                  <span className="ml-1.5 text-xs px-1 py-0.5 rounded-full"
                    style={{ background: activeDel === t ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)', color: activeDel === t ? '#fff' : '#6b7280' }}>
                    {delStudy ? delRows.filter((r) => r.study === delStudy && r.deliverable_type === t).length : 0}
                  </span>
                </button>
              ))}
            </div>

            <button onClick={addDelRow}
              className="ml-auto text-xs px-3 py-1.5 rounded font-medium"
              style={{ background: 'rgba(46,165,94,0.12)', color: '#2ea55e', border: '1px solid rgba(46,165,94,0.3)' }}>
              + Add Row
            </button>

            {visibleDelRows.length > 0 && (
              <span className="text-xs" style={{ color: '#6b7280' }}>{visibleDelRows.length} row{visibleDelRows.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Inline editable table */}
          <div className="rounded-lg overflow-hidden" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-4 py-2.5" style={{ background: '#1a5c38' }}>
              <p className="text-sm font-bold text-white">
                {activeDel} Datasets{delStudy ? ` — ${delStudy}` : ''}
              </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 1700, borderCollapse: 'collapse', width: '100%' }}>
                <thead style={{ background: '#1c2230' }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {[
                      { label: 'No.',                           w: 40 },
                      { label: 'Data Type / Description',       w: 170 },
                      { label: 'Dataset Name',                  w: 90 },
                      { label: 'Data Spec Author',              w: 130 },
                      { label: 'QC Method',                     w: 90 },
                      { label: 'Production Programmer',         w: 140 },
                      { label: 'Program Name',                  w: 110 },
                      { label: 'Program Status',                w: 130 },
                      { label: 'Date Prod Program Last Run',    w: 130 },
                      { label: 'QC Reviewer',                   w: 120 },
                      { label: 'QC Program Name',               w: 120 },
                      { label: 'QC Status',                     w: 110 },
                      { label: 'Date QC Program Last Run',      w: 130 },
                      { label: 'Comments',                      w: 180 },
                      { label: '',                              w: 36  },
                    ].map(({ label, w }) => (
                      <th key={label} className="text-left px-2 py-2 whitespace-nowrap"
                        style={{ color: '#8892a4', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: w }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleDelRows.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="px-4 py-10 text-center text-sm"
                        style={{ color: '#8892a4' }}>
                        {delStudy ? `No ${activeDel} rows yet. Click "+ Add Row" to start.` : 'Select a study to view or add deliverables.'}
                      </td>
                    </tr>
                  ) : visibleDelRows.map((row, idx) => {
                    const progColor = PROG_STATUS_COLOR[row.program_status] ?? '#6b7280';
                    const qcColor   = QC_STATUS_COLOR[row.qc_status]      ?? '#6b7280';
                    const cellPad = { padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' };
                    return (
                      <tr key={row.id} className="hover:bg-white/[0.015] group"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>

                        {/* No. */}
                        <td style={{ ...cellPad, color: '#6b7280', textAlign: 'center', fontSize: 11 }}>{idx + 1}</td>

                        {/* Data Type / Description */}
                        <td style={cellPad}>
                          <input style={cellInputStyle} value={row.data_type_description}
                            onChange={(e) => updateDelRow(row.id, 'data_type_description', e.target.value)}
                            placeholder="e.g. Trial Arms" />
                        </td>

                        {/* Dataset Name */}
                        <td style={cellPad}>
                          <input style={{ ...cellInputStyle, fontFamily: 'monospace', fontWeight: 600 }}
                            value={row.dataset_name}
                            onChange={(e) => updateDelRow(row.id, 'dataset_name', e.target.value)}
                            placeholder="e.g. TA" />
                        </td>

                        {/* Data Spec Author */}
                        <td style={cellPad}>
                          <input style={cellInputStyle} value={row.data_spec_author}
                            onChange={(e) => updateDelRow(row.id, 'data_spec_author', e.target.value)}
                            placeholder="Name" />
                        </td>

                        {/* QC Method */}
                        <td style={cellPad}>
                          <select style={cellSelectStyle} value={row.qc_method}
                            onChange={(e) => updateDelRow(row.id, 'qc_method', e.target.value)}>
                            {QC_METHODS.map((m) => <option key={m}>{m}</option>)}
                          </select>
                        </td>

                        {/* Production Programmer */}
                        <td style={cellPad}>
                          <input style={cellInputStyle} value={row.production_programmer}
                            onChange={(e) => updateDelRow(row.id, 'production_programmer', e.target.value)}
                            placeholder="Name" />
                        </td>

                        {/* Program Name */}
                        <td style={cellPad}>
                          <input style={{ ...cellInputStyle, fontFamily: 'monospace' }} value={row.program_name}
                            onChange={(e) => updateDelRow(row.id, 'program_name', e.target.value)}
                            placeholder="e.g. d_0ta.sas" />
                        </td>

                        {/* Program Status */}
                        <td style={cellPad}>
                          <select style={{ ...cellSelectStyle, color: progColor, fontWeight: 600 }}
                            value={row.program_status}
                            onChange={(e) => updateDelRow(row.id, 'program_status', e.target.value)}>
                            {PROG_STATUSES.map((s) => <option key={s} style={{ color: PROG_STATUS_COLOR[s] ?? '#e8eaf0' }}>{s}</option>)}
                          </select>
                        </td>

                        {/* Date Prod Last Run */}
                        <td style={cellPad}>
                          <input type="date" style={{ ...cellInputStyle, colorScheme: 'dark' }}
                            value={row.date_prod_last_run}
                            onChange={(e) => updateDelRow(row.id, 'date_prod_last_run', e.target.value)} />
                        </td>

                        {/* QC Reviewer */}
                        <td style={cellPad}>
                          <input style={cellInputStyle} value={row.qc_reviewer}
                            onChange={(e) => updateDelRow(row.id, 'qc_reviewer', e.target.value)}
                            placeholder="Name" />
                        </td>

                        {/* QC Program Name */}
                        <td style={cellPad}>
                          <input style={{ ...cellInputStyle, fontFamily: 'monospace' }} value={row.qc_program_name}
                            onChange={(e) => updateDelRow(row.id, 'qc_program_name', e.target.value)}
                            placeholder="e.g. qd_0ta.sas" />
                        </td>

                        {/* QC Status */}
                        <td style={cellPad}>
                          <select style={{ ...cellSelectStyle, color: qcColor, fontWeight: 600 }}
                            value={row.qc_status}
                            onChange={(e) => updateDelRow(row.id, 'qc_status', e.target.value)}>
                            {QC_STATUSES.map((s) => <option key={s} style={{ color: QC_STATUS_COLOR[s] ?? '#e8eaf0' }}>{s}</option>)}
                          </select>
                        </td>

                        {/* Date QC Last Run */}
                        <td style={cellPad}>
                          <input type="date" style={{ ...cellInputStyle, colorScheme: 'dark' }}
                            value={row.date_qc_last_run}
                            onChange={(e) => updateDelRow(row.id, 'date_qc_last_run', e.target.value)} />
                        </td>

                        {/* Comments */}
                        <td style={cellPad}>
                          <input style={cellInputStyle} value={row.comments}
                            onChange={(e) => updateDelRow(row.id, 'comments', e.target.value)}
                            placeholder="Comment…" />
                        </td>

                        {/* Delete */}
                        <td style={{ ...cellPad, textAlign: 'center' }}>
                          <button onClick={() => deleteDelRow(row.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs w-6 h-6 flex items-center justify-center rounded mx-auto"
                            style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer: add row + summary stats */}
            {delStudy && (
              <div className="px-4 py-3 flex items-center gap-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#161b24' }}>
                <button onClick={addDelRow}
                  className="text-xs px-3 py-1.5 rounded font-medium"
                  style={{ background: 'rgba(46,165,94,0.12)', color: '#2ea55e', border: '1px solid rgba(46,165,94,0.3)' }}>
                  + Add Row
                </button>
                {visibleDelRows.length > 0 && (
                  <div className="flex gap-3 ml-2">
                    {PROG_STATUSES.filter((s) => visibleDelRows.some((r) => r.program_status === s)).map((s) => (
                      <span key={s} className="text-xs font-medium"
                        style={{ color: PROG_STATUS_COLOR[s] }}>
                        {s}: {visibleDelRows.filter((r) => r.program_status === s).length}
                      </span>
                    ))}
                  </div>
                )}
                <span className="text-xs ml-auto" style={{ color: '#4b5563' }}>
                  Changes saved automatically
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ MILESTONES ════════════════════════════════════════════════════ */}
      {subTab === 'milestones' && (
        <div className="grid grid-cols-5 gap-5">
          <div className="col-span-3 space-y-4">
            <div className={sc} style={ss}>
              <label className={lc} style={ls}>Study *</label>
              <select className={ic} style={isf} value={msStudy} onChange={(e) => setMsStudy(e.target.value)}>
                <option value="">— Select study —</option>
                {allStudyNames.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.client})</option>)}
              </select>
            </div>

            <div className={sc} style={ss}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Milestone Dates</p>
                <button onClick={() => setMilestones((p) => [...p, newMilestone()])}
                  className="text-xs px-2.5 py-1 rounded font-medium"
                  style={{ background: 'rgba(46,165,94,0.1)', color: '#2ea55e', border: '1px solid rgba(46,165,94,0.3)' }}>+ Add</button>
              </div>
              <div className="grid grid-cols-12 gap-2 text-xs pb-1" style={{ color: '#8892a4' }}>
                <div className="col-span-5">Milestone Type</div>
                <div className="col-span-3">Planned Date</div>
                <div className="col-span-3">Actual Date</div>
                <div className="col-span-1" />
              </div>
              <div className="space-y-2">
                {milestones.map((m) => {
                  const late = isLate(m);
                  return (
                    <div key={m.id} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5">
                        <select value={m.type} onChange={(e) => updateMilestone(m.id, 'type', e.target.value)}
                          className="w-full text-xs rounded px-2 py-1.5 border outline-none" style={isf}>
                          {MILESTONE_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input type="date" value={m.planned}
                          onChange={(e) => updateMilestone(m.id, 'planned', e.target.value)}
                          className="w-full text-xs rounded px-2 py-1.5 border outline-none" style={isf} />
                      </div>
                      <div className="col-span-3">
                        <input type="date" value={m.actual}
                          onChange={(e) => updateMilestone(m.id, 'actual', e.target.value)}
                          className="w-full text-xs rounded px-2 py-1.5 border outline-none"
                          style={{ ...isf, borderColor: late ? 'rgba(239,68,68,0.5)' : isf.borderColor }} />
                        {late && <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>Late{m.type === 'TFL Delivery' ? ' · risk +0.15' : ''}</p>}
                      </div>
                      <div className="col-span-1 flex items-center justify-center pt-1">
                        <button onClick={() => setMilestones((p) => p.length > 1 ? p.filter((x) => x.id !== m.id) : p)}
                          className="text-xs w-6 h-6 flex items-center justify-center rounded"
                          style={{ color: '#8892a4', background: 'rgba(255,255,255,0.05)' }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={sc} style={ss}>
              <p className="text-sm font-semibold mb-2" style={{ color: '#e8eaf0' }}>Comments</p>
              <textarea rows={3} className="w-full text-xs rounded px-2.5 py-1.5 border outline-none resize-none"
                style={isf} value={msComments} onChange={(e) => setMsComments(e.target.value)}
                placeholder="General milestone notes…" />
            </div>

            <button onClick={handleSaveMs} className="w-full py-2.5 rounded-lg font-semibold text-sm"
              style={{ background: '#2ea55e', color: '#fff' }}>Save Milestones</button>
          </div>

          {/* Milestone history */}
          <div className="col-span-2">
            <div className="rounded-lg" style={ss}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>History ({savedUpdates.length})</p>
              </div>
              <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {savedUpdates.length === 0
                  ? <p className="p-4 text-xs text-center" style={{ color: '#8892a4' }}>No milestones saved yet.</p>
                  : savedUpdates.map((u) => (
                    <div key={u.id} className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold" style={{ color: '#e8eaf0' }}>{u.study}</span>
                        <span className="text-xs" style={{ color: '#6b7280' }}>{new Date(u.savedAt).toLocaleDateString()}</span>
                      </div>
                      {u.milestones.filter((m) => m.planned || m.actual).map((m) => (
                        <div key={m.id} className="flex items-center gap-2 mt-1">
                          <span className="text-xs" style={{ color: '#8892a4' }}>{m.type}</span>
                          {m.planned && <span className="text-xs" style={{ color: '#6b7280' }}>P: {m.planned}</span>}
                          {m.actual && <span className="text-xs font-medium" style={{ color: m.actual > m.planned ? '#ef4444' : '#2ea55e' }}>A: {m.actual}</span>}
                        </div>
                      ))}
                      {u.riskBump > 0 && <span className="mt-1 inline-block text-xs px-1.5 py-0.5 rounded" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.12)' }}>Risk +{u.riskBump}</span>}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
