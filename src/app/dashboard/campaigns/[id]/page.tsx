'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Campaign {
  id: number;
  subject: string;
  body: string;
  status: 'draft' | 'testing' | 'executed';
  created_at: string;
}

interface Client {
  id: number;
  email: string;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
}

interface StatusCounts {
  pending: number;
  sent: number;
  failed: number;
  total: number;
}

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignIdStr = params?.id as string;
  const campaignId = parseInt(campaignIdStr, 10);

  // States
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({ pending: 0, sent: 0, failed: 0, total: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Execution States
  const [testingLoading, setTestingLoading] = useState<boolean>(false);
  const [executingLoading, setExecutingLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search filter
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Fetch campaign details
  const fetchCampaignData = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Campaign not found.');
        } else {
          setError('Failed to load campaign.');
        }
        return;
      }
      const data = await res.json();
      if (data.success) {
        setCampaign(data.campaign);
        setClients(data.clients || []);
        
        // Calculate counts
        const rawCounts = data.counts as { status: 'pending' | 'sent' | 'failed'; count: number }[];
        const countsObj: StatusCounts = { pending: 0, sent: 0, failed: 0, total: 0 };
        
        rawCounts.forEach(c => {
          if (c.status === 'pending') countsObj.pending = c.count;
          if (c.status === 'sent') countsObj.sent = c.count;
          if (c.status === 'failed') countsObj.failed = c.count;
        });
        countsObj.total = countsObj.pending + countsObj.sent + countsObj.failed;
        setCounts(countsObj);

        if (data.campaign.status === 'executed') {
          setExecutingLoading(false);
        }
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while loading campaign details.');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    if (isNaN(campaignId)) {
      setError('Invalid campaign ID.');
      setLoading(false);
      return;
    }
    
    // Initial fetch
    fetchCampaignData(true);
  }, [campaignId]);

  // Set up polling when campaign is executing (status !== 'executed' and we have pending emails actively sending)
  useEffect(() => {
    if (isNaN(campaignId)) return;

    let intervalId: NodeJS.Timeout | null = null;
    
    // If we've triggered sending and it's not complete, poll every 2.5 seconds
    const shouldPoll = campaign && campaign.status !== 'executed' && counts.pending > 0 && counts.sent + counts.failed > 0;
    
    if (shouldPoll || executingLoading) {
      intervalId = setInterval(() => {
        fetchCampaignData(false);
      }, 2500);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [campaign, counts, executingLoading, campaignId]);

  const handleRunTest = async () => {
    setTestingLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/send/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Test email successfully sent to your verified inbox!' });
        // Refresh campaign to get the updated status ('testing')
        fetchCampaignData(false);
      } else {
        throw new Error(data.error || 'Test email failed.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setTestingLoading(false);
    }
  };

  const handleSendToAll = async () => {
    if (!window.confirm('Are you sure you want to execute bulk sending to ALL recipients now? This action cannot be undone.')) {
      return;
    }
    
    setExecutingLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/send/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Bulk mailing started. Follow real-time progress below!' });
        // Trigger immediate status updates
        fetchCampaignData(false);
      } else {
        throw new Error(data.error || 'Failed to start bulk send.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setActionMessage({ type: 'error', text: msg });
      setExecutingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex flex-col items-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Retrieving campaign status...</span>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 px-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md text-center shadow-2xl">
          <svg className="w-12 h-12 text-rose-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-bold text-slate-200 mb-2">Error Occurred</h3>
          <p className="text-slate-400 text-sm mb-6">{error || 'Unable to fetch campaign.'}</p>
          <Link href="/dashboard" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors">
            Go back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const processedCount = counts.sent + counts.failed;
  const progressPercent = counts.total > 0 ? Math.round((processedCount / counts.total) * 100) : 0;

  // Search filtering
  const filteredClients = clients.filter(c => 
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors mr-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Campaign Control Center
          </span>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8">
        
        {/* Alerts Section */}
        {actionMessage && (
          <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
            actionMessage.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}>
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {actionMessage.type === 'success' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              )}
            </svg>
            <span className="text-sm font-medium">{actionMessage.text}</span>
          </div>
        )}

        {/* Campaign Header Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Campaign Info */}
          <div className="lg:col-span-7 bg-slate-900/40 backdrop-blur-md border border-slate-900 rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  campaign.status === 'executed'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : campaign.status === 'testing'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-slate-800 text-slate-300 border border-slate-700/50'
                }`}>
                  {campaign.status}
                </span>
                <span className="text-xs text-slate-500">
                  Created on {new Date(campaign.created_at).toLocaleString()}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-100">{campaign.subject}</h1>
            </div>

            <div className="border-t border-slate-800/60 pt-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Body</h3>
              <div className="bg-slate-950/40 border border-slate-900 rounded-lg p-4 max-h-60 overflow-y-auto text-sm text-slate-300 whitespace-pre-wrap font-mono">
                {campaign.body}
              </div>
            </div>
          </div>

          {/* Action Center / Stats */}
          <div className="lg:col-span-5 bg-slate-900/40 backdrop-blur-md border border-slate-900 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-4 bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
                Execution Controls
              </h2>

              {/* Progress visualizer */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Delivery Progress ({processedCount} / {counts.total} sent)</span>
                  <span className="font-bold text-indigo-400">{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-slate-900">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>

              {/* Stats Cards grid */}
              <div className="grid grid-cols-3 gap-3 text-center mb-6">
                <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl">
                  <p className="text-xs text-slate-500">Pending</p>
                  <p className="text-lg font-mono font-bold text-slate-300">{counts.pending}</p>
                </div>
                <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl border-emerald-500/10">
                  <p className="text-xs text-slate-500">Sent</p>
                  <p className="text-lg font-mono font-bold text-emerald-400">{counts.sent}</p>
                </div>
                <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl border-rose-500/10">
                  <p className="text-xs text-slate-500">Failed</p>
                  <p className="text-lg font-mono font-bold text-rose-400">{counts.failed}</p>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-3 pt-4 border-t border-slate-800/60">
              <button
                onClick={handleRunTest}
                disabled={testingLoading || executingLoading || campaign.status === 'executed'}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {testingLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Running SMTP Test...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Run Test Send
                  </>
                )}
              </button>

              <button
                onClick={handleSendToAll}
                disabled={
                  testingLoading || 
                  executingLoading || 
                  campaign.status === 'draft' || 
                  campaign.status === 'executed' ||
                  counts.pending === 0
                }
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {executingLoading || (campaign.status === 'testing' && counts.pending > 0 && counts.sent + counts.failed > 0) ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Executing Send Loop...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send to All Recipients ({counts.pending})
                  </>
                )}
              </button>
              
              {campaign.status === 'draft' && (
                <p className="text-[10px] text-center text-amber-400 font-medium">
                  * SMTP Configuration must be verified first by clicking &apos;Run Test Send&apos;.
                </p>
              )}
            </div>
          </div>

        </div>

        {/* Recipients Log List */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-900 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Recipients Status Logs
            </h2>

            {/* Search Input */}
            <div className="relative w-full md:max-w-xs">
              <input
                type="text"
                placeholder="Search by email or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950/40 border border-slate-900 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
              />
              <svg className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-950">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-900 text-slate-400 font-medium">
                  <th className="py-3 px-4">Recipient Email</th>
                  <th className="py-3 px-4">Delivery Status</th>
                  <th className="py-3 px-4 text-right">Added On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-600">
                      No matching recipients found.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-900/10 transition-all">
                      <td className="py-3 px-4 font-medium text-slate-200">{client.email}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          client.status === 'sent'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : client.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            client.status === 'sent' 
                              ? 'bg-emerald-400 animate-pulse' 
                              : client.status === 'failed' 
                              ? 'bg-rose-400' 
                              : 'bg-slate-500'
                          }`}></span>
                          {client.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {new Date(client.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
