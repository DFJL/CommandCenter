'use client';

import { useState, useEffect } from 'react';
import type { Study, P21Finding, StudyUpdate } from './types';
import ResultsTab from './components/ResultsTab';
import InconsistenciesTab from './components/InconsistenciesTab';
import StudyUpdatesTab from './components/StudyUpdatesTab';

type Tab = 'results' | 'inconsistencies' | 'updates';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('results');
  const [studies, setStudies] = useState<Study[]>([]);
  const [findings, setFindings] = useState<P21Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState<StudyUpdate[]>([]);

  useEffect(() => {
    const savedUpdates = localStorage.getItem('studyUpdates');
    if (savedUpdates) {
      try {
        setUpdates(JSON.parse(savedUpdates));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/data/studies.json').then((r) => r.json()),
      fetch('/data/p21.json').then((r) => r.json()),
    ])
      .then(([studiesData, p21Data]) => {
        setStudies(studiesData);
        setFindings(p21Data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: '#0d1117' }}
      >
        <div className="text-center">
          <div
            className="inline-block w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-4"
            style={{ borderColor: '#2ea55e', borderTopColor: 'transparent' }}
          />
          <p style={{ color: '#8892a4' }}>Loading portfolio data…</p>
        </div>
      </div>
    );
  }

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
                ? {
                    background: '#161b24',
                    color: '#2ea55e',
                    borderBottom: '2px solid #2ea55e',
                  }
                : {
                    background: 'transparent',
                    color: '#8892a4',
                  }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'results' && <ResultsTab studies={studies} />}
        {activeTab === 'inconsistencies' && (
          <InconsistenciesTab findings={findings} />
        )}
        {activeTab === 'updates' && (
          <StudyUpdatesTab
            studies={studies}
            onSave={handleSaveUpdate}
            savedUpdates={updates}
          />
        )}
      </div>
    </div>
  );
}
