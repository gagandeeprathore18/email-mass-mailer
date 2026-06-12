'use client';

import React, { useState, useEffect } from 'react';

interface Campaign {
  id: number;
  subject: string;
  body: string;
  status: 'draft' | 'queued' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  sent_count: number;
  failed_count: number;
  opened_count: number;
  scheduled_at: string | null;
  creator_email: string;
  creator_name: string | null;
  smtp_label: string | null;
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  async function fetchCampaigns() {
    try {
      const res = await fetch('/api/admin/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      } else {
        throw new Error('Failed to fetch campaigns.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleAction = async (campaignId: number, action: 'pause' | 'resume' | 'cancel') => {
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action} campaign.`);
      }
      setSuccess(`Campaign successfully updated: ${action}d.`);
      fetchCampaigns();
      if (selectedCampaign && selectedCampaign.id === campaignId) {
        // Refresh detail modal if open
        const updated = campaigns.find(c => c.id === campaignId);
        if (updated) {
          let nextStatus: Campaign['status'] = 'queued';
          if (action === 'pause') nextStatus = 'paused';
          if (action === 'cancel') nextStatus = 'cancelled';
          setSelectedCampaign({ ...updated, status: nextStatus });
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getStatusBadgeClass = (status: Campaign['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'processing':
        return 'bg-blue-50 text-blue-700 border border-blue-100 animate-pulse';
      case 'queued':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-100';
      case 'paused':
        return 'bg-amber-50 text-amber-700 border border-amber-100';
      case 'failed':
        return 'bg-rose-50 text-rose-700 border border-rose-100';
      case 'cancelled':
        return 'bg-slate-100 text-slate-600 border border-slate-200';
      default:
        return 'bg-slate-50 text-slate-500 border border-slate-100';
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn font-sans">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Campaign Monitoring</h1>
        <p className="text-slate-500 text-xs mt-1">
          Monitor all mailing campaigns across the organization, review their real-time analytics, or pause, resume, and cancel active jobs.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl">
          {success}
        </div>
      )}

      {/* Campaigns Table */}
      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <svg className="animate-spin h-8 w-8 text-[#5038ED] mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs">Loading campaign directory...</span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs italic">
            No campaigns have been created in the organization yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/50">
                  <th className="py-4 px-6">Subject</th>
                  <th className="py-4 px-6">Created By</th>
                  <th className="py-4 px-6">SMTP Account</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Stats (S / F / O)</th>
                  <th className="py-4 px-6">Scheduled Time</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-800">
                      <button
                        onClick={() => setSelectedCampaign(c)}
                        className="text-left font-semibold text-[#5038ED] hover:underline focus:outline-none cursor-pointer"
                      >
                        {c.subject}
                      </button>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700">{c.creator_name || 'No Name'}</span>
                        <span className="text-[10px] text-slate-400">{c.creator_email}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {c.smtp_label ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                          {c.smtp_label}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-700">
                      <span className="text-emerald-600">{c.sent_count}</span>
                      <span className="mx-1 text-slate-300">/</span>
                      <span className="text-rose-600">{c.failed_count}</span>
                      <span className="mx-1 text-slate-300">/</span>
                      <span className="text-blue-600">{c.opened_count}</span>
                    </td>
                    <td className="py-4 px-6 text-slate-500">
                      {c.scheduled_at ? (
                        new Date(c.scheduled_at).toLocaleString()
                      ) : (
                        <span className="text-slate-400 italic">Immediate</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                      {c.status === 'paused' && (
                        <button
                          onClick={() => handleAction(c.id, 'resume')}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-lg cursor-pointer transition-all"
                        >
                          Resume
                        </button>
                      )}
                      {(c.status === 'queued' || c.status === 'processing') && (
                        <button
                          onClick={() => handleAction(c.id, 'pause')}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-lg cursor-pointer transition-all"
                        >
                          Pause
                        </button>
                      )}
                      {!['completed', 'failed', 'cancelled'].includes(c.status) && (
                        <button
                          onClick={() => handleAction(c.id, 'cancel')}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-bold rounded-lg cursor-pointer transition-all"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedCampaign(c)}
                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold rounded-lg cursor-pointer transition-all"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Campaign Details Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-extrabold text-lg text-slate-800">{selectedCampaign.subject}</h3>
                <p className="text-slate-400 text-xs mt-1">
                  Created on {new Date(selectedCampaign.created_at).toLocaleString()} by {selectedCampaign.creator_name || 'User'} ({selectedCampaign.creator_email})
                </p>
              </div>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                <span className="block text-xs font-bold text-slate-800 uppercase mt-1">
                  {selectedCampaign.status}
                </span>
              </div>
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center">
                <span className="block text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Sent</span>
                <span className="block text-lg font-extrabold text-emerald-700 mt-0.5">
                  {selectedCampaign.sent_count}
                </span>
              </div>
              <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-center">
                <span className="block text-[10px] font-bold text-rose-500 uppercase tracking-wider">Failed</span>
                <span className="block text-lg font-extrabold text-rose-700 mt-0.5">
                  {selectedCampaign.failed_count}
                </span>
              </div>
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-center">
                <span className="block text-[10px] font-bold text-blue-500 uppercase tracking-wider">Opened</span>
                <span className="block text-lg font-extrabold text-blue-700 mt-0.5">
                  {selectedCampaign.opened_count}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  SMTP Account Configuration
                </label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-150 rounded-xl text-xs text-slate-600">
                  {selectedCampaign.smtp_label ? (
                    <span><strong>Label:</strong> {selectedCampaign.smtp_label}</span>
                  ) : (
                    <span className="text-slate-400 italic">No SMTP account associated.</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Email Body Preview
                </label>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs max-h-48 overflow-y-auto whitespace-pre-wrap text-slate-700 font-mono">
                  {selectedCampaign.body}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 mt-6">
              {selectedCampaign.status === 'paused' && (
                <button
                  onClick={() => handleAction(selectedCampaign.id, 'resume')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Resume Campaign
                </button>
              )}
              {(selectedCampaign.status === 'queued' || selectedCampaign.status === 'processing') && (
                <button
                  onClick={() => handleAction(selectedCampaign.id, 'pause')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Pause Campaign
                </button>
              )}
              {!['completed', 'failed', 'cancelled'].includes(selectedCampaign.status) && (
                <button
                  onClick={() => handleAction(selectedCampaign.id, 'cancel')}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Cancel Campaign
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedCampaign(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
