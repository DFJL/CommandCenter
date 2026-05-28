'use client';

import { useState, useEffect } from 'react';
import type { Study, P21Finding, StudyUpdate } from '../types';
import ResultsTab from './ResultsTab';
import InconsistenciesTab from './InconsistenciesTab';
import StudyUpdatesTab from './StudyUpdatesTab';

type Tab = 'results' | 'inconsistencies' | 'updates';

interface Props {
  studies: Study[];
  findings: P21Finding[];
}

export default function HomeClient({ studies, findings }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('results');
  const [updates, setUpdates] = useState<StudyUpdate[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('studyUpdates');
      if (saved) setUpdates(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  const handleSaveUpdate = (update: StudyUpdate) => {
    const next = [update, ...updates];
    setUpdates(next);
    localStorage.setItem('studyUpdates', JSON.stringify(next));
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'results', label: 'Results' },
    { id: 'inconsistencies', label: 'Data Inconsistencies' },
    { id: 'updates', label: 'Study Updates' },
  ];

  return (
    <div style={{ background: '#0d1117', minHeight: 'calc(100vh - 56px)' }}>
      {/* Tab bar */}
      <div
        className="flex gap-0 border-b px-6 pt-4"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-5 py-2 text-sm font-medium rounded-t-lg mr-1 transition-colors"
            style={
              activeTab === tab.id
                ? { background: '#161b24', color: '#2ea55e', borderBottom: '2px solid #2ea55e' }
                : { background: 'transparent', color: '#8892a4' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'results' && <ResultsTab studies={studies} />}
        {activeTab === 'inconsistencies' && <InconsistenciesTab findings={findings} />}
        {activeTab === 'updates' && (
          <StudyUpdatesTab studies={studies} onSave={handleSaveUpdate} savedUpdates={updates} />
        )}
      </div>
    </div>
  );
}
