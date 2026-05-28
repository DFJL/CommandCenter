'use client';

import { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { P21Finding } from '../types';

const DONUT_COLORS = [
  '#2ea55e',
  '#3b82f6',
  '#f97316',
  '#eab308',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#14b8a6',
];

export default function InconsistenciesTab({ findings }: { findings: P21Finding[] }) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string>('severity');
  const [sortAsc, setSortAsc] = useState(true);

  const totalIssues = findings.length;
  const studiesAffected = new Set(findings.map((f) => f.study_id)).size;
  const categories = new Set(findings.map((f) => f.ai_category)).size;

  // Donut: by ai_category
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of findings) {
      map[f.ai_category] = (map[f.ai_category] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [findings]);

  // Bar: per study
  const studyBarData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of findings) {
      map[f.study_id] = (map[f.study_id] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([study, count]) => ({ study, count }))
      .sort((a, b) => b.count - a.count);
  }, [findings]);

  // Filtered + sorted table
  const tableData = useMemo(() => {
    let filtered = findings;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.finding_id.toLowerCase().includes(q) ||
          f.study_id.toLowerCase().includes(q) ||
          f.message.toLowerCase().includes(q) ||
          f.ai_category.toLowerCase().includes(q) ||
          f.dataset.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      let av: string = '';
      let bv: string = '';
      if (sortCol === 'severity') {
        const order: Record<string, number> = { Error: 0, Warning: 1 };
        const diff = (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
        return sortAsc ? diff : -diff;
      }
      if (sortCol === 'study_id') { av = a.study_id; bv = b.study_id; }
      else if (sortCol === 'dataset') { av = a.dataset; bv = b.dataset; }
      else if (sortCol === 'ai_category') { av = a.ai_category; bv = b.ai_category; }
      else if (sortCol === 'message') { av = a.message; bv = b.message; }
      const r = av.localeCompare(bv);
      return sortAsc ? r : -r;
    });
  }, [findings, search, sortCol, sortAsc]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  return (
    <div className="p-5 space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Issues', value: totalIssues, color: '#ef4444' },
          { label: 'Studies Affected', value: studiesAffected, color: '#f97316' },
          { label: 'Categories', value: categories, color: '#3b82f6' },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-lg p-5 text-center"
            style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="text-3xl font-bold" style={{ color: k.color }}>
              {k.value}
            </div>
            <div className="text-sm mt-1" style={{ color: '#8892a4' }}>
              {k.label}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-5">
        {/* Donut */}
        <div
          className="rounded-lg p-4"
          style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-sm font-semibold mb-2" style={{ color: '#e8eaf0' }}>
            Issues by Category
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                dataKey="value"
                paddingAngle={2}
              >
                {categoryData.map((_, idx) => (
                  <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1c2230',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                }}
                labelStyle={{ color: '#e8eaf0' }}
                itemStyle={{ color: '#8892a4' }}
              />
              <Legend
                wrapperStyle={{ color: '#8892a4', fontSize: 11 }}
                formatter={(value) =>
                  value.length > 20 ? value.slice(0, 20) + '…' : value
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Horizontal bar: issues per study */}
        <div
          className="rounded-lg p-4"
          style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-sm font-semibold mb-2" style={{ color: '#e8eaf0' }}>
            Issues per Study
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              layout="vertical"
              data={studyBarData}
              margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.08)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: '#8892a4', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="study"
                tick={{ fill: '#8892a4', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  background: '#1c2230',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                }}
                labelStyle={{ color: '#e8eaf0' }}
                itemStyle={{ color: '#8892a4' }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-lg"
        style={{ background: '#161b24', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center justify-between p-4 pb-3">
          <p className="text-sm font-semibold" style={{ color: '#e8eaf0' }}>
            All Findings ({tableData.length})
          </p>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search findings…"
            className="text-sm rounded px-3 py-1.5 border outline-none w-56"
            style={{
              background: '#1c2230',
              color: '#e8eaf0',
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {[
                  { key: 'severity', label: 'Severity' },
                  { key: 'study_id', label: 'Study' },
                  { key: null, label: 'Rule ID' },
                  { key: 'dataset', label: 'Dataset' },
                  { key: null, label: 'Variable' },
                  { key: 'ai_category', label: 'Category' },
                  { key: 'message', label: 'Message' },
                  { key: null, label: 'Avg Hrs' },
                ].map((col) => (
                  <th
                    key={col.label}
                    onClick={() => col.key && handleSort(col.key)}
                    className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider"
                    style={{
                      color: '#8892a4',
                      cursor: col.key ? 'pointer' : 'default',
                    }}
                  >
                    {col.label}
                    {col.key && sortCol === col.key && (
                      <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((f) => (
                <tr
                  key={f.finding_id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  className="transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                        f.severity === 'Error'
                          ? 'bg-red-900/30 text-red-400 border-red-700/40'
                          : 'bg-orange-900/20 text-orange-400 border-orange-700/30'
                      }`}
                    >
                      {f.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-medium text-xs" style={{ color: '#e8eaf0' }}>
                    {f.study_id}
                  </td>
                  <td className="px-4 py-2 text-xs" style={{ color: '#8892a4' }}>
                    {f.rule_id}
                  </td>
                  <td className="px-4 py-2 text-xs" style={{ color: '#8892a4' }}>
                    {f.dataset}
                  </td>
                  <td className="px-4 py-2 text-xs" style={{ color: '#8892a4' }}>
                    {f.variable}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
                    >
                      {f.ai_category}
                    </span>
                  </td>
                  <td
                    className="px-4 py-2 text-xs max-w-xs truncate"
                    style={{ color: '#8892a4' }}
                    title={f.message}
                  >
                    {f.message}
                  </td>
                  <td className="px-4 py-2 text-xs" style={{ color: '#8892a4' }}>
                    {f.avg_resolution_hrs}h
                  </td>
                </tr>
              ))}
              {tableData.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm"
                    style={{ color: '#8892a4' }}
                  >
                    No findings match the search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
