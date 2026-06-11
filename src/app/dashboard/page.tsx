'use client';

import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

interface Campaign {
  id: number;
  subject: string;
  body: string;
  status: 'draft' | 'testing' | 'executed';
  created_at: string;
  client_count: number;
  smtp_label?: string | null;
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
}

export default function DashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data states
  const [user, setUser] = useState<UserProfile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [allSmtpAccounts, setAllSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [selectedSmtpId, setSelectedSmtpId] = useState<string>('');
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState<boolean>(true);
  const [loadingSmtp, setLoadingSmtp] = useState<boolean>(true);

  // Layout Tab State
  const [activeTab, setActiveTab] = useState<'compose' | 'smtp'>('compose');

  // Campaign Form states
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [recipientMode, setRecipientMode] = useState<'excel' | 'manual'>('excel');
  const [file, setFile] = useState<File | null>(null);
  const [manualEmails, setManualEmails] = useState<string>('');
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');

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

  // Dropzone drag-over state
  const [dragOver, setDragOver] = useState<boolean>(false);

  // Fetch list of user's SMTP accounts
  async function fetchSmtpAccounts() {
    try {
      console.log('DEBUG: Fetching SMTP accounts from /api/smtp...');
      const res = await fetch('/api/smtp');
      console.log('DEBUG: Fetch SMTP response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('DEBUG: Fetch SMTP response data:', data);
        const accounts: SmtpAccount[] = data.smtpAccounts || [];
        setAllSmtpAccounts(accounts);
        console.log('DEBUG: Total SMTP accounts fetched:', accounts.length, accounts);
        
        // Filter to only display verified & active SMTP configurations
        const activeVerified = accounts.filter(acc => {
          // Check both boolean true and numeric 1 to ensure robust compatibility.
          const verified = acc.is_verified === true || Number(acc.is_verified) === 1;
          const active = acc.is_active === true || Number(acc.is_active) === 1;
          return verified && active;
        });
        
        console.log('DEBUG: Active and verified SMTP accounts:', activeVerified);
        setSmtpAccounts(activeVerified);
        if (activeVerified.length > 0) {
          setSelectedSmtpId(activeVerified[0].id.toString());
          console.log('DEBUG: Set default selectedSmtpId to:', activeVerified[0].id.toString());
        } else {
          setSelectedSmtpId('');
          console.warn('DEBUG: No active and verified SMTP accounts found after filtering.');
        }
      } else {
        console.error('DEBUG: Failed to fetch SMTP accounts, status code not OK:', res.status);
      }
    } catch (err) {
      console.error('DEBUG: Failed to fetch SMTP accounts due to error', err);
    } finally {
      setLoadingSmtp(false);
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

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (
        droppedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        droppedFile.type === 'application/vnd.ms-excel' ||
        droppedFile.name.endsWith('.xlsx') ||
        droppedFile.name.endsWith('.xls')
      ) {
        setFile(droppedFile);
      } else {
        setFormError('Invalid file type. Please upload an Excel sheet (.xlsx, .xls).');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleCreateCampaign = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject || !body) {
      setFormError('Please fill in both the subject and the body.');
      return;
    }

    if (!selectedSmtpId) {
      setFormError('Please select a verified sending account.');
      return;
    }

    if (recipientMode === 'excel' && !file) {
      setFormError('Please upload an Excel file.');
      return;
    }

    if (recipientMode === 'manual' && !manualEmails.trim()) {
      setFormError('Please manually enter at least one email.');
      return;
    }

    setFormLoading(true);
    setFormError('');
    setFormSuccess('');

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('body', body);
    formData.append('smtpAccountId', selectedSmtpId);
    if (recipientMode === 'excel' && file) {
      formData.append('file', file);
    } else if (recipientMode === 'manual') {
      formData.append('manualEmails', manualEmails);
    }

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create campaign.');
      }

      setFormSuccess(`Campaign successfully created with ${data.clientCount} recipients!`);
      setSubject('');
      setBody('');
      setFile(null);
      setManualEmails('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Reload campaigns list
      const campRes = await fetch('/api/campaigns');
      if (campRes.ok) {
        const campData = await campRes.json();
        setCampaigns(campData.campaigns || []);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('An unexpected error occurred.');
      }
    } finally {
      setFormLoading(false);
    }
  };

  // Add/verify new SMTP account handler
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

      // Refresh SMTP listings
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

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main text-text-muted">
        <div className="flex flex-col items-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium">Validating credentials...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main text-text-main flex flex-col transition-colors duration-200">
      {/* Top Navbar */}
      <nav className="border-b border-border-main bg-bg-nav/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between transition-colors duration-200">
        <div className="flex items-center space-x-3">
          <span className="font-extrabold text-lg tracking-tight text-indigo-600 dark:text-white">
            Email Mass Mailer
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {user && (
            <div className="hidden md:flex flex-col text-right mr-1">
              <span className="text-[10px] text-text-dimmed font-medium uppercase tracking-wide">Active User</span>
              <span className="text-sm text-indigo-700 dark:text-indigo-300 font-semibold">{user.email}</span>
            </div>
          )}
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Panel: Create Campaign OR Manage SMTP Accounts */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Tab Selector */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-bg-card border border-border-main rounded-2xl shadow-md transition-all duration-200">
            <button
              onClick={() => setActiveTab('compose')}
              type="button"
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'compose'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-text-dimmed hover:text-text-muted'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Compose Campaign
            </button>
            <button
              onClick={() => setActiveTab('smtp')}
              type="button"
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'smtp'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-text-dimmed hover:text-text-muted'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              SMTP Tunnels
            </button>
          </div>

          {activeTab === 'compose' ? (
            <div className="bg-bg-card border border-border-main rounded-2xl p-6 shadow-xl transition-all duration-200">
              <h2 className="text-xl font-bold mb-4 text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Compose Campaign
              </h2>

              {formError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-300 text-xs break-words">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-300 text-xs">
                  {formSuccess}
                </div>
              )}

              <form onSubmit={handleCreateCampaign} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-dimmed mb-1.5 uppercase tracking-wide">Sending Account</label>
                  {loadingSmtp ? (
                    <div className="h-10 bg-bg-input border border-border-main rounded-lg animate-pulse flex items-center px-3 text-xs text-text-dimmed">
                      Loading accounts...
                    </div>
                  ) : smtpAccounts.length === 0 ? (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-300 text-xs rounded-lg">
                      No active & verified SMTP accounts found. Please configure an SMTP account in the 'SMTP Tunnels' tab first.
                    </div>
                  ) : (
                    <select
                      value={selectedSmtpId}
                      onChange={(e) => setSelectedSmtpId(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-bg-input border border-border-main rounded-lg text-text-main focus:outline-none focus:border-border-focus text-sm transition-all"
                    >
                      {smtpAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id} className="bg-bg-dropdown text-text-main">
                          {acc.label} ({acc.from_email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-dimmed mb-1.5 uppercase tracking-wide">Subject Line</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="E.g. Exciting updates for Q3!"
                    className="w-full px-4 py-2.5 bg-bg-input border border-border-main rounded-lg text-text-main placeholder-slate-400 focus:outline-none focus:border-border-focus text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-dimmed mb-1.5 uppercase tracking-wide">Email Body (Text / HTML)</label>
                  <textarea
                    required
                    rows={8}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your email body copy here..."
                    className="w-full px-4 py-2.5 bg-bg-input border border-border-main rounded-lg text-text-main placeholder-slate-400 focus:outline-none focus:border-border-focus text-sm transition-all resize-y"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-dimmed mb-2 uppercase tracking-wide">Recipients Selection</label>
                  
                  {/* Mode Toggles */}
                  <div className="grid grid-cols-2 gap-2 mb-3 bg-bg-toggle-track p-1 rounded-lg border border-border-main">
                    <button
                      type="button"
                      onClick={() => setRecipientMode('excel')}
                      className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                        recipientMode === 'excel'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-text-dimmed hover:text-text-muted'
                      }`}
                    >
                      Excel Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientMode('manual')}
                      className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                        recipientMode === 'manual'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-text-dimmed hover:text-text-muted'
                      }`}
                    >
                      Manual Typing
                    </button>
                  </div>

                  {recipientMode === 'excel' ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
                        dragOver
                          ? 'border-indigo-500 bg-indigo-500/5'
                          : file
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-border-dropzone hover:border-border-dropzone-hover bg-bg-dropzone'
                      }`}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        className="hidden"
                      />
                      
                      {file ? (
                        <div className="space-y-1 text-emerald-500 dark:text-emerald-400">
                          <svg className="w-8 h-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm font-semibold truncate max-w-xs mx-auto">{file.name}</p>
                          <p className="text-xs text-text-dimmed">{(file.size / 1024).toFixed(1)} KB - Click to replace</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 text-text-dimmed">
                          <svg className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          <p className="text-sm font-medium"><span className="text-indigo-600 dark:text-indigo-300 font-semibold hover:underline">Upload a file</span> or drag & drop</p>
                          <p className="text-xs text-text-dimmed">Supports .xlsx or .xls files containing email columns</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <textarea
                        rows={5}
                        value={manualEmails}
                        onChange={(e) => setManualEmails(e.target.value)}
                        placeholder="Type or paste emails here (separated by commas, spaces, or new lines)&#10;E.g. user1@example.com, user2@example.com"
                        className="w-full px-4 py-2.5 bg-bg-input border border-border-main rounded-lg text-text-main placeholder-slate-400 focus:outline-none focus:border-border-focus text-sm transition-all resize-y"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={formLoading || smtpAccounts.length === 0}
                  className="w-full mt-2 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-lg text-sm transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shadow-md shadow-indigo-500/10"
                >
                  {formLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Importing Clients & Creating...
                    </>
                  ) : (
                    'Create Campaign'
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-bg-card border border-border-main rounded-2xl p-6 shadow-xl transition-all duration-200 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Add SMTP Tunnel
                </h2>
                <p className="text-xs text-text-dimmed mt-1">Configure and verify a new custom SMTP server for bulk sending.</p>
              </div>

              {smtpFormError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-300 text-xs break-words">
                  {smtpFormError}
                </div>
              )}
              {smtpFormSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-300 text-xs">
                  {smtpFormSuccess}
                </div>
              )}

              <form onSubmit={handleAddSmtp} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-text-dimmed uppercase tracking-wider mb-1.5">Account Label</label>
                    <input
                      type="text"
                      required
                      value={smtpLabel}
                      onChange={(e) => setSmtpLabel(e.target.value)}
                      placeholder="e.g. Sales SMTP"
                      className="w-full px-3 py-2 bg-bg-input border border-border-main rounded-lg text-text-main text-xs focus:outline-none focus:border-border-focus transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-dimmed uppercase tracking-wider mb-1.5">From Email</label>
                    <input
                      type="email"
                      required
                      value={smtpFromEmail}
                      onChange={(e) => setSmtpFromEmail(e.target.value)}
                      placeholder="sales@company.com"
                      className="w-full px-3 py-2 bg-bg-input border border-border-main rounded-lg text-text-main text-xs focus:outline-none focus:border-border-focus transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-text-dimmed uppercase tracking-wider mb-1.5">SMTP Host / IP</label>
                    <input
                      type="text"
                      required
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="e.g. 192.168.1.100"
                      className="w-full px-3 py-2 bg-bg-input border border-border-main rounded-lg text-text-main text-xs focus:outline-none focus:border-border-focus transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-dimmed uppercase tracking-wider mb-1.5">Port</label>
                    <input
                      type="text"
                      required
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="587"
                      className="w-full px-3 py-2 bg-bg-input border border-border-main rounded-lg text-text-main text-xs focus:outline-none focus:border-border-focus transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-text-dimmed uppercase tracking-wider mb-1.5">SMTP User / Username</label>
                    <input
                      type="text"
                      required
                      value={smtpUsername}
                      onChange={(e) => setSmtpUsername(e.target.value)}
                      placeholder="e.g. sales@company.com"
                      className="w-full px-3 py-2 bg-bg-input border border-border-main rounded-lg text-text-main text-xs focus:outline-none focus:border-border-focus transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-dimmed uppercase tracking-wider mb-1.5">SMTP Password</label>
                    <input
                      type="password"
                      required
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-bg-input border border-border-main rounded-lg text-text-main text-xs focus:outline-none focus:border-border-focus transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={smtpVerifyLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-lg text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shadow-md shadow-indigo-500/10"
                >
                  {smtpVerifyLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verifying Connection...
                    </>
                  ) : (
                    'Verify SMTP & Register Account'
                  )}
                </button>
              </form>

              {/* List of Registered Accounts */}
              <div className="border-t border-border-main pt-4 space-y-3">
                <h3 className="text-[10px] font-bold text-text-dimmed uppercase tracking-wider">Registered SMTP Tunnels ({allSmtpAccounts.length})</h3>
                {allSmtpAccounts.length === 0 ? (
                  <p className="text-xs text-text-dimmed italic">No custom SMTP tunnels registered yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {allSmtpAccounts.map((acc) => (
                      <div key={acc.id} className="flex items-center justify-between p-2.5 bg-bg-input border border-border-main rounded-lg text-xs transition-all hover:border-indigo-500/20">
                        <div className="truncate max-w-[70%]">
                          <p className="font-semibold text-text-main truncate">{acc.label}</p>
                          <p className="text-[10px] text-text-dimmed truncate">{acc.from_email}</p>
                        </div>
                        <div className="flex gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                            acc.is_verified ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}>
                            {acc.is_verified ? 'Verified' : 'Unverified'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                            acc.is_active ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800 text-text-dimmed border border-border-main'
                          }`}>
                            {acc.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Campaign History */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-bg-card border border-border-main rounded-2xl p-6 shadow-xl flex-1 flex flex-col transition-all duration-200">
            <h2 className="text-xl font-bold mb-4 text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
              </svg>
              Your Campaigns
            </h2>

            {loadingCampaigns ? (
              <div className="flex-1 py-20 flex flex-col items-center justify-center space-y-2 text-text-dimmed">
                <svg className="animate-spin h-6 w-6 text-slate-400 dark:text-slate-700" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs">Loading campaign list...</span>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="flex-1 py-20 border border-dashed border-border-main rounded-xl flex flex-col items-center justify-center text-center p-6">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-950/80 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-text-dimmed" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-text-main">No campaigns yet</h3>
                <p className="text-text-dimmed text-xs mt-1 max-w-sm">Use the composer on the left to upload your Excel sheet and format your first bulk mailing campaign.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-border-main text-text-dimmed font-medium">
                      <th className="pb-3 pr-2">Subject</th>
                      <th className="pb-3 px-2">Sending Account</th>
                      <th className="pb-3 px-2">Recipients</th>
                      <th className="pb-3 px-2">Status</th>
                      <th className="pb-3 px-2">Date Created</th>
                      <th className="pb-3 text-right pl-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900/60">
                    {campaigns.map((camp) => (
                      <tr key={camp.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-all">
                        <td className="py-4 pr-2 font-semibold text-text-main max-w-[140px] truncate">
                          {camp.subject}
                        </td>
                        <td className="py-4 px-2 text-text-muted font-semibold max-w-[140px] truncate">
                          {camp.smtp_label || (
                            <span className="text-text-dimmed font-normal italic">None</span>
                          )}
                        </td>
                        <td className="py-4 px-2 text-text-muted font-mono">
                          {camp.client_count}
                        </td>
                        <td className="py-4 px-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              camp.status === 'executed'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : camp.status === 'testing'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50'
                            }`}
                          >
                            {camp.status}
                          </span>
                        </td>
                        <td className="py-4 px-2 text-text-dimmed">
                          {new Date(camp.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: '2-digit',
                          })}
                        </td>
                        <td className="py-4 text-right pl-2">
                          <Link
                            href={`/dashboard/campaigns/${camp.id}`}
                            className="inline-flex items-center px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-lg transition-all"
                          >
                            Manage
                            <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
