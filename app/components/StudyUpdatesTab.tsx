'use client';

import { useState } from 'react';
import type { Study, StudyUpdate, MilestoneEntry } from '../types';

const MILESTONE_TYPES = [
  'First Patient In (FPI)',
  'Last Patient Out (LPO)',
  'Database Lock (DBL)',
  'SAP Finalization',
  'Programming Start',
  'TFL Delivery',
  'Interim Analysis',
  'DMC Meeting',
  'Protocol Amendment',
  'SDTM Delivery',
  'ADaM Delivery',
  'CSR Submission',
  'Add next major deliverable',
  'Other',
];

const DELIVERABLE_OPTIONS = ['Not Started', 'In Progress', 'Ready for QC', 'Passed QC', 'Delivered'];
const ISSUE_CATEGORIES = ['Technical', 'Process', 'Client', 'Resource', 'Other'];
const ISSUE_SEVERITIES = ['Low', 'Medium', 'High'];

type Deliverables = StudyUpdate['deliverables'];

interface StudyUpdatesTabProps {
  studies: Study[];
  onSave: (update: StudyUpdate) => void;
  savedUpdates: StudyUpdate[];
}

let milestoneCounter = 0;
function newMilestone(): MilestoneEntry {
  return { id: `ms-${++milestoneCounter}`, type: MILESTONE_TYPES[0], planned: '', actual: '' };
}

export default function StudyUpdatesTab({ studies, onSave, savedUpdates }: StudyUpdatesTabProps) {
  const [selectedStudy, setSelectedStudy] = useState('');
  const [milestones, setMilestones] = useState<MilestoneEntry[]>([newMilestone()]);
  const [deliverables, setDeliverables] = useState<Deliverables>({
    sdtm: 'Not Started',
    adam: 'Not Started',
    tfls: 'Not Started',
    define: 'Not Started',
  });
  const [issue, setIssue] = useState({ date: '', category: 'Technical', severity: 'Low', description: '' });
  const [comments, setComments] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const addMilestone = () => setMilestones((prev) => [...prev, newMilestone()]);

  const removeMilestone = (id: string) =>
    setMilestones((prev) => (prev.length > 1 ? prev.filter((m) => m.id !== id) : prev));

  const updateMilestone = (id: string, field: keyof MilestoneEntry, value: string) =>
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

  const isLateMilestone = (m: MilestoneEntry) =>
    m.planned && m.actual && m.actual > m.planned;

  const handleSave = () => {
    if (!selectedStudy) {
      showToast('Please select a study first.');
      return;
    }
    const tflLate = milestones.some(
      (m) => m.type === 'TFL Delivery' && isLateMilestone(m)
    );
    const update: StudyUpdate = {
      id: `upd-${Date.now()}`,
      study: selectedStudy,
      savedAt: new Date().toISOString(),
      milestones,
      deliverables,
      issue,
      comments,
      riskBump: tflLate ? 0.15 : 0,
    };
    onSave(update);
    showToast(`Update saved for ${selectedStudy}${tflLate ? ' · Risk bumped +0.15 (TFL late)' : ''}`);
    setSelectedStudy('');
    setMilestones([newMilestone()]);
    setDeliverables({ sdtm: 'Not Started', adam: 'Not Started', tfls: 'Not Started', define: 'Not Started' });
    setIssue({ date: '', category: 'Technical', severity: 'Low', description: '' });
    setComments('');
  };

  const inputClass = 'w-full text-sm rounded px-3 py-1.5 border outline-none focus:ring-1';
  const inputStyle = { background: '#0d1117', color: '#e8eaf0', borderColor: 'rgba(255,255,255,0.1)' };
  const labelClass = 'text-xs font-medium mb-1 block';
  const labelStyle = { color: '#8892a4' };
  const sectionCard = 'rounded-lg p-4 space-y-3';
  const sectionCardStyle = { background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' };

  return (
    <div className="p-5">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm" style={{ background: '#2ea55e', color: '#fff' }}>
          ✓ {toast}
        </div>
      )}

      <div className="grid grid-cols-5 gap-5">
        {/* Form — 3 cols */}
        <div className="col-span-3 space-y-4">
          {/* Study selector */}
          <div className={sectionCard} style={sectionCardStyle}>
            <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Study Selection</p>
            <div>
              <label className={labelClass} style={labelStyle}>Select Study *</label>
              <select
                value={selectedStudy}
                onChange={(e) => setSelectedStudy(e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">— Select a study —</option>
                {studies
                  .slice()
                  .sort((a, b) => a.study.localeCompare(b.study))
                  .map((s) => (
                    <option key={s.study} value={s.study}>
                      {s.study} ({s.client})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Milestones */}
          <div className={sectionCard} style={sectionCardStyle}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>Milestone Dates</p>
              <button
                onClick={addMilestone}
                className="text-xs px-3 py-1 rounded font-medium"
                style={{ background: 'rgba(46,165,94,0.1)', color: '#2ea55e', border: '1px solid rgba(46,165,94,0.3)' }}
              >
                + Add Milestone
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 text-xs pb-1" style={{ color: '#8892a4' }}>
              <div className="col-span-5">Milestone Type</div>
              <div className="col-span-3">Planned Date</div>
              <div className="col-span-3">Actual Date</div>
              <div className="col-span-1" />
            </div>

            <div className="space-y-2">
              {milestones.map((m) => {
                const late = isLateMilestone(m);
                return (
                  <div key={m.id} className="grid grid-cols-12 gap-2 items-start">
                    {/* Type combo */}
                    <div className="col-span-5">
                      <select
                        value={m.type}
                        onChange={(e) => updateMilestone(m.id, 'type', e.target.value)}
                        className="w-full text-xs rounded px-2 py-1.5 border outline-none"
                        style={inputStyle}
                      >
                        {MILESTONE_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    {/* Planned */}
                    <div className="col-span-3">
                      <input
                        type="date"
                        value={m.planned}
                        onChange={(e) => updateMilestone(m.id, 'planned', e.target.value)}
                        className="w-full text-xs rounded px-2 py-1.5 border outline-none"
                        style={inputStyle}
                      />
                    </div>
                    {/* Actual */}
                    <div className="col-span-3">
                      <input
                        type="date"
                        value={m.actual}
                        onChange={(e) => updateMilestone(m.id, 'actual', e.target.value)}
                        className="w-full text-xs rounded px-2 py-1.5 border outline-none"
                        style={{
                          ...inputStyle,
                          borderColor: late ? 'rgba(239,68,68,0.5)' : inputStyle.borderColor,
                        }}
                      />
                      {late && (
                        <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>
                          Late{m.type === 'TFL Delivery' ? ' · risk +0.15' : ''}
                        </p>
                      )}
                    </div>
                    {/* Remove */}
                    <div className="col-span-1 flex items-center justify-center pt-1">
                      <button
                        onClick={() => removeMilestone(m.id)}
                        className="text-xs rounded w-6 h-6 flex items-center justify-center"
                        style={{ color: '#8892a4', background: 'rgba(255,255,255,0.05)' }}
                        title="Remove milestone"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deliverable Status */}
          <div className={sectionCard} style={sectionCardStyle}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#e8eaf0' }}>Deliverable Status</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'sdtm', label: 'SDTM' },
                { key: 'adam', label: 'ADaM' },
                { key: 'tfls', label: 'TFLs' },
                { key: 'define', label: 'Define.xml' },
              ].map((d) => (
                <div key={d.key}>
                  <label className={labelClass} style={labelStyle}>{d.label}</label>
                  <select
                    value={deliverables[d.key as keyof Deliverables]}
                    onChange={(e) => setDeliverables((prev) => ({ ...prev, [d.key]: e.target.value }))}
                    className={inputClass}
                    style={{
                      ...inputStyle,
                      color:
                        deliverables[d.key as keyof Deliverables] === 'Delivered'
                          ? '#2ea55e'
                          : deliverables[d.key as keyof Deliverables] === 'Not Started'
                          ? '#8892a4'
                          : '#e8eaf0',
                    }}
                  >
                    {DELIVERABLE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Issue Log */}
          <div className={sectionCard} style={sectionCardStyle}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#e8eaf0' }}>Issue Log</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass} style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={issue.date}
                  onChange={(e) => setIssue((p) => ({ ...p, date: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Category</label>
                <select
                  value={issue.category}
                  onChange={(e) => setIssue((p) => ({ ...p, category: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                >
                  {ISSUE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Severity</label>
                <select
                  value={issue.severity}
                  onChange={(e) => setIssue((p) => ({ ...p, severity: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                >
                  {ISSUE_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Description</label>
              <textarea
                value={issue.description}
                onChange={(e) => setIssue((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Describe the issue…"
                className="w-full text-sm rounded px-3 py-2 border outline-none resize-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Comments */}
          <div className={sectionCard} style={sectionCardStyle}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#e8eaf0' }}>Study Comments</p>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              placeholder="Add general comments about this study…"
              className="w-full text-sm rounded px-3 py-2 border outline-none resize-none"
              style={inputStyle}
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
            style={{ background: '#2ea55e', color: '#fff' }}
          >
            Save Update
          </button>
        </div>

        {/* Saved Updates — 2 cols */}
        <div className="col-span-2">
          <div className="rounded-lg" style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>
                Saved Updates ({savedUpdates.length})
              </p>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
              {savedUpdates.length === 0 ? (
                <div className="p-6 text-center text-sm" style={{ color: '#8892a4' }}>
                  No updates saved yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {['Study', 'Saved At', 'Milestones', 'Risk Bump', 'Issue'].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: '#8892a4' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {savedUpdates.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 py-2 font-medium text-xs" style={{ color: '#e8eaf0' }}>{u.study}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: '#8892a4' }}>
                          {new Date(u.savedAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-xs" style={{ color: '#8892a4' }}>
                          {Array.isArray(u.milestones) ? u.milestones.length : 'legacy'}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {u.riskBump > 0 ? (
                            <span style={{ color: '#ef4444' }}>+{u.riskBump}</span>
                          ) : (
                            <span style={{ color: '#8892a4' }}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs" style={{ color: '#8892a4' }}>
                          {u.issue.category || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
