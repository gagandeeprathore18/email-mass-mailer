'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalSmtp: number;
  activeSmtp: number;
  totalCampaigns: number;
  totalSent: number;
  totalFailed: number;
  totalOpened: number;
}

interface ActivityLog {
  id: number;
  action: string;
  created_at: string;
  email: string;
  name: string | null;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function fetchDashboardData() {
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/logs')
      ]);

      if (!statsRes.ok || !logsRes.ok) {
        throw new Error('Failed to load system statistics.');
      }

      const statsData = await statsRes.json();
      const logsData = await logsRes.json();

      setStats(statsData.stats);
      setLogs(logsData.logs || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred fetching dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-slate-400">
        <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-[#5038ED]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-xs font-semibold">Loading system statistics...</span>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, sub: `${stats?.activeUsers || 0} Active`, color: 'bg-indigo-50 text-indigo-700' },
    { label: 'Active Users', value: stats?.activeUsers || 0, sub: 'Logins enabled', color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Total SMTP Tunnels', value: stats?.totalSmtp || 0, sub: `${stats?.activeSmtp || 0} Online`, color: 'bg-purple-50 text-purple-700' },
    { label: 'Active SMTPs', value: stats?.activeSmtp || 0, sub: 'Infrastructure active', color: 'bg-pink-50 text-pink-700' },
    { label: 'Total Campaigns', value: stats?.totalCampaigns || 0, sub: 'Executed in org', color: 'bg-amber-50 text-amber-700' },
    { label: 'Emails Sent', value: stats?.totalSent || 0, sub: 'Delivered successfully', color: 'bg-blue-50 text-blue-700' },
    { label: 'Opened Emails', value: stats?.totalOpened || 0, sub: `${stats?.totalSent ? ((stats.totalOpened / stats.totalSent) * 100).toFixed(1) : 0}% Open Rate`, color: 'bg-teal-50 text-teal-700' },
    { label: 'Failed Mails', value: stats?.totalFailed || 0, sub: 'Bounced / SMTP rejects', color: 'bg-rose-50 text-rose-700' },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">System Dashboard</h1>
        <p className="text-slate-500 text-xs mt-1">Real-time health statistics, user counts, and activity logs across the organization.</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-2xl">
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</span>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">{card.value.toLocaleString()}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400">{card.sub}</span>
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${card.color}`}>Stat</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity Logs */}
      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent Activity Feed</h2>
            <p className="text-slate-400 text-xs mt-0.5">Real-time audit log of system modifications and user submissions.</p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Refresh Logs
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/50">
                <th className="py-4 px-6">Timestamp</th>
                <th className="py-4 px-6">User</th>
                <th className="py-4 px-6">Action Event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[12px] text-slate-600">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-400 font-sans text-xs italic">
                    No recent events logged.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const dateStr = new Date(log.created_at).toLocaleString();
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 text-slate-400 whitespace-nowrap">{dateStr}</td>
                      <td className="py-4 px-6 text-slate-700 font-sans font-semibold">
                        <span className="block">{log.name || 'Admin'}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{log.email}</span>
                      </td>
                      <td className="py-4 px-6 text-slate-800 font-sans font-semibold bg-slate-50/20">{log.action}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
