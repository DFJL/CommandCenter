'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Study, StudyUpdate, StudyMetadata, IssueLogEntry, CustomStudy, MilestoneEntry } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────
const MILESTONE_TYPES = [
  'First Patient In (FPI)', 'Last Patient Out (LPO)', 'Database Lock (DBL)',
  'SAP Finalization', 'Programming Start', 'TFL Delivery', 'Interim Analysis',
  'DMC Meeting', 'Protocol Amendment', 'SDTM Delivery', 'ADaM Delivery', 'CSR Submission', 'Other',
];
const DEL_STATUS_OPTS = ['Not Started', 'In Progress', 'Ready for QC', 'Passed QC', 'Delivered'];
const ISSUE_TYPES = [
  'Calculations/Logic', 'Mock Shell / Spec Update', 'Mock Shell Inconsistency',
  'New Programming Request', 'Data Issue', 'Coding Incorrect or Inefficient',
  'Cosmetic Update', 'Log', 'Other',
];
const ISSUE_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'] as const;
const RESPONSIBLE_PARTIES = ['Production Programmer', 'QC Reviewer', 'Lead Statistician', 'Lead Programmer', 'Data Manager', 'Client', 'Other'];
const TA_OPTIONS = ['Oncology', 'Cardiovascular', 'Respiratory', 'Neurology', 'Immunology', 'Rare Disease', 'Hepatology', 'Endocrinology', 'Infectious Disease', 'Other'];
const STUDY_PHASES = ['Phase I', 'Phase I/II', 'Phase II', 'Phase II/III', 'Phase III', 'Phase III/IV', 'Phase IV', 'Other'];

type SubTab = 'register' | 'metadata' | 'issues' | 'deliverables';

let milestoneCounter = 0;
function newMilestone(): MilestoneEntry {
  return { id: `ms-${++milestoneCounter}`, type: MILESTONE_TYPES[0], planned: '', actual: '' };
}

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

interface Props {
  studies: Study[];
  onSave: (update: StudyUpdate) => void;
  savedUpdates: StudyUpdate[];
}

export default function StudyUpdatesTab({ studies, onSave, savedUpdates }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('register');
  const [toast, setToast] = useState<string | null>(null);

  // ── Persisted state (localStorage) ──────────────────────────────────────
  const [customStudies, setCustomStudies] = useState<CustomStudy[]>([]);
  const [savedMetadata, setSavedMetadata] = useState<StudyMetadata[]>([]);
  const [issueLog, setIssueLog] = useState<IssueLogEntry[]>([]);

  useEffect(() => {
    try {
      const cs = localStorage.getItem('customStudies'); if (cs) setCustomStudies(JSON.parse(cs));
      const sm = localStorage.getItem('studyMetadata'); if (sm) setSavedMetadata(JSON.parse(sm));
      const il = localStorage.getItem('issueLog'); if (il) setIssueLog(JSON.parse(il));
    } catch { /* ignore */ }
  }, []);

  const allStudyNames = useMemo(() => {
    const built = studies.map((s) => ({ name: s.study, client: s.client, custom: false }));
    const custom = customStudies.map((s) => ({ name: s.study, client: s.client, custom: true }));
    return [...built, ...custom].sort((a, b) => a.name.localeCompare(b.name));
  }, [studies, customStudies]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const isf = { background: '#0d1117', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' } as const;
  const ic = 'w-full text-xs rounded px-2.5 py-1.5 border outline-none focus:ring-1';
  const lc = 'text-xs font-medium mb-1 block'; const ls = { color: '#8892a4' };
  const sc = 'rounded-lg p-4'; const ss = { background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' };

  // ── REGISTER state ───────────────────────────────────────────────────────
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

  // ── METADATA state ───────────────────────────────────────────────────────
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

  // ── ISSUE LOG state ──────────────────────────────────────────────────────
  const [issueStudy, setIssueStudy] = useState('');
  const [issueForm, setIssueForm] = useState({ ...BLANK_ISSUE });
  const setIf = (k: keyof typeof issueForm, v: string) => setIssueForm((p) => ({ ...p, [k]: v }));
  const studyIssues = useMemo(() => issueLog.filter((e) => e.study === issueStudy), [issueLog, issueStudy]);

  const handleSaveIssue = () => {
    if (!issueStudy) { showToast('Select a study.'); return; }
    if (!issueForm.issue_description.trim()) { showToast('Issue description is required.'); return; }
    const entry: IssueLogEntry = {
      ...issueForm,
      id: `il-${Date.now()}`, study: issueStudy, savedAt: new Date().toISOString(),
      no: studyIssues.length + 1,
    };
    const next = [...issueLog, entry];
    setIssueLog(next); localStorage.setItem('issueLog', JSON.stringify(next));
    setIssueForm({ ...BLANK_ISSUE }); showToast(`Issue #${entry.no} logged for ${issueStudy}.`);
  };

  // ── DELIVERABLE STATUS state ─────────────────────────────────────────────
  const [delStudy, setDelStudy] = useState('');
  const [deliverables, setDeliverables] = useState({ sdtm: 'Not Started', adam: 'Not Started', tables: 'Not Started', listings: 'Not Started', figures: 'Not Started', define: 'Not Started' });
  const [milestones, setMilestones] = useState<MilestoneEntry[]>([newMilestone()]);
  const [delComments, setDelComments] = useState('');

  const updateMilestone = (id: string, field: keyof MilestoneEntry, value: string) =>
    setMilestones((p) => p.map((m) => m.id === id ? { ...m, [field]: value } : m));
  const isLate = (m: MilestoneEntry) => m.planned && m.actual && m.actual > m.planned;

  const handleSaveDel = () => {
    if (!delStudy) { showToast('Select a study.'); return; }
    const tflLate = milestones.some((m) => m.type === 'TFL Delivery' && isLate(m));
    const update: StudyUpdate = {
      id: `upd-${Date.now()}`, study: delStudy, savedAt: new Date().toISOString(),
      milestones, deliverables: { ...deliverables, tfls: deliverables.tables },
      issue: { date: '', category: '', severity: '', description: '' },
      comments: delComments, riskBump: tflLate ? 0.15 : 0,
    };
    onSave(update);
    showToast(`Status saved for ${delStudy}${tflLate ? ' · Risk +0.15 (TFL late)' : ''}`);
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-5">
      {toast && <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm" style={{ background: '#2ea55e', color: '#fff' }}>✓ {toast}</div>}

      {/* Sub-tab bar */}
      <div className="flex gap-0 border-b mb-5" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        {([
          ['register',    'Study Register'],
          ['metadata',    'Study Metadata'],
          ['issues',      'Issue Log'],
          ['deliverables','Deliverable Status'],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)}
            className="px-5 py-2 text-sm font-medium mr-1 transition-colors"
            style={subTab === id
              ? { color: '#2ea55e', borderBottom: '2px solid #2ea55e' }
              : { color: '#8892a4' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══ STUDY REGISTER ═══════════════════════════════════════════════ */}
      {subTab === 'register' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input type="text" value={regSearch} onChange={(e) => setRegSearch(e.target.value)} placeholder="Search studies…" className="text-xs rounded px-3 py-1.5 border outline-none w-48" style={isf} />
              <span className="text-xs" style={{ color: '#6b7280' }}>{allStudyNames.filter((s) => s.name.toLowerCase().includes(regSearch.toLowerCase())).length} studies</span>
            </div>
            <button onClick={() => setShowAddStudy(!showAddStudy)} className="text-xs px-3 py-1.5 rounded font-medium" style={{ background: 'rgba(46,165,94,0.12)', color: '#2ea55e', border: '1px solid rgba(46,165,94,0.3)' }}>
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
                      <th key={h} className="text-left px-3 py-2 whitespace-nowrap" style={{ color: '#8892a4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allStudyNames
                    .filter((s) => s.name.toLowerCase().includes(regSearch.toLowerCase()))
                    .map((s) => {
                      const full = studies.find((st) => st.study === s.name);
                      const custom = customStudies.find((cs) => cs.study === s.name);
                      return (
                        <tr key={s.name} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td className="px-3 py-2 font-medium" style={{ color: '#e8eaf0' }}>{s.name}</td>
                          <td className="px-3 py-2" style={{ color: '#8892a4' }}>{s.client}</td>
                          <td className="px-3 py-2" style={{ color: '#8892a4' }}>{full?.ta ?? custom?.ta ?? '—'}</td>
                          <td className="px-3 py-2">
                            {(full?.fso_fsp ?? custom?.fso_fsp) && (
                              <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: (full?.fso_fsp ?? custom?.fso_fsp) === 'FSO' ? 'rgba(46,165,94,0.1)' : 'rgba(59,130,246,0.1)', color: (full?.fso_fsp ?? custom?.fso_fsp) === 'FSO' ? '#2ea55e' : '#3b82f6' }}>{full?.fso_fsp ?? custom?.fso_fsp}</span>
                            )}
                          </td>
                          <td className="px-3 py-2" style={{ color: '#8892a4' }}>{custom?.phase ?? '—'}</td>
                          <td className="px-3 py-2">
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: s.custom ? '#f97316' : '#2ea55e', background: s.custom ? 'rgba(249,115,22,0.1)' : 'rgba(46,165,94,0.1)' }}>{s.custom ? 'Custom' : 'Portfolio'}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => { setSubTab('metadata'); loadMeta(s.name); }} className="text-xs px-2 py-0.5 rounded" style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)' }}>Metadata</button>
                              <button onClick={() => { setSubTab('issues'); setIssueStudy(s.name); }} className="text-xs px-2 py-0.5 rounded" style={{ color: '#f97316', background: 'rgba(249,115,22,0.1)' }}>Issues</button>
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

            {/* General Study Information */}
            <div className={sc} style={ss}>
              <p className="text-sm font-semibold mb-3" style={{ color: '#2ea55e' }}>General Study Information</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['protocol_plan_no',     'Protocol / Clinical Investigation Plan No.'],
                  ['sponsor',              'Sponsor'],
                  ['fortrea_study_id',     'Fortrea Study ID'],
                  ['timesheet_billing_code','Timesheet Billing Code'],
                  ['lead_statistician',    'Lead Statistician'],
                  ['lead_programmer',      'Lead Programmer'],
                  ['study_project_manager','Study Project Manager'],
                  ['data_mgmt_contact',    'Data Management Contact'],
                ] as const).map(([k, label]) => (
                  <div key={k}>
                    <label className={lc} style={ls}>{label}</label>
                    <input className={ic} style={isf} value={meta[k]} onChange={(e) => setM(k, e.target.value)} />
                  </div>
                ))}
                <div>
                  <label className={lc} style={ls}>Deliverable Description</label>
                  <input className={ic} style={isf} value={meta.deliverable_description} onChange={(e) => setM('deliverable_description', e.target.value)} />
                </div>
                <div>
                  <label className={lc} style={ls}>Deliverable Date</label>
                  <input type="date" className={ic} style={isf} value={meta.deliverable_date} onChange={(e) => setM('deliverable_date', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Study Details */}
            <div className={sc} style={ss}>
              <p className="text-sm font-semibold mb-3" style={{ color: '#3b82f6' }}>Study Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lc} style={ls}>Therapeutic Area</label>
                  <select className={ic} style={isf} value={meta.therapeutic_area} onChange={(e) => setM('therapeutic_area', e.target.value)}>
                    <option value="">—</option>
                    {TA_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lc} style={ls}>Study Phase</label>
                  <select className={ic} style={isf} value={meta.study_phase} onChange={(e) => setM('study_phase', e.target.value)}>
                    <option value="">—</option>
                    {STUDY_PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {([
                  ['raw_data_path',          'Raw Data Path'],
                  ['sdtm_data_path',         'SDTM Data Path'],
                  ['adam_path',              'ADaM Path'],
                  ['sdtm_spec_path',         'SDTM Spec Path'],
                  ['adam_spec_path',         'ADaM Spec Path'],
                  ['client_comments_tracker','Client Comments Tracker'],
                  ['tlfs_path',              'TLFs Path'],
                  ['key_programmers',        'Key Programmers'],
                  ['project_tracker_path',   'Project Tracker Path'],
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

          {/* Saved metadata list */}
          <div className="col-span-2">
            <div className="rounded-lg" style={ss}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Saved ({savedMetadata.length})</p>
              </div>
              <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {savedMetadata.length === 0 ? (
                  <p className="p-4 text-xs text-center" style={{ color: '#8892a4' }}>No metadata saved yet.</p>
                ) : savedMetadata.map((m) => (
                  <div key={m.id} className="p-3 border-b hover:bg-white/[0.02] cursor-pointer" style={{ borderColor: 'rgba(255,255,255,0.05)' }} onClick={() => loadMeta(m.study)}>
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
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-5">
            {/* Entry form */}
            <div className="col-span-2 space-y-3">
              <div className={sc} style={ss}>
                <p className="text-sm font-semibold mb-3" style={{ color: '#e8eaf0' }}>Log New Issue</p>
                <div className="space-y-2.5">
                  <div>
                    <label className={lc} style={ls}>Study *</label>
                    <select className={ic} style={isf} value={issueStudy} onChange={(e) => setIssueStudy(e.target.value)}>
                      <option value="">— Select study —</option>
                      {allStudyNames.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.client})</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lc} style={ls}>Title (Deliverable)</label>
                      <input className={ic} style={isf} value={issueForm.title} onChange={(e) => setIf('title', e.target.value)} placeholder="e.g. ADAE" />
                    </div>
                    <div>
                      <label className={lc} style={ls}>Table / Dataset No.</label>
                      <input className={ic} style={isf} value={issueForm.table_number} onChange={(e) => setIf('table_number', e.target.value)} placeholder="e.g. T-14-2-1" />
                    </div>
                  </div>
                  <div>
                    <label className={lc} style={ls}>Issue Description *</label>
                    <textarea rows={3} className="w-full text-xs rounded px-2.5 py-1.5 border outline-none resize-none" style={isf} value={issueForm.issue_description} onChange={(e) => setIf('issue_description', e.target.value)} placeholder="Describe the issue…" />
                  </div>
                  <div>
                    <label className={lc} style={ls}>Issue Type</label>
                    <select className={ic} style={isf} value={issueForm.issue_type} onChange={(e) => setIf('issue_type', e.target.value)}>
                      {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lc} style={ls}>Initially Reported By</label>
                      <input className={ic} style={isf} value={issueForm.initially_reported_by} onChange={(e) => setIf('initially_reported_by', e.target.value)} />
                    </div>
                    <div>
                      <label className={lc} style={ls}>Initial Report Date</label>
                      <input type="date" className={ic} style={isf} value={issueForm.initial_report_date} onChange={(e) => setIf('initial_report_date', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lc} style={ls}>Responsible Party</label>
                      <select className={ic} style={isf} value={issueForm.responsible_party} onChange={(e) => setIf('responsible_party', e.target.value)}>
                        {RESPONSIBLE_PARTIES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lc} style={ls}>Issue Status</label>
                      <select className={ic} style={isf} value={issueForm.issue_status} onChange={(e) => setIf('issue_status', e.target.value as IssueLogEntry['issue_status'])}>
                        {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  {(issueForm.issue_status === 'Resolved' || issueForm.issue_status === 'Closed') && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={lc} style={ls}>Resolved By</label>
                        <input className={ic} style={isf} value={issueForm.resolved_by} onChange={(e) => setIf('resolved_by', e.target.value)} />
                      </div>
                      <div>
                        <label className={lc} style={ls}>Final Date Resolved</label>
                        <input type="date" className={ic} style={isf} value={issueForm.final_date_resolved} onChange={(e) => setIf('final_date_resolved', e.target.value)} />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className={lc} style={ls}>Comments</label>
                    <textarea rows={2} className="w-full text-xs rounded px-2.5 py-1.5 border outline-none resize-none" style={isf} value={issueForm.comments} onChange={(e) => setIf('comments', e.target.value)} />
                  </div>
                  <div>
                    <label className={lc} style={ls}>Resolution</label>
                    <input className={ic} style={isf} value={issueForm.resolution} onChange={(e) => setIf('resolution', e.target.value)} placeholder="e.g. Prog update required" />
                  </div>
                  <button onClick={handleSaveIssue} className="w-full py-2 rounded font-semibold text-sm" style={{ background: '#2ea55e', color: '#fff' }}>Log Issue</button>
                </div>
              </div>
            </div>

            {/* Issue log table */}
            <div className="col-span-3">
              <div className="rounded-lg overflow-hidden" style={ss}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#1a5c38' }}>
                  <p className="text-sm font-bold text-white">
                    Issue Log{issueStudy ? ` — ${issueStudy}` : ' — All Studies'}
                    <span className="ml-2 text-xs font-normal text-white/60">({(issueStudy ? studyIssues : issueLog).length} entries)</span>
                  </p>
                  {issueStudy && <button onClick={() => setIssueStudy('')} className="text-xs text-white/60 hover:text-white">✕ Clear filter</button>}
                </div>
                <div style={{ maxHeight: '65vh', overflowY: 'auto', overflowX: 'auto' }}>
                  <table className="w-full text-xs" style={{ minWidth: 900, borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#1c2230', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        {['No.', 'Study', 'Title', 'Table No.', 'Issue Description', 'Issue Type', 'Reported By', 'Report Date', 'Responsible Party', 'Status', 'Resolved By', 'Resolved Date', 'Comments', 'Resolution'].map((h) => (
                          <th key={h} className="text-left px-2.5 py-2 whitespace-nowrap" style={{ color: '#8892a4', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(issueStudy ? studyIssues : issueLog).length === 0 ? (
                        <tr><td colSpan={14} className="px-4 py-8 text-center" style={{ color: '#8892a4' }}>No issues logged{issueStudy ? ` for ${issueStudy}` : ''}.</td></tr>
                      ) : (issueStudy ? studyIssues : issueLog).map((e) => {
                        const statusColor = e.issue_status === 'Open' ? '#f97316' : e.issue_status === 'In Progress' ? '#eab308' : '#2ea55e';
                        return (
                          <tr key={e.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td className="px-2.5 py-2 text-center font-bold" style={{ color: '#8892a4' }}>{e.no}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap font-medium" style={{ color: '#e8eaf0' }}>{e.study}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: '#8892a4' }}>{e.title || '—'}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap font-mono" style={{ color: '#8892a4' }}>{e.table_number || '—'}</td>
                            <td className="px-2.5 py-2 max-w-[200px] truncate" style={{ color: '#8892a4' }} title={e.issue_description}>{e.issue_description}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap">
                              <span className="px-1.5 py-0.5 rounded text-xs" style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)' }}>{e.issue_type}</span>
                            </td>
                            <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: '#8892a4' }}>{e.initially_reported_by || '—'}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: '#6b7280' }}>{e.initial_report_date || '—'}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: '#8892a4' }}>{e.responsible_party}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap">
                              <span className="px-1.5 py-0.5 rounded-full text-xs font-medium" style={{ color: statusColor, background: `${statusColor}18` }}>{e.issue_status}</span>
                            </td>
                            <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: '#6b7280' }}>{e.resolved_by || '—'}</td>
                            <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: '#6b7280' }}>{e.final_date_resolved || '—'}</td>
                            <td className="px-2.5 py-2 max-w-[150px] truncate" style={{ color: '#6b7280' }} title={e.comments}>{e.comments || '—'}</td>
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
        </div>
      )}

      {/* ═══ DELIVERABLE STATUS ════════════════════════════════════════════ */}
      {subTab === 'deliverables' && (
        <div className="grid grid-cols-5 gap-5">
          <div className="col-span-3 space-y-4">
            <div className={sc} style={ss}>
              <label className={lc} style={ls}>Study *</label>
              <select className={ic} style={isf} value={delStudy} onChange={(e) => setDelStudy(e.target.value)}>
                <option value="">— Select study —</option>
                {allStudyNames.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.client})</option>)}
              </select>
            </div>

            {/* Deliverable status grid */}
            <div className={sc} style={ss}>
              <p className="text-sm font-semibold mb-3" style={{ color: '#e8eaf0' }}>Deliverable Status</p>
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Deliverable Type', 'Status'].map((h) => (
                      <th key={h} className="text-left pb-2" style={{ color: '#8892a4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', paddingRight: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['sdtm',     'SDTMs'],
                    ['adam',     'ADaMs'],
                    ['tables',   'Tables'],
                    ['listings', 'Listings'],
                    ['figures',  'Figures'],
                    ['define',   'Define.xml'],
                  ] as const).map(([key, label]) => {
                    const val = deliverables[key];
                    const statusColor = val === 'Delivered' ? '#2ea55e' : val === 'Not Started' ? '#6b7280' : val === 'Passed QC' ? '#3b82f6' : '#d97706';
                    return (
                      <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td className="py-2 font-medium" style={{ color: '#e8eaf0', paddingRight: 12 }}>{label}</td>
                        <td className="py-2" style={{ paddingRight: 12 }}>
                          <select className="text-xs rounded px-2 py-1 border outline-none" style={{ ...isf, color: statusColor, minWidth: 150 }}
                            value={val} onChange={(e) => setDeliverables((p) => ({ ...p, [key]: e.target.value }))}>
                            {DEL_STATUS_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Milestones */}
            <div className={sc} style={ss}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Milestone Dates</p>
                <button onClick={() => setMilestones((p) => [...p, newMilestone()])} className="text-xs px-2.5 py-1 rounded font-medium" style={{ background: 'rgba(46,165,94,0.1)', color: '#2ea55e', border: '1px solid rgba(46,165,94,0.3)' }}>+ Add</button>
              </div>
              <div className="grid grid-cols-12 gap-2 text-xs pb-1" style={{ color: '#8892a4' }}>
                <div className="col-span-5">Type</div><div className="col-span-3">Planned</div><div className="col-span-3">Actual</div><div className="col-span-1" />
              </div>
              <div className="space-y-2">
                {milestones.map((m) => {
                  const late = isLate(m);
                  return (
                    <div key={m.id} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5"><select value={m.type} onChange={(e) => updateMilestone(m.id, 'type', e.target.value)} className="w-full text-xs rounded px-2 py-1.5 border outline-none" style={isf}>{MILESTONE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                      <div className="col-span-3"><input type="date" value={m.planned} onChange={(e) => updateMilestone(m.id, 'planned', e.target.value)} className="w-full text-xs rounded px-2 py-1.5 border outline-none" style={isf} /></div>
                      <div className="col-span-3">
                        <input type="date" value={m.actual} onChange={(e) => updateMilestone(m.id, 'actual', e.target.value)} className="w-full text-xs rounded px-2 py-1.5 border outline-none" style={{ ...isf, borderColor: late ? 'rgba(239,68,68,0.5)' : isf.borderColor }} />
                        {late && <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>Late{m.type === 'TFL Delivery' ? ' · risk +0.15' : ''}</p>}
                      </div>
                      <div className="col-span-1 flex items-center justify-center pt-1">
                        <button onClick={() => setMilestones((p) => p.length > 1 ? p.filter((x) => x.id !== m.id) : p)} className="text-xs w-6 h-6 flex items-center justify-center rounded" style={{ color: '#8892a4', background: 'rgba(255,255,255,0.05)' }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={sc} style={ss}>
              <p className="text-sm font-semibold mb-2" style={{ color: '#e8eaf0' }}>Comments</p>
              <textarea rows={3} className="w-full text-xs rounded px-2.5 py-1.5 border outline-none resize-none" style={isf} value={delComments} onChange={(e) => setDelComments(e.target.value)} placeholder="General comments on deliverable progress…" />
            </div>

            <button onClick={handleSaveDel} className="w-full py-2.5 rounded-lg font-semibold text-sm" style={{ background: '#2ea55e', color: '#fff' }}>Save Status & Milestones</button>
          </div>

          {/* Saved deliverable history */}
          <div className="col-span-2">
            <div className="rounded-lg" style={ss}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Status History ({savedUpdates.length})</p>
              </div>
              <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {savedUpdates.length === 0 ? (
                  <p className="p-4 text-xs text-center" style={{ color: '#8892a4' }}>No updates saved yet.</p>
                ) : savedUpdates.map((u) => (
                  <div key={u.id} className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold" style={{ color: '#e8eaf0' }}>{u.study}</span>
                      <span className="text-xs" style={{ color: '#6b7280' }}>{new Date(u.savedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(['sdtm', 'adam', 'tfls', 'tables', 'listings', 'figures', 'define'] as const).map((k) => {
                        const v = u.deliverables[k]; if (!v || v === 'Not Started') return null;
                        const c = v === 'Delivered' ? '#2ea55e' : v === 'Passed QC' ? '#3b82f6' : '#d97706';
                        return <span key={k} className="text-xs px-1.5 py-0.5 rounded" style={{ color: c, background: `${c}18` }}>{k.toUpperCase()}: {v}</span>;
                      })}
                      {u.riskBump > 0 && <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.12)' }}>Risk +{u.riskBump}</span>}
                    </div>
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
