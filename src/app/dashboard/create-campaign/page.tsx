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
  const [dragOverAttachments, setDragOverAttachments] = useState<boolean>(false);

  // Attachments state
  const [attachments, setAttachments] = useState<File[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Scheduling states
  const [sendOption, setSendOption] = useState<'immediate' | 'later'>('immediate');
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('');
  const [userTimezone, setUserTimezone] = useState<string>('');



  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [showSchedulePopover, setShowSchedulePopover] = useState<boolean>(false);

  useEffect(() => {
    try {
      setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    } catch {
      setUserTimezone('UTC');
    }
  }, []);


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

  // Attachment Drag and Drop handlers
  const handleAttachmentDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverAttachments(true);
  };

  const handleAttachmentDragLeave = () => {
    setDragOverAttachments(false);
  };

  const handleAttachmentDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverAttachments(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addAttachments(Array.from(e.dataTransfer.files));
    }
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addAttachments(Array.from(e.target.files));
    }
  };

  const addAttachments = (files: File[]) => {
    setFormError('');
    const newAttachments = [...attachments];
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];

    for (const f of files) {
      // Allow case insensitive checking or common mime types
      const fileType = f.type || '';
      const isAllowed = allowedTypes.includes(fileType) || 
                        f.name.endsWith('.pdf') || 
                        f.name.endsWith('.doc') || 
                        f.name.endsWith('.docx') || 
                        f.name.endsWith('.jpg') || 
                        f.name.endsWith('.jpeg') || 
                        f.name.endsWith('.png');

      if (!isAllowed) {
        setFormError(`Invalid attachment type: ${f.name}. Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG.`);
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        setFormError(`File ${f.name} exceeds the 10 MB limit.`);
        return;
      }
      newAttachments.push(f);
    }

    if (newAttachments.length > 5) {
      setFormError('Maximum 5 attachments allowed per campaign.');
      return;
    }

    const totalSize = newAttachments.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > 25 * 1024 * 1024) {
      setFormError('Total size of attachments cannot exceed 25 MB.');
      return;
    }

    setAttachments(newAttachments);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
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

    if (!file && !manualEmails.trim()) {
      setFormError('Please upload an Excel list file or enter manually typed emails.');
      return;
    }

    let scheduledAtISO = 'null';
    if (sendOption === 'later') {
      if (!scheduleDate || !scheduleTime) {
        setFormError('Please select both a scheduled date and time.');
        return;
      }
      const localDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
      if (isNaN(localDateTime.getTime())) {
        setFormError('Invalid scheduled date and time.');
        return;
      }
      if (localDateTime.getTime() < Date.now() - 5000) {
        setFormError('Cannot schedule campaigns in the past.');
        return;
      }
      scheduledAtISO = localDateTime.toISOString();
    }

    setFormLoading(true);
    setFormError('');
    setFormSuccess('');

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('body', body);
    formData.append('smtpAccountId', selectedSmtpId);
    formData.append('scheduledAt', scheduledAtISO);
    
    // Explicitly check selected mode or just what is present
    if (file) {
      formData.append('file', file);
    } else if (manualEmails.trim()) {
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

      const campaignId = data.campaignId;

      // Upload files sequentially
      for (const att of attachments) {
        const attData = new FormData();
        attData.append('campaignId', campaignId.toString());
        attData.append('file', att);

        const uploadRes = await fetch('/api/campaigns/upload', {
          method: 'POST',
          body: attData,
        });

        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json();
          throw new Error(uploadData.error || 'Failed to upload attachment.');
        }
      }

      setFormSuccess(`Campaign successfully created with ${data.clientCount} recipients!`);
      setSubject('');
      setBody('');
      setFile(null);
      setAttachments([]);
      setSendOption('immediate');
      setScheduleDate('');
      setScheduleTime('');
      setManualEmails('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';

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

  const manualRecipientsCount = manualEmails.split(/[\n,;\s]+/).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())).length;

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

      {/* Hidden file input for Excel uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
      />

      {/* Hidden file input for Attachments */}
      <input
        type="file"
        ref={attachmentInputRef}
        onChange={handleAttachmentChange}
        multiple
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
        className="hidden"
      />

      {/* Manual Emails Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Enter Recipient Emails</h3>
              <button 
                type="button" 
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Paste or type your email list. Separate each email with commas, spaces, or new lines.</p>
            <textarea
              rows={8}
              value={manualEmails}
              onChange={(e) => setManualEmails(e.target.value)}
              placeholder="E.g., client1@domain.com, client2@domain.com"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] font-mono"
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                type="button"
                onClick={() => { setShowManualModal(false); setManualEmails(''); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50"
              >
                Clear & Close
              </button>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 bg-[#5038ED] hover:bg-[#402bd6] text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-8">
        
        {/* Title */}
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Mailing Campaign</h1>
          <p className="text-slate-500 text-sm mt-1.5">Compose your campaign content, select your verified SMTP server, and upload your clients list.</p>
        </div>

        {/* Form Container Card */}
        <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200/60 grid grid-cols-1 md:grid-cols-4 min-h-[660px] overflow-hidden">
          
          {/* Left Side: Protocol and Execution */}
          <div className="bg-[#fafafc] border-r border-slate-200/60 p-6 flex flex-col justify-between">
            <div className="space-y-6">
              
              {/* Protocol Account Pickers */}
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Protocol</span>
                {loadingSmtp ? (
                  <div className="space-y-2">
                    <div className="h-12 bg-white/50 border border-slate-200 rounded-xl animate-pulse" />
                    <div className="h-12 bg-white/50 border border-slate-200 rounded-xl animate-pulse" />
                  </div>
                ) : smtpAccounts.length === 0 ? (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl space-y-2">
                    <p>No active SMTP accounts.</p>
                    <Link href="/dashboard/smtp-tunnels" className="text-[#5038ED] hover:underline font-bold block text-[10px] uppercase tracking-wider">
                      + Add SMTP Tunnel
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {smtpAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedSmtpId(acc.id.toString())}
                        className={`w-full flex items-center space-x-3 p-3 rounded-xl border text-left transition-all ${
                          selectedSmtpId === acc.id.toString()
                            ? 'bg-white border-[#5038ED] shadow-sm text-slate-900 font-semibold ring-2 ring-[#5038ED]/10'
                            : 'bg-white/40 border-slate-200/60 text-slate-500 hover:bg-white/80 hover:text-slate-700'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg ${selectedSmtpId === acc.id.toString() ? 'bg-indigo-50 text-[#5038ED]' : 'bg-slate-100 text-slate-400'}`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <div className="truncate">
                          <p className="text-xs truncate font-bold">{acc.label}</p>
                          <p className="text-[9px] text-slate-400 truncate">{acc.from_email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Execution / Schedule Summary */}
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Execution</span>
                <div className="bg-white/60 border border-slate-200/60 p-3.5 rounded-xl text-xs space-y-1.5 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${sendOption === 'immediate' ? 'bg-emerald-500' : 'bg-indigo-500 animate-pulse'}`} />
                    <p className="font-bold text-slate-700">
                      {sendOption === 'immediate' ? 'Direct Send' : 'Scheduled Delivery'}
                    </p>
                  </div>
                  {sendOption === 'later' && scheduleDate && scheduleTime ? (
                    <p className="text-[10px] text-[#5038ED] font-semibold">
                      {scheduleDate} at {scheduleTime}
                    </p>
                  ) : (
                    <p className="text-[9px] text-slate-400">Campaign will start immediately upon submission.</p>
                  )}
                </div>
              </div>

            </div>



          </div>

          {/* Right Side: Email Composer */}
          <div className="md:col-span-3 p-8 flex flex-col justify-between relative bg-white">
            
            <form onSubmit={handleCreateCampaign} className="flex flex-col flex-1 justify-between">
              <div className="space-y-2">
                
                {/* Form Header */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="font-extrabold text-2xl text-slate-900 tracking-tight">
                      New Campaign
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      Draft ready to dispatch • Auto-saved local state
                    </p>
                  </div>
                  <Link 
                    href="/dashboard" 
                    className="text-slate-300 hover:text-slate-600 transition-colors p-1"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Link>
                </div>

                {/* Status Banner */}
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl break-all animate-fadeIn">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl animate-fadeIn">
                    {formSuccess}
                  </div>
                )}

                {/* Recipients Row */}
                <div className="flex items-center py-3 border-b border-slate-100 min-h-[52px]">
                  <span className="text-slate-400 text-xs font-bold w-24 shrink-0">Recipients</span>
                  <div className="flex-1 flex flex-wrap items-center gap-2 text-xs">
                    {file && (
                      <div className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-50 border border-indigo-100 text-[#5038ED] text-xs font-bold rounded-full shadow-sm animate-fadeIn">
                        <svg className="w-3.5 h-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate max-w-xs">{file.name}</span>
                        <button type="button" onClick={() => setFile(null)} className="hover:text-rose-600 font-bold ml-1 text-[13px] leading-none">&times;</button>
                      </div>
                    )}

                    {manualRecipientsCount > 0 && (
                      <div className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-50 border border-indigo-100 text-[#5038ED] text-xs font-bold rounded-full shadow-sm animate-fadeIn">
                        <span>{manualRecipientsCount} Recipients</span>
                        <button type="button" onClick={() => setManualEmails('')} className="hover:text-rose-600 font-bold ml-1 text-[13px] leading-none">&times;</button>
                      </div>
                    )}

                    {!file && manualRecipientsCount === 0 && (
                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[#5038ED] hover:text-[#402bd6] font-bold"
                        >
                          + Upload Excel List
                        </button>
                        <span className="text-slate-200">|</span>
                        <button
                          type="button"
                          onClick={() => setShowManualModal(true)}
                          className="text-[#5038ED] hover:text-[#402bd6] font-bold"
                        >
                          + Enter Manually
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Subject Row */}
                <div className="flex items-center py-3 border-b border-slate-100">
                  <span className="text-slate-400 text-xs font-bold w-24 shrink-0">Subject</span>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Campaign Objective / Subject Line"
                    className="flex-1 border-none focus:ring-0 p-0 text-slate-800 placeholder-slate-400 text-sm font-semibold focus:outline-none"
                  />
                </div>

                {/* Body Area */}
                <textarea
                  required
                  rows={10}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your narrative here..."
                  className="w-full border-none focus:ring-0 p-0 pt-4 text-slate-700 placeholder-slate-400 text-sm resize-none focus:outline-none min-h-[260px]"
                />

              </div>

              {/* Campaign Attachments List */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 py-3 border-t border-slate-100 mt-4">
                  {attachments.map((f, idx) => (
                    <div key={idx} className="flex items-center space-x-1.5 px-3 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-full text-xs">
                      <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className="truncate max-w-[150px]">{f.name}</span>
                      <button type="button" onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-rose-600 font-bold ml-1">&times;</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer Actions / Scheduling Popover */}
              <div className="border-t border-slate-100 pt-4 flex justify-between items-center relative mt-4">
                
                {/* Scheduling popover overlay */}
                {showSchedulePopover && (
                  <div className="absolute bottom-16 left-0 md:right-0 md:left-auto z-40 bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 w-80 space-y-4 animate-slideUp">
                    <div className="flex justify-between items-center">
                      <span className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Schedule Configuration</span>
                      <button 
                        type="button" 
                        onClick={() => setShowSchedulePopover(false)} 
                        className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold text-slate-700">
                        <input
                          type="radio"
                          name="sendOption"
                          value="immediate"
                          checked={sendOption === 'immediate'}
                          onChange={() => setSendOption('immediate')}
                          className="w-4 h-4 text-[#5038ED] border-slate-300 focus:ring-[#5038ED]"
                        />
                        <span>Send Immediately</span>
                      </label>
                      <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold text-slate-700">
                        <input
                          type="radio"
                          name="sendOption"
                          value="later"
                          checked={sendOption === 'later'}
                          onChange={() => setSendOption('later')}
                          className="w-4 h-4 text-[#5038ED] border-slate-300 focus:ring-[#5038ED]"
                        />
                        <span>Schedule For Later</span>
                      </label>
                    </div>
                    {sendOption === 'later' && (
                      <div className="space-y-3 pt-3 border-t border-slate-100 animate-fadeIn">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
                          <input
                            type="date"
                            required
                            min={new Date().toISOString().split('T')[0]}
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Time</label>
                          <input
                            type="time"
                            required
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">
                          Timezone: {userTimezone}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setShowSchedulePopover(false)}
                        className="px-3 py-1.5 bg-[#5038ED] text-white text-xs font-bold rounded-lg hover:bg-[#402bd6]"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                )}

                {/* Manage Media Button in Toolbar */}
                <div>
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-600 hover:bg-[#fafafc] transition-all cursor-pointer shadow-sm"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span>Manage Media</span>
                    {attachments.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-indigo-50 text-[#5038ED] font-bold text-[10px] rounded-md border border-indigo-100">
                        {attachments.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Main Submit/Schedule buttons */}
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowSchedulePopover(!showSchedulePopover)}
                    className={`px-5 py-2 border rounded-full text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                      sendOption === 'later'
                        ? 'bg-indigo-50 border-[#d3cbff] text-[#5038ED] font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {sendOption === 'later' && scheduleDate && scheduleTime
                      ? `Scheduled: ${scheduleDate} ${scheduleTime}`
                      : 'Schedule'}
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading || smtpAccounts.length === 0}
                    className="px-6 py-2.5 bg-[#5038ED] hover:bg-[#402bd6] text-white text-xs font-bold rounded-full shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer space-x-1.5"
                  >
                    {formLoading ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Initializing...</span>
                      </>
                    ) : (
                      <>
                        <span>Initialize Campaign</span>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9.813 15.904L9 21L14.907 15.904L21 21V3L3 12.06L9.813 15.904Z" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>

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
