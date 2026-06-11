'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Campaign {
  id: number;
  subject: string;
  body: string;
  status: 'draft' | 'testing' | 'queued' | 'processing' | 'completed' | 'failed' | 'paused' | 'cancelled';
  created_at: string;
  client_count: number;
  smtp_label?: string | null;
  sent_count?: number;
  failed_count?: number;
  opened_count?: number;
  scheduled_at?: string | null;
}

interface UserProfile {
  email: string;
  smtp_host: string;
  smtp_email: string;
  smtp_port: number;
}

interface SmtpAccount {
  id: number;
  label: string;
  from_email: string;
  is_verified: boolean;
  is_active: boolean;
  host?: string;
  port?: number;
}

export default function DashboardPage() {
  const router = useRouter();

  // Data states
  const [user, setUser] = useState<UserProfile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allSmtpAccounts, setAllSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState<boolean>(true);
  const [loadingSmtp, setLoadingSmtp] = useState<boolean>(true);

  // Dynamic dashboard stats state
  const [stats, setStats] = useState<{
    deliveryPerformance: {
      chart: { day: string; count: number; dateStr: string }[];
      bounceRate: string;
      peakTime: string;
      topRegion: string;
    };
    smtpTunnels: { label: string; host: string; status: string }[];
    summary?: {
      totalSentCount: number;
      deliveryRate: string;
      tunnelHealth: string;
      sentTrend: string;
    };
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  // Pagination and search for dashboard table
  const [campaignSearchTerm, setCampaignSearchTerm] = useState<string>('');
  const [campaignPage, setCampaignPage] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'campaigns'>('dashboard');
  const campaignsPerPage = 5;

  // Fetch list of user's SMTP accounts
  async function fetchSmtpAccounts() {
    try {
      const res = await fetch('/api/smtp');
      if (res.ok) {
        const data = await res.json();
        const accounts: SmtpAccount[] = data.smtpAccounts || [];
        setAllSmtpAccounts(accounts);
      }
    } catch (err) {
      console.error('Failed to fetch SMTP accounts:', err);
    } finally {
      setLoadingSmtp(false);
    }
  }

  // Fetch dynamic stats
  async function fetchStats() {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    // 1. Fetch authenticated user profile
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/auth');
          return;
        }
        const data = await res.json();
        if (data.authenticated) {
          setUser(data.user);
        } else {
          router.push('/auth');
        }
      } catch (err) {
        console.error('Failed to authenticate user', err);
        router.push('/auth');
      } finally {
        setLoadingUser(false);
      }
    }

    // 2. Fetch list of user's campaigns
    async function fetchCampaigns() {
      try {
        const res = await fetch('/api/campaigns');
        if (res.ok) {
          const data = await res.json();
          setCampaigns(data.campaigns || []);
        }
      } catch (err) {
        console.error('Failed to fetch campaigns', err);
      } finally {
        setLoadingCampaigns(false);
      }
    }

    fetchUser();
    fetchCampaigns();
    fetchSmtpAccounts();
    fetchStats();
  }, [router]);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/auth');
        router.refresh();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7fb] text-slate-500 font-sans">
        <div className="flex flex-col items-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-[#5038ED]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-semibold">Validating credentials...</span>
        </div>
      </div>
    );
  }

  // Derived statistics
  const totalSentCount = campaigns.reduce((sum, c) => sum + (c.status === 'completed' ? c.client_count : 0), 0);
  const activeSmtpCount = allSmtpAccounts.filter(acc => acc.is_active && acc.is_verified).length;
  const totalSmtpCount = allSmtpAccounts.length;

  // Filter & paginate campaigns
  const filteredCampaigns = campaigns.filter(c => 
    c.subject.toLowerCase().includes(campaignSearchTerm.toLowerCase()) ||
    (c.smtp_label && c.smtp_label.toLowerCase().includes(campaignSearchTerm.toLowerCase()))
  );
  
  const totalCampaignPages = Math.ceil(filteredCampaigns.length / campaignsPerPage) || 1;
  const paginatedCampaigns = filteredCampaigns.slice(
    (campaignPage - 1) * campaignsPerPage,
    campaignPage * campaignsPerPage
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <nav className="sticky top-4 z-40 mx-auto w-[calc(100%-4rem)] max-w-7xl bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-2xl shadow-lg px-8 py-3 flex items-center justify-between transition-all mt-4">
        <div className="flex items-center space-x-12">
          {/* Logo */}
          <Link href="/dashboard" className="flex flex-col items-start leading-none">
            <span className="font-extrabold text-2xl tracking-tight text-[#5038ED] leading-none">
              Queuvo
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 leading-none">
              Email Marketing
            </span>
          </Link>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-8">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setCampaignPage(1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`py-2 text-sm font-semibold relative transition-colors cursor-pointer ${
                activeTab === 'dashboard' ? 'text-[#5038ED]' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Dashboard
              {activeTab === 'dashboard' && (
                <span className="absolute bottom-[-13px] left-0 right-0 h-[3px] bg-[#5038ED] rounded-full" />
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('campaigns');
                const el = document.getElementById('your-campaigns-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`py-2 text-sm font-semibold relative transition-colors cursor-pointer ${
                activeTab === 'campaigns' ? 'text-[#5038ED]' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Campaigns
              {activeTab === 'campaigns' && (
                <span className="absolute bottom-[-13px] left-0 right-0 h-[3px] bg-[#5038ED] rounded-full" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-5">
          {/* User Profile / Logout */}
          <div className="flex items-center space-x-4 pl-2 border-l border-slate-200">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-medium text-slate-600">
                {user?.email || 'user@example.com'}
              </span>
            </div>
            <button 
              onClick={handleLogout} 
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 hover:text-rose-600 text-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-8 py-8">
        
        {/* ========================================================================= */}
        {/* 1. DASHBOARD VIEW */}
        {/* ========================================================================= */}
        <div className="space-y-8 animate-fadeIn">
            {/* Header section */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Operational Overview</h1>
                <p className="text-slate-500 text-sm mt-1.5">Manage your high-volume mail infrastructure and active campaigns.</p>
              </div>
              <div className="flex items-center space-x-3">
                <Link
                  href="/dashboard/smtp-tunnels"
                  className="inline-flex items-center px-4.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer space-x-2"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>Add SMTP Tunnel</span>
                </Link>
                <Link
                  href="/dashboard/create-campaign"
                  className="inline-flex items-center px-4.5 py-2.5 bg-[#5038ED] hover:bg-[#402bd6] text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-lg transition-all cursor-pointer space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create Campaign</span>
                </Link>
              </div>
            </div>

            {/* KPI Metrics row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Card 1 */}
              <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Mails Sent</span>
                  <div className="flex items-baseline mt-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {loadingStats ? (
                        <span className="text-slate-300">...</span>
                      ) : stats?.summary ? (
                        stats.summary.totalSentCount > 1000 
                          ? `${(stats.summary.totalSentCount/1000).toFixed(1)}k` 
                          : stats.summary.totalSentCount
                      ) : (
                        totalSentCount
                      )}
                    </span>
                    {!loadingStats && stats?.summary && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ml-3 inline-flex items-center ${
                        stats.summary.sentTrend.startsWith('-') 
                          ? 'text-rose-600 bg-rose-50' 
                          : 'text-emerald-600 bg-emerald-50'
                      }`}>
                        <svg className={`w-2.5 h-2.5 mr-0.5 ${stats.summary.sentTrend.startsWith('-') ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                        {stats.summary.sentTrend}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Delivery Rate</span>
                  <div className="flex items-baseline mt-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {loadingStats ? (
                        <span className="text-slate-300">...</span>
                      ) : stats?.summary ? (
                        stats.summary.deliveryRate
                      ) : (
                        '100.0%'
                      )}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full ml-3 inline-flex items-center">
                      Dynamic
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tunnel Health</span>
                  <div className="flex items-baseline mt-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {loadingStats ? (
                        <span className="text-slate-300">...</span>
                      ) : stats?.summary ? (
                        stats.summary.tunnelHealth
                      ) : (
                        '0%'
                      )}
                    </span>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ml-3 ${
                      stats?.summary && stats.summary.tunnelHealth === '100%' 
                        ? 'text-emerald-700 bg-emerald-50' 
                        : stats?.summary && stats.summary.tunnelHealth !== '0%'
                        ? 'text-amber-700 bg-amber-50'
                        : 'text-rose-700 bg-rose-50'
                    }`}>
                      {stats?.summary && stats.summary.tunnelHealth === '100%' ? 'Stable' : 'Optimal'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4 */}
              <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SMTP Active</span>
                  <div className="flex items-baseline mt-2">
                    <span className="text-3xl font-extrabold text-slate-900">{activeSmtpCount} <span className="text-lg text-slate-400 font-normal">/ {totalSmtpCount}</span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Your Campaigns Table section */}
            <div id="your-campaigns-section" className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Your Campaigns</h2>
                <div className="flex items-center space-x-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search campaigns..."
                      value={campaignSearchTerm}
                      onChange={(e) => { setCampaignSearchTerm(e.target.value); setCampaignPage(1); }}
                      className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] transition-all w-56"
                    />
                    <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {/* Action buttons icon */}
                  {/* <button className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 cursor-pointer">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </button> */}
                  {/* <button className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 cursor-pointer">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button> */}
                </div>
              </div>

              {loadingCampaigns ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                  <svg className="animate-spin h-7 w-7 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-xs">Loading campaign directory...</span>
                </div>
              ) : paginatedCampaigns.length === 0 ? (
                <div className="py-16 text-center border-t border-slate-100 p-6 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">No Campaigns Configured</h3>
                  <p className="text-slate-400 text-xs mt-1 max-w-sm">Create your first bulk campaign by clicking "+ Compose Campaign" above.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/50">
                        <th className="py-4 px-6">Subject</th>
                        <th className="py-4 px-6">SMTP Account</th>
                        <th className="py-4 px-6">Recipients</th>
                        <th className="py-4 px-6">Status</th>
                        <th className="py-4 px-6">Send Time</th>
                        <th className="py-4 px-6">Open Rate</th>
                        <th className="py-4 px-6">Date Created</th>
                        <th className="py-4 px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedCampaigns.map((camp) => (
                        <tr key={camp.id} className="hover:bg-slate-50/50 transition-colors group">
                           <td className="py-4 px-6 font-semibold text-slate-900 max-w-[200px] truncate">
                            {camp.subject}
                          </td>
                          <td className="py-4 px-6 text-slate-500 font-medium">
                            {camp.smtp_label || <span className="text-slate-300 italic font-normal">None</span>}
                          </td>
                          <td className="py-4 px-6 text-slate-600 font-mono">
                            {camp.client_count.toLocaleString()}
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase inline-block ${
                                camp.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : camp.status === 'processing'
                                  ? 'bg-[#F3E8FF] text-[#6B21A8]'
                                  : camp.status === 'queued'
                                  ? 'bg-amber-50 text-amber-700 animate-pulse'
                                  : camp.status === 'failed'
                                  ? 'bg-rose-50 text-rose-600'
                                  : camp.status === 'paused'
                                  ? 'bg-slate-100 text-slate-500'
                                  : camp.status === 'cancelled'
                                  ? 'bg-slate-100 text-slate-400 line-through'
                                  : 'bg-slate-50 text-slate-400'
                              }`}
                            >
                              {camp.status === 'completed' && 'Completed'}
                              {camp.status === 'processing' && `Processing (${(camp.sent_count || 0) + (camp.failed_count || 0)} / ${camp.client_count})`}
                              {camp.status === 'queued' && 'Queued'}
                              {camp.status === 'failed' && 'Failed'}
                              {camp.status === 'paused' && 'Paused'}
                              {camp.status === 'cancelled' && 'Cancelled'}
                              {camp.status === 'draft' && 'Draft'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-xs text-slate-500 font-medium">
                            {camp.status === 'queued' ? (
                              camp.scheduled_at ? (
                                <div className="flex flex-col">
                                  <span className="text-slate-400 text-[9px] uppercase font-bold">Scheduled For</span>
                                  <span className="text-slate-700 font-semibold mt-0.5">
                                    {new Date(camp.scheduled_at).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                    })}{' '}
                                    {new Date(camp.scheduled_at).toLocaleTimeString(undefined, {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-emerald-600 font-bold">Immediately</span>
                              )
                            ) : camp.status === 'draft' ? (
                              <span className="text-slate-400 italic">Not set</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-slate-600 font-mono">
                            {camp.sent_count && camp.sent_count > 0 
                              ? `${((Number(camp.opened_count) || 0) / camp.sent_count * 100).toFixed(1)}%`
                              : '0.0%'
                            }
                          </td>
                          <td className="py-4 px-6 text-slate-400">
                            {new Date(camp.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>

                          <td className="py-4 px-6 text-right">
                            <Link
                              href={`/dashboard/campaigns/${camp.id}`}
                              className="inline-flex items-center px-3 py-1.5 bg-slate-50 group-hover:bg-[#5038ED] group-hover:text-white border border-slate-200 group-hover:border-[#5038ED] text-slate-700 text-xs font-semibold rounded-lg transition-all"
                            >
                              Manage
                              <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Table Pagination footer */}
                  <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/20">
                    <span>Showing {(campaignPage - 1) * campaignsPerPage + 1} to {Math.min(campaignPage * campaignsPerPage, filteredCampaigns.length)} of {filteredCampaigns.length} campaigns</span>
                    <div className="flex items-center space-x-2">
                      <button
                        disabled={campaignPage === 1}
                        onClick={() => setCampaignPage(prev => Math.max(prev - 1, 1))}
                        className="px-3 py-1 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg font-medium transition-colors cursor-pointer"
                      >
                        Previous
                      </button>
                      <button
                        disabled={campaignPage === totalCampaignPages}
                        onClick={() => setCampaignPage(prev => Math.min(prev + 1, totalCampaignPages))}
                        className="px-3 py-1 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg font-medium transition-colors cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Section: Delivery Performance & SMTP Tunnel Status */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Column 1: Delivery Performance (Bar Chart) */}
              <div className="lg:col-span-7 bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Delivery Performance</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Real-time throughput logs and nodes performance analytics.</p>
                </div>

                {loadingStats ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                    <svg className="animate-spin h-7 w-7 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-xs">Loading performance data...</span>
                  </div>
                ) : !stats ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Failed to load performance metrics
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6 items-center">
                    {/* CSS Bar Chart */}
                    <div className="md:col-span-8 flex items-end justify-between h-36 px-4 pt-4 relative">
                      {/* Grid lines */}
                      <div className="absolute inset-x-0 bottom-4 border-b border-slate-100"></div>
                      <div className="absolute inset-x-0 bottom-16 border-b border-slate-100"></div>
                      <div className="absolute inset-x-0 bottom-28 border-b border-slate-100"></div>
                      
                      {stats.deliveryPerformance.chart.map((dayData, idx) => {
                        const maxVal = Math.max(...stats.deliveryPerformance.chart.map(c => c.count), 1);
                        const heightPct = dayData.count > 0 
                          ? Math.max(10, Math.round((dayData.count / maxVal) * 100))
                          : 4;
                        return (
                          <div key={idx} className="flex flex-col items-center z-10 w-[10%] group h-full justify-end">
                            <div className="w-full flex-1 flex items-end mb-2 h-24">
                              <div 
                                style={{ height: `${heightPct}%` }}
                                className="w-full bg-[#5038ED] rounded-md transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-y-[1.03] relative min-h-[4px] cursor-pointer shadow-sm hover:shadow-md"
                              >
                                <span className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-950 text-white text-[10px] py-1 px-2 rounded font-semibold whitespace-nowrap z-20 transition-opacity">
                                  {dayData.count.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400 font-semibold">{dayData.day}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Metrics details */}
                    <div className="md:col-span-4 space-y-4 border-l border-slate-100 pl-6 h-full flex flex-col justify-center">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Peak Time</span>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{stats.deliveryPerformance.peakTime}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Top Target</span>
                        <p className="text-sm font-bold text-slate-800 mt-0.5 truncate max-w-[120px]" title={stats.deliveryPerformance.topRegion}>
                          {stats.deliveryPerformance.topRegion}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Failure Rate</span>
                        <p className={`text-sm font-bold mt-0.5 ${stats.deliveryPerformance.bounceRate === '0.00%' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {stats.deliveryPerformance.bounceRate}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Column 2: SMTP Tunnel Status Card (Purple background) */}
              <div className="lg:col-span-5 bg-[#5038ED] rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/10 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold">SMTP Tunnel Status</h3>
                  
                  {/* Status rows */}
                  <div className="mt-5 space-y-3">
                    {loadingStats ? (
                      <div className="py-6 flex flex-col items-center justify-center text-white/60">
                        <svg className="animate-spin h-5 w-5 text-white/40 mb-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-[10px]">Loading status...</span>
                      </div>
                    ) : !stats || stats.smtpTunnels.length === 0 ? (
                      <div className="py-6 text-center text-xs text-white/60">
                        No SMTP Tunnels configured
                      </div>
                    ) : (
                      stats.smtpTunnels.slice(0, 3).map((tunnel, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white/10 rounded-xl">
                          <span className="text-xs font-semibold truncate max-w-[160px]" title={tunnel.label}>
                            {tunnel.label}
                          </span>
                          <span className={`inline-flex items-center text-[10px] font-bold ${
                            tunnel.status === 'Healthy' 
                              ? 'text-emerald-300' 
                              : tunnel.status === 'Idle'
                              ? 'text-slate-300'
                              : 'text-rose-300'
                          }`}>
                            {tunnel.status === 'Healthy' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 mr-1.5 animate-pulse" />
                            )}
                            {tunnel.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Link
                  href="/dashboard/smtp-tunnels"
                  className="w-full mt-6 py-2.5 bg-white text-[#5038ED] hover:bg-slate-50 transition-colors text-xs font-bold rounded-xl cursor-pointer text-center block"
                >
                  Review Tunnel Configuration
                </Link>
              </div>

            </div>
          </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white py-6 px-8 mt-12 text-xs text-slate-400 flex flex-col md:flex-row items-center justify-between">
        <span>&copy; 2026 Queuvo.</span>
      </footer>
    </div>
  );
}
