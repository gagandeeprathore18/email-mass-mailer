'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Campaign {
  id: number;
  subject: string;
  body: string;
  status: 'draft' | 'testing' | 'queued' | 'processing' | 'completed' | 'failed' | 'paused';
  created_at: string;
  smtp_account_id?: number | null;
  smtp_label?: string | null;
  smtp_from_email?: string | null;
}

interface Client {
  id: number;
  email: string;
  status: 'pending' | 'sent' | 'failed';
  opened_at?: string | null;
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
  const [openedCount, setOpenedCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Editing Campaign States
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedSubject, setEditedSubject] = useState<string>('');
  const [editedBody, setEditedBody] = useState<string>('');

  // Execution States
  const [testingLoading, setTestingLoading] = useState<boolean>(false);
  const [executingLoading, setExecutingLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

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
        setEditedSubject(data.campaign.subject || '');
        setEditedBody(data.campaign.body || '');
        setClients(data.clients || []);
        setOpenedCount(data.openedCount || 0);
        
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

        if (data.campaign.status === 'completed' || data.campaign.status === 'failed') {
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

  // Set up polling when campaign is executing
  useEffect(() => {
    if (isNaN(campaignId)) return;

    let intervalId: NodeJS.Timeout | null = null;
    
    const shouldPoll = campaign && (campaign.status === 'queued' || campaign.status === 'processing') && counts.pending > 0;
    
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

  const handleSaveCampaign = async () => {
    if (!editedSubject.trim()) {
      setActionMessage({ type: 'error', text: 'Subject cannot be empty.' });
      return;
    }
    if (!editedBody.trim()) {
      setActionMessage({ type: 'error', text: 'Email body cannot be empty.' });
      return;
    }
    
    setTestingLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: editedSubject, body: editedBody }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Campaign details updated successfully! Status reset to Draft.' });
        setIsEditing(false);
        fetchCampaignData(false);
      } else {
        throw new Error(data.error || 'Failed to update campaign details.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setTestingLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (clients.length === 0) return;
    
    const exportData = clients.map(client => {
      let statusLabel = 'PENDING';
      if (client.status === 'sent') {
        statusLabel = 'SENT';
      } else if (client.status === 'failed') {
        statusLabel = 'FAILED';
      }
      return {
        'Recipient Email': client.email,
        'Timestamp': new Date(client.created_at).toISOString().replace('T', ' ').slice(0, 19),
        'Tunnel ID': campaign?.smtp_label ? `TN-${campaign.smtp_account_id}-X` : 'TN-DEFAULT-X',
        'Status': statusLabel,
        'Opened At': client.opened_at ? new Date(client.opened_at).toISOString().replace('T', ' ').slice(0, 19) : 'N/A'
      };
    });

    import('xlsx').then((XLSX) => {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Recipients");
      XLSX.writeFile(workbook, `campaign_${campaignId}_recipients.xlsx`);
    });
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    if (clients.length === 0) return;

    Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]).then(([jspdfModule, autoTableModule]) => {
      const jsPDF = jspdfModule.jsPDF;
      const autoTable = autoTableModule.default;
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text("Recipients Status Log", 14, 15);
      doc.setFontSize(10);
      doc.text(`Campaign: ${campaign?.subject || 'N/A'} (ID: ${campaignId})`, 14, 22);
      doc.text(`Date: ${new Date().toLocaleString()}`, 14, 27);

      const tableColumn = ["Recipient Email", "Timestamp", "Tunnel ID", "Status", "Opened At"];
      const tableRows = clients.map(client => {
        let statusLabel = 'PENDING';
        if (client.status === 'sent') {
          statusLabel = 'SENT';
        } else if (client.status === 'failed') {
          statusLabel = 'FAILED';
        }
        return [
          client.email,
          new Date(client.created_at).toISOString().replace('T', ' ').slice(0, 19),
          campaign?.smtp_label ? `TN-${campaign.smtp_account_id}-X` : 'TN-DEFAULT-X',
          statusLabel,
          client.opened_at ? new Date(client.opened_at).toISOString().replace('T', ' ').slice(0, 19) : 'N/A'
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 32,
        theme: 'striped',
        headStyles: { fillColor: [80, 56, 237] },
        styles: { fontSize: 8 }
      });

      doc.save(`campaign_${campaignId}_recipients.pdf`);
    });
    setShowExportMenu(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7fb] text-slate-500 font-sans">
        <div className="flex flex-col items-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-[#5038ED]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-semibold">Retrieving campaign status...</span>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7fb] text-slate-500 font-sans px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center shadow-xl">
          <svg className="w-12 h-12 text-rose-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Error Occurred</h3>
          <p className="text-slate-500 text-sm mb-6">{error || 'Unable to fetch campaign.'}</p>
          <Link href="/dashboard" className="px-5 py-2 bg-[#5038ED] hover:bg-[#402bd6] text-white rounded-lg text-sm font-semibold transition-colors">
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
              Control Center
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
        
        {/* Breadcrumb & Title Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400">
              <Link href="/dashboard" className="hover:text-slate-600">Campaigns</Link>
              <span>&gt;</span>
              <span className="text-[#5038ED] font-bold">{campaign.subject}</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1.5">{campaign.subject}</h1>
          </div>

          <div className="flex items-center space-x-3">
            {/* Pause / Run Action Buttons */}
            {(campaign.status === 'processing' || campaign.status === 'queued') && counts.pending > 0 && (
              <button
                onClick={handleSendToAll}
                disabled={executingLoading || testingLoading}
                className="inline-flex items-center px-4.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer space-x-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Pause Execution</span>
              </button>
            )}

            {(campaign.status !== 'queued' && campaign.status !== 'processing' && campaign.status !== 'completed') && !isEditing && (
              <button
                onClick={() => {
                  setEditedSubject(campaign.subject || '');
                  setEditedBody(campaign.body || '');
                  setIsEditing(true);
                }}
                disabled={executingLoading || testingLoading}
                className="inline-flex items-center px-4.5 py-2 bg-[#5038ED] hover:bg-[#402bd6] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>Edit Campaign</span>
              </button>
            )}
          </div>
        </div>

        {/* Alerts Section */}
        {actionMessage && (
          <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
            actionMessage.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
              : 'bg-rose-50 border-rose-100 text-rose-700'
          }`}>
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {actionMessage.type === 'success' ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              )}
            </svg>
            <span className="text-xs font-semibold">{actionMessage.text}</span>
          </div>
        )}

        {/* Top Two Column Layout: Visual Anchor & Execution Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Column 1: Visual Anchor (Live Preview Mockup) */}
          <div className="lg:col-span-5 bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Visual Anchor</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#EEECFC] text-[#5038ED]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5038ED] mr-1" />
                Live Preview
              </span>
            </div>

            {/* Email Preview Card Body */}
            <div className="p-6 flex-1 flex flex-col justify-center bg-slate-50">
              {isEditing ? (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Editing Email Campaign</span>
                  
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Subject Line</label>
                    <input
                      type="text"
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] font-sans font-bold transition-all"
                      placeholder="Enter subject line..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Email Message Body</label>
                    <textarea
                      rows={8}
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] font-mono resize-y transition-all"
                      placeholder="Enter email body (supports HTML)..."
                    />
                  </div>

                  <div className="flex space-x-2 justify-end">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCampaign}
                      className="px-3 py-1.5 bg-[#5038ED] hover:bg-[#402bd6] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden text-xs max-w-sm mx-auto w-full">
                  {/* Mock Browser Header */}
                  <div className="bg-slate-50 border-b border-slate-150 px-4 py-2.5 flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                    <div className="bg-white border border-slate-200/60 rounded px-2 py-0.5 text-[9px] text-slate-400 truncate w-full max-w-[200px]">
                      {campaign.subject}
                    </div>
                  </div>
                  {/* Email content */}
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-slate-400 text-[10px]">Subject: <span className="text-slate-800 font-bold">{campaign.subject}</span></p>
                      <p className="text-slate-400 text-[10px] mt-0.5">Sender: <span className="text-[#5038ED] font-semibold">{campaign.smtp_from_email || 'Default Tunnel'}</span></p>
                    </div>
                    <div className="border-t border-slate-100 pt-3 text-slate-600 font-sans leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto pr-1">
                      {campaign.body}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Execution Controls */}
          <div className="lg:col-span-7 bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-bold text-slate-900">Execution Controls</h2>
            </div>

            <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
              
              {/* Progress indicator */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sending Progress</span>
                    <span className="text-3xl font-extrabold text-slate-900 mt-1">{progressPercent}%</span>
                  </div>
                  {campaign.status === 'processing' ? (
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">ETA: 14m 22s</span>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {campaign.status === 'completed' && 'Completed'}
                      {campaign.status === 'queued' && 'Queued'}
                      {campaign.status === 'failed' && 'Failed'}
                      {campaign.status === 'paused' && 'Paused'}
                      {campaign.status === 'draft' && 'Ready'}
                    </span>
                  )}
                </div>
 
                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200/60 mt-3">
                  <div 
                    className="bg-[#5038ED] h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
 
              {/* Stats Cards grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Sent</span>
                  <span className="text-xl font-extrabold text-[#5038ED] font-mono mt-1 block">{counts.sent.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Opened</span>
                  <span className="text-xl font-extrabold text-emerald-600 font-mono mt-1 block">{openedCount.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Open Rate</span>
                  <span className="text-xl font-extrabold text-indigo-600 font-mono mt-1 block">
                    {counts.sent > 0 ? ((openedCount / counts.sent) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Failed</span>
                  <span className="text-xl font-extrabold text-rose-600 font-mono mt-1 block">{counts.failed.toLocaleString()}</span>
                </div>
              </div>
 
              {/* CSS mini bar chart for distribution rate */}
              <div className="flex items-end justify-between h-12 pt-2 px-6 border-t border-slate-100">
                <div className="w-[6%] bg-slate-100 h-2 rounded-t-sm" />
                <div className="w-[6%] bg-[#C1BAFC] h-6 rounded-t-sm" />
                <div className="w-[6%] bg-[#C1BAFC] h-4 rounded-t-sm" />
                <div className="w-[6%] bg-[#C1BAFC] h-8 rounded-t-sm" />
                <div className="w-[6%] bg-[#C1BAFC] h-10 rounded-t-sm" />
                <div className="w-[6%] bg-[#5038ED] h-12 rounded-t-sm" />
                <div className="w-[6%] bg-[#C1BAFC] h-6 rounded-t-sm" />
                <div className="w-[6%] bg-slate-100 h-3 rounded-t-sm" />
                <div className="w-[6%] bg-slate-100 h-1 rounded-t-sm" />
              </div>
            </div>
 
            {/* Run controls action footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                onClick={handleRunTest}
                disabled={testingLoading || executingLoading || campaign.status === 'completed' || campaign.status === 'queued' || campaign.status === 'processing'}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-40"
              >
                {testingLoading ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Running Test...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>Run Test Send</span>
                  </>
                )}
              </button>
 
              <button
                onClick={handleSendToAll}
                disabled={
                  testingLoading || 
                  executingLoading || 
                  campaign.status === 'draft' || 
                  campaign.status === 'completed' ||
                  campaign.status === 'queued' ||
                  campaign.status === 'processing' ||
                  counts.pending === 0
                }
                className="px-5 py-2 bg-[#5038ED] hover:bg-[#402bd6] text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-40"
              >
                {executingLoading || campaign.status === 'queued' || campaign.status === 'processing' ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{campaign.status === 'queued' ? 'Queued...' : 'Mailing...'}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>Execute Bulk Send ({counts.pending})</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Recipients Status Logs Section */}
        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex items-center space-x-3">
              <h2 className="text-base font-bold text-slate-900">Recipients Status Logs</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-[#EEECFC] text-[#5038ED]">
                AUTO-REFRESH: ON
              </span>
            </div>

            <div className="flex items-center space-x-3">
              {/* Search filter input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by email or status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] transition-all w-60"
                />
                <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Download export log */}
              <div className="relative">
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="p-1.5 border border-slate-200 hover:bg-slate-50 bg-white rounded-lg text-slate-500 cursor-pointer flex items-center justify-center"
                  title="Export Logs"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50">
                    <button
                      onClick={handleExportExcel}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold flex items-center space-x-2 cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Download Excel (.xlsx)</span>
                    </button>
                    <button
                      onClick={handleExportPdf}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold flex items-center space-x-2 cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span>Download PDF (.pdf)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/20">
                  <th className="py-3.5 px-6">Recipient Email</th>
                  <th className="py-3.5 px-6">Timestamp</th>
                  <th className="py-3.5 px-6">Tunnel ID</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Open Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[12px] text-slate-600">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-sans text-xs italic">
                      No matching recipients found.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => {
                    let statusLabel = 'PENDING';
                    let pillColors = 'bg-slate-100 text-slate-600';

                    if (client.status === 'sent') {
                      statusLabel = 'Sent ✓';
                      pillColors = 'bg-[#DCFCE7] text-[#15803D]';
                    } else if (client.status === 'failed') {
                      statusLabel = 'Failed ✗';
                      pillColors = 'bg-[#FEE2E2] text-[#B91C1C]';
                    } else if (client.status === 'pending' && executingLoading) {
                      statusLabel = 'PROCESSING';
                      pillColors = 'bg-[#F3E8FF] text-[#6B21A8]';
                    }

                    // Format timestamp
                    const timestampStr = new Date(client.created_at).toISOString().replace('T', ' ').slice(0, 19);

                    // Open tracking representation
                    let openTrackingLabel = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-400">
                        Opened ✗
                      </span>
                    );
                    
                    if (client.opened_at) {
                      const openedDateStr = new Date(client.opened_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      }).replace(',', '');
                      
                      openTrackingLabel = (
                        <div className="flex flex-col items-end">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#DCFCE7] text-[#15803D]">
                            Opened ✓
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 font-mono">Opened At: {openedDateStr}</span>
                        </div>
                      );
                    }

                    return (
                      <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 font-sans font-medium text-slate-800">{client.email}</td>
                        <td className="py-4 px-6 text-slate-400">{timestampStr}</td>
                        <td className="py-4 px-6 text-slate-500">
                          {campaign.smtp_label ? `TN-${campaign.smtp_account_id}-X` : 'TN-DEFAULT-X'}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${pillColors}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">{openTrackingLabel}</td>
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
      <footer className="border-t border-slate-200/60 bg-white py-6 px-8 mt-12 text-xs text-slate-400 flex flex-col md:flex-row items-center justify-between">
        <span>&copy; 2026 Queuvo.</span>
        {/* <div className="flex items-center space-x-6 mt-4 md:mt-0 font-medium">
          <a href="#" className="hover:text-slate-600">Privacy Policy</a>
          <a href="#" className="hover:text-slate-600">Terms of Service</a>
          <a href="#" className="hover:text-slate-600">API Docs</a>
          <a href="#" className="hover:text-slate-600">Support</a>
        </div> */}
      </footer>
    </div>
  );
}
