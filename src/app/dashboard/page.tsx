'use client';

import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Campaign {
  id: number;
  subject: string;
  body: string;
  status: 'draft' | 'testing' | 'executed';
  created_at: string;
  client_count: number;
}

interface UserProfile {
  email: string;
  smtp_host: string;
  smtp_email: string;
  smtp_port: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data states
  const [user, setUser] = useState<UserProfile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState<boolean>(true);

  // Form states
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [recipientMode, setRecipientMode] = useState<'excel' | 'manual'>('excel');
  const [file, setFile] = useState<File | null>(null);
  const [manualEmails, setManualEmails] = useState<string>('');
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');

  // Dropzone drag-over state
  const [dragOver, setDragOver] = useState<boolean>(false);

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

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
            A
          </div> */}
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Email Mass Mailer
          </span>
        </div>

        <div className="flex items-center space-x-6">
          {user && (
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs text-slate-400 font-medium">Active SMTP Tunnel</span>
              <span className="text-sm text-indigo-400 font-semibold">{user.smtp_email}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Form: Create Campaign */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-900 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Compose Campaign
            </h2>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs break-words">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Subject Line</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="E.g. Exciting updates for Q3!"
                  className="w-full px-4 py-2.5 bg-slate-950/40 border border-slate-900 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Email Body (Text / HTML)</label>
                <textarea
                  required
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your email body copy here..."
                  className="w-full px-4 py-2.5 bg-slate-950/40 border border-slate-900 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-sm transition-all resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Recipients Selection</label>
                
                {/* Mode Toggles */}
                <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-950/60 p-1 rounded-lg border border-slate-900">
                  <button
                    type="button"
                    onClick={() => setRecipientMode('excel')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                      recipientMode === 'excel'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
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
                        : 'text-slate-400 hover:text-slate-200'
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
                        : 'border-slate-800 hover:border-slate-700 bg-slate-950/20'
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
                      <div className="space-y-1 text-emerald-400">
                        <svg className="w-8 h-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-semibold truncate max-w-xs mx-auto">{file.name}</p>
                        <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB - Click to replace</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 text-slate-400">
                        <svg className="w-8 h-8 mx-auto text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <p className="text-sm font-medium"><span className="text-indigo-400">Upload a file</span> or drag & drop</p>
                        <p className="text-xs text-slate-600">Supports .xlsx or .xls files containing email columns</p>
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
                      className="w-full px-4 py-2.5 bg-slate-950/40 border border-slate-900 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-sm transition-all resize-y"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={formLoading}
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
        </div>

        {/* Right Section: Campaign History */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-900 rounded-2xl p-6 shadow-xl flex-1 flex flex-col">
            <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
              </svg>
              Your Campaigns
            </h2>

            {loadingCampaigns ? (
              <div className="flex-1 py-20 flex flex-col items-center justify-center space-y-2 text-slate-500">
                <svg className="animate-spin h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs">Loading campaign list...</span>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="flex-1 py-20 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-6">
                <div className="w-12 h-12 bg-slate-950/80 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-300">No campaigns yet</h3>
                <p className="text-slate-500 text-xs mt-1 max-w-sm">Use the composer on the left to upload your Excel sheet and format your first bulk mailing campaign.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-medium">
                      <th className="pb-3 pr-2">Subject</th>
                      <th className="pb-3 px-2">Recipients</th>
                      <th className="pb-3 px-2">Status</th>
                      <th className="pb-3 px-2">Date Created</th>
                      <th className="pb-3 text-right pl-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60">
                    {campaigns.map((camp) => (
                      <tr key={camp.id} className="hover:bg-slate-900/20 transition-all">
                        <td className="py-4 pr-2 font-semibold text-slate-200 max-w-[160px] truncate">
                          {camp.subject}
                        </td>
                        <td className="py-4 px-2 text-slate-400 font-mono">
                          {camp.client_count}
                        </td>
                        <td className="py-4 px-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              camp.status === 'executed'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : camp.status === 'testing'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-800 text-slate-300 border border-slate-700/50'
                            }`}
                          >
                            {camp.status}
                          </span>
                        </td>
                        <td className="py-4 px-2 text-slate-500">
                          {new Date(camp.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: '2-digit',
                          })}
                        </td>
                        <td className="py-4 text-right pl-2">
                          <Link
                            href={`/dashboard/campaigns/${camp.id}`}
                            className="inline-flex items-center px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 text-xs font-semibold rounded-lg transition-all"
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
