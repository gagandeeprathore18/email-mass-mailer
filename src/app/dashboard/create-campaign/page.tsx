'use client';

import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SmtpAccount {
  id: number;
  label: string;
  from_email: string;
  is_verified: boolean;
  is_active: boolean;
}

export default function CreateCampaignPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data states
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [selectedSmtpId, setSelectedSmtpId] = useState<string>('');
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [loadingSmtp, setLoadingSmtp] = useState<boolean>(true);

  // Campaign Form states
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

  // Fetch SMTP accounts
  async function fetchSmtpAccounts() {
    try {
      const res = await fetch('/api/smtp');
      if (res.ok) {
        const data = await res.json();
        const accounts: SmtpAccount[] = data.smtpAccounts || [];
        
        // Filter active & verified
        const activeVerified = accounts.filter(acc => {
          const verified = acc.is_verified === true || Number(acc.is_verified) === 1;
          const active = acc.is_active === true || Number(acc.is_active) === 1;
          return verified && active;
        });
        
        setSmtpAccounts(activeVerified);
        if (activeVerified.length > 0) {
          setSelectedSmtpId(activeVerified[0].id.toString());
        } else {
          setSelectedSmtpId('');
        }
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

  // Submit Create Campaign
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

      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
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
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7fb] text-slate-500 font-sans">
        <div className="flex flex-col items-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-[#5038ED]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-semibold">Loading composer...</span>
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
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 leading-none">
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
              Compose Campaign
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
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Mailing Campaign</h1>
          <p className="text-slate-500 text-sm mt-1.5">Create your campaign content, select your verified SMTP server, and upload your clients list.</p>
        </div>

        {/* Form Container */}
        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6">
            {formError && (
              <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs break-words">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="space-y-6">
              
              {/* Divided into two columns */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Column: Composition */}
                <div className="lg:col-span-7 space-y-5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Sending Account</label>
                    {loadingSmtp ? (
                      <div className="h-10 bg-slate-50 border border-slate-200 rounded-lg animate-pulse flex items-center px-3 text-xs text-slate-400">
                        Loading tunnels...
                      </div>
                    ) : smtpAccounts.length === 0 ? (
                      <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center justify-between">
                        <span>No active & verified SMTP tunnels found.</span>
                        <Link href="/dashboard/smtp-tunnels" className="text-[#5038ED] hover:underline font-bold">
                          Add SMTP Tunnel
                        </Link>
                      </div>
                    ) : (
                      <select
                        value={selectedSmtpId}
                        onChange={(e) => setSelectedSmtpId(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] text-sm transition-all"
                      >
                        {smtpAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.label} ({acc.from_email})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Subject Line</label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="E.g., Quarterly Infrastructure Alert"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] text-sm transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Body (Text / HTML)</label>
                    <textarea
                      required
                      rows={12}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write your email body copy here..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] text-sm transition-all resize-y"
                    />
                  </div>
                </div>

                {/* Right Column: Recipients Selection */}
                <div className="lg:col-span-5 space-y-5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recipients Selection</label>
                    
                    {/* Mode Toggles */}
                    <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setRecipientMode('excel')}
                        className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          recipientMode === 'excel'
                            ? 'bg-[#5038ED] text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Excel Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecipientMode('manual')}
                        className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          recipientMode === 'manual'
                            ? 'bg-[#5038ED] text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Enter the Email Addresses here
                      </button>
                    </div>

                    {recipientMode === 'excel' ? (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all min-h-[300px] flex flex-col items-center justify-center ${
                          dragOver
                            ? 'border-[#5038ED] bg-[#5038ED]/5'
                            : file
                            ? 'border-emerald-500/50 bg-emerald-50/10'
                            : 'border-slate-300 hover:border-slate-400 bg-slate-50'
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
                          <div className="space-y-2 text-emerald-600">
                            <svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm font-semibold truncate max-w-xs mx-auto">{file.name}</p>
                            <p className="text-[11px] text-slate-400">{(file.size / 1024).toFixed(1)} KB - Click to replace</p>
                          </div>
                        ) : (
                          <div className="space-y-3 text-slate-400">
                            <svg className="w-10 h-10 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <p className="text-xs font-semibold">
                              <span className="text-[#5038ED] hover:underline font-bold">Upload a file</span> or drag & drop
                            </p>
                            <p className="text-[10px]">Supports .xlsx or .xls files containing email columns</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <textarea
                          rows={12}
                          value={manualEmails}
                          onChange={(e) => setManualEmails(e.target.value)}
                          placeholder="Type or paste emails here (separated by commas, spaces, or new lines)&#10;E.g., user1@example.com, user2@example.com"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] text-xs transition-all resize-y"
                        />
                      </div>
                    )}
                  </div>
                </div>

              </div>

              <div className="pt-4 flex space-x-3 border-t border-slate-100 justify-end">
                <Link
                  href="/dashboard"
                  className="px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={formLoading || smtpAccounts.length === 0}
                  className="px-6 py-2.5 bg-[#5038ED] hover:bg-[#402bd6] text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                >
                  {formLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating Campaign...
                    </>
                  ) : (
                    'Create Campaign'
                  )}
                </button>
              </div>
            </form>
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
