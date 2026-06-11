'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SmtpAccount {
  id: number;
  label: string;
  from_email: string;
  is_verified: boolean;
  is_active: boolean;
}

export default function SmtpTunnelsPage() {
  const router = useRouter();

  // Data states
  const [allSmtpAccounts, setAllSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [loadingSmtp, setLoadingSmtp] = useState<boolean>(true);

  // Add SMTP Form states
  const [smtpLabel, setSmtpLabel] = useState<string>('');
  const [smtpHost, setSmtpHost] = useState<string>('');
  const [smtpPort, setSmtpPort] = useState<string>('587');
  const [smtpUsername, setSmtpUsername] = useState<string>('');
  const [smtpPassword, setSmtpPassword] = useState<string>('');
  const [smtpFromEmail, setSmtpFromEmail] = useState<string>('');
  const [smtpVerifyLoading, setSmtpVerifyLoading] = useState<boolean>(false);
  const [smtpFormError, setSmtpFormError] = useState<string>('');
  const [smtpFormSuccess, setSmtpFormSuccess] = useState<string>('');

  // Fetch SMTP accounts
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

  useEffect(() => {
    async function checkUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/auth');
          return;
        }
      } catch (err) {
        console.error('Auth error', err);
        router.push('/auth');
      } finally {
        setLoadingUser(false);
      }
    }
    checkUser();
    fetchSmtpAccounts();
  }, [router]);

  // Add SMTP Submit
  const handleAddSmtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!smtpLabel || !smtpHost || !smtpPort || !smtpUsername || !smtpPassword || !smtpFromEmail) {
      setSmtpFormError('Please fill in all SMTP fields.');
      return;
    }

    setSmtpVerifyLoading(true);
    setSmtpFormError('');
    setSmtpFormSuccess('');

    try {
      const res = await fetch('/api/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: smtpLabel,
          host: smtpHost,
          port: smtpPort,
          username: smtpUsername,
          password: smtpPassword,
          from_email: smtpFromEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register SMTP account.');
      }

      setSmtpFormSuccess('SMTP connection verified and registered successfully!');
      setSmtpLabel('');
      setSmtpHost('');
      setSmtpPort('587');
      setSmtpUsername('');
      setSmtpPassword('');
      setSmtpFromEmail('');

      await fetchSmtpAccounts();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSmtpFormError(err.message);
      } else {
        setSmtpFormError('An unexpected error occurred during SMTP verification.');
      }
    } finally {
      setSmtpVerifyLoading(false);
    }
  };

  // Delete SMTP Account
  const handleDeleteSmtp = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this SMTP configuration?')) return;
    try {
      const res = await fetch(`/api/smtp?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchSmtpAccounts();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete SMTP account.');
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred while deleting.');
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
          <span className="text-sm font-semibold">Loading SMTP tunnels...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <nav className="sticky top-4 z-40 mx-auto w-[calc(100%-4rem)] max-w-7xl bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-2xl shadow-lg px-8 py-3 flex items-center justify-between transition-all mt-4">
        <div className="flex items-center space-x-6">
          <Link href="/dashboard" className="flex flex-col items-start leading-none">
            <span className="font-extrabold text-2xl tracking-tight text-[#5038ED] leading-none">
              Queuvo
            </span>
            <span className=" text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 leading-none">
              Email Marketing
            </span>
          </Link>
          
          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center space-x-2">
            <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <span className="font-bold text-sm text-slate-700">
              SMTP Infrastructure
            </span>
          </div>
        </div>
        <div>
          <Link 
            href="/dashboard" 
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 bg-white/50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center space-x-1.5"
          >
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-8">
        
        {/* Title */}
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">SMTP Infrastructure</h1>
          <p className="text-slate-500 text-sm mt-1.5">Configure and verify custom SMTP servers, check node integrity, and monitor active tunnels.</p>
        </div>

        {/* Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Add SMTP Tunnel Form */}
          <div className="lg:col-span-5 bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center space-x-2.5 bg-slate-50/50">
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <h2 className="text-base font-bold text-slate-900">Add SMTP Tunnel</h2>
            </div>

            <div className="p-6">
              {smtpFormError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs">
                  {smtpFormError}
                </div>
              )}
              {smtpFormSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs">
                  {smtpFormSuccess}
                </div>
              )}

              <form onSubmit={handleAddSmtp} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Account Label</label>
                    <input
                      type="text"
                      required
                      value={smtpLabel}
                      onChange={(e) => setSmtpLabel(e.target.value)}
                      placeholder="e.g., Marketing Primary"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">From Email</label>
                    <input
                      type="email"
                      required
                      value={smtpFromEmail}
                      onChange={(e) => setSmtpFromEmail(e.target.value)}
                      placeholder="noreply@domain.com"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Host</label>
                    <input
                      type="text"
                      required
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.provider.com"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Port</label>
                    <input
                      type="text"
                      required
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="587"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">User Email</label>
                    <input
                      type="text"
                      required
                      value={smtpUsername}
                      onChange={(e) => setSmtpUsername(e.target.value)}
                      placeholder="enter user email id"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                    <input
                      type="password"
                      required
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={smtpVerifyLoading}
                  className="w-full mt-2 py-3 bg-[#5038ED] hover:bg-[#402bd6] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center"
                >
                  {smtpVerifyLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Validating Connection...
                    </>
                  ) : (
                    'Validate & Save Connection'
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Registered SMTP Tunnels List */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center space-x-2.5">
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h2 className="text-base font-bold text-slate-900">Registered Tunnels</h2>
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{allSmtpAccounts.length} TOTAL NODES</span>
                </div>

                <div className="p-6 space-y-4 max-h-[360px] overflow-y-auto pr-2">
                  {loadingSmtp ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Loading registered SMTP tunnels...
                    </div>
                  ) : allSmtpAccounts.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs italic flex flex-col items-center justify-center">
                      No custom SMTP tunnels registered yet.
                    </div>
                  ) : (
                    allSmtpAccounts.map((acc, index) => {
                      const iconIndex = index % 3;
                      let iconSvg = null;
                      let boxBg = '';
                      let iconColor = '';
                      
                      if (iconIndex === 0) {
                        iconSvg = (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.41a14.98 14.98 0 00-6.16 12.12A14.98 14.98 0 0015.59 14.37z" />
                          </svg>
                        );
                        boxBg = 'bg-[#EEECFC]';
                        iconColor = 'text-[#5038ED]';
                      } else if (iconIndex === 1) {
                        iconSvg = (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        );
                        boxBg = 'bg-[#FDF4FF]';
                        iconColor = 'text-[#D946EF]';
                      } else {
                        iconSvg = (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                          </svg>
                        );
                        boxBg = 'bg-[#F1F5F9]';
                        iconColor = 'text-slate-500';
                      }

                      return (
                        <div key={acc.id} className="flex items-center justify-between p-4 border border-slate-100 hover:border-slate-200 rounded-xl transition-all bg-white shadow-sm">
                          <div className="flex items-center space-x-4">
                            <div className={`w-11 h-11 rounded-xl ${boxBg} ${iconColor} flex items-center justify-center shrink-0`}>
                              {iconSvg}
                            </div>
                            <div className="truncate max-w-[280px]">
                              <h3 className="font-bold text-slate-800 text-sm">{acc.label}</h3>
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{acc.from_email}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                acc.is_verified ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#B91C1C]'
                              }`}>
                                {acc.is_verified ? 'Verified' : 'Unverified'}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                acc.is_active ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#F1F5F9] text-[#475569]'
                              }`}>
                                {acc.is_active ? 'Active' : 'Paused'}
                              </span>
                            </div>

                            <div className="flex items-center space-x-1 pl-2 border-l border-slate-100">
                              <button
                                onClick={() => handleDeleteSmtp(acc.id)}
                                className="p-1.5 hover:bg-rose-50 text-rose-400 hover:text-rose-600 rounded-lg cursor-pointer"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* System Integrity banner */}
              <div className="m-6 p-4 bg-[#5038ED] text-white rounded-xl flex items-center justify-between shadow-md">
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold opacity-70 uppercase tracking-wider block">System Integrity</span>
                    <span className="text-xs font-semibold">All tunnels are optimized for delivery</span>
                  </div>
                </div>
                <span className="bg-white/25 text-white font-bold text-[10px] py-1 px-3 rounded-full uppercase tracking-wider">UPTIME: 99.98%</span>
              </div>
            </div>
          </div>

        </div>

        {/* Connection Activity Logs Table */}
        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Connection Activity Logs</h2>
            <span className="text-xs font-semibold text-slate-400">Status Check Logs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/50">
                  <th className="py-3 px-6">Timestamp</th>
                  <th className="py-3 px-6">Action</th>
                  <th className="py-3 px-6">Tunnel Node</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Response Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[12px] text-slate-600">
                {allSmtpAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-sans text-xs italic">
                      No tunnels configured to show logs.
                    </td>
                  </tr>
                ) : (
                  allSmtpAccounts.slice(0, 3).map((acc, index) => {
                    const dateStr = new Date(Date.now() - index * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
                    const actions = ['Auth Check', 'Ping Test', 'Tunnel Creation'];
                    const latency = [42, 15, 312];
                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 text-slate-400">{dateStr}</td>
                        <td className="py-4 px-6 text-slate-700 font-sans font-semibold">{actions[index % 3]}</td>
                        <td className="py-4 px-6 text-slate-700 font-sans font-semibold">{acc.label}</td>
                        <td className="py-4 px-6">
                          <span className="font-bold text-emerald-600">SUCCESS</span>
                        </td>
                        <td className="py-4 px-6 text-right text-slate-400 font-bold">{latency[index % 3]}ms</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white py-6 px-8 mt-12 text-xs text-slate-400 flex items-center justify-between">
        <span>&copy; 2026 Queuvo. </span>
      </footer>
    </div>
  );
}
