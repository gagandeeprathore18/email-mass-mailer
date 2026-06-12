'use client';

import React, { useState, useEffect } from 'react';

interface SmtpAccount {
  id: number;
  label: string;
  host: string;
  port: number;
  username: string;
  from_email: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

export default function AdminSmtpPage() {
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSmtp, setSelectedSmtp] = useState<SmtpAccount | null>(null);

  // Form Fields
  const [label, setLabel] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function fetchSmtpAccounts() {
    try {
      const res = await fetch('/api/admin/smtp-servers');
      if (res.ok) {
        const data = await res.json();
        setSmtpAccounts(data.smtpAccounts || []);
      } else {
        throw new Error('Failed to fetch SMTP servers.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSmtpAccounts();
  }, []);

  const handleAddSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!label || !host || !port || !username || !password || !fromEmail) {
      setError('All fields are required.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/smtp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, host, port, username, password, fromEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create SMTP server.');
      }
      setSuccess('SMTP Account added successfully. Run connection check to verify.');
      setLabel('');
      setHost('');
      setPort('587');
      setUsername('');
      setPassword('');
      setFromEmail('');
      setShowAddModal(false);
      fetchSmtpAccounts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedSmtp) return;
    setActionLoading(true);
    try {
      const payload: any = { label, host, port, username, fromEmail };
      if (password) payload.password = password;

      const res = await fetch(`/api/admin/smtp-servers/${selectedSmtp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update SMTP.');
      }
      setSuccess('SMTP account updated successfully.');
      setShowEditModal(false);
      setSelectedSmtp(null);
      fetchSmtpAccounts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifySmtp = async (id: number) => {
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/smtp-servers/${id}/verify`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'SMTP Connection Verification Failed.');
      }
      setSuccess('SMTP Connection successfully verified!');
      if (data.warning) {
        alert('Warning: ' + data.warning);
      }
      fetchSmtpAccounts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (smtp: SmtpAccount) => {
    setError('');
    setSuccess('');
    const nextState = smtp.is_active ? 0 : 1;
    try {
      const res = await fetch(`/api/admin/smtp-servers/${smtp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextState }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update SMTP status.');
      }
      setSuccess(`SMTP ${nextState ? 'enabled' : 'paused'} successfully.`);
      fetchSmtpAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteSmtp = async (id: number) => {
    if (!window.confirm('Are you sure you want to permanently delete this SMTP server? All user assignments will be deleted.')) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/smtp-servers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete SMTP server.');
      }
      setSuccess('SMTP server deleted successfully.');
      fetchSmtpAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">SMTP Infrastructure</h1>
          <p className="text-slate-500 text-xs mt-1">Add, test, and manage system SMTP servers. Regular users use these servers via assignments.</p>
        </div>
        <button
          onClick={() => {
            setLabel('');
            setHost('');
            setPort('587');
            setUsername('');
            setPassword('');
            setFromEmail('');
            setError('');
            setSuccess('');
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 bg-[#5038ED] hover:bg-[#402bd6] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-2"
        >
          <span>Add SMTP Server</span>
        </button>
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

      {/* SMTP Accounts Registry */}
      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <svg className="animate-spin h-8 w-8 text-[#5038ED] mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs">Loading SMTP infrastructure...</span>
          </div>
        ) : smtpAccounts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs italic">
            No SMTP accounts configured. Add one to start.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/50">
                  <th className="py-4 px-6">Label</th>
                  <th className="py-4 px-6">Host & Port</th>
                  <th className="py-4 px-6">Username / From</th>
                  <th className="py-4 px-6">Verification</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {smtpAccounts.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-800">{s.label}</td>
                    <td className="py-4 px-6 text-slate-600 font-medium font-mono text-[11px]">{s.host}:{s.port}</td>
                    <td className="py-4 px-6">
                      <span className="block font-medium text-slate-700">{s.username}</span>
                      <span className="text-[10px] text-slate-400">{s.from_email}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                        s.is_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {s.is_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => handleToggleStatus(s)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer ${
                          s.is_active ? 'bg-indigo-50 text-[#5038ED] hover:bg-indigo-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {s.is_active ? 'Active' : 'Paused'}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2 whitespace-nowrap">
                      <button
                        disabled={actionLoading}
                        onClick={() => handleVerifySmtp(s.id)}
                        className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-[#5038ED] text-xs font-bold rounded-lg cursor-pointer transition-all disabled:opacity-50"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSmtp(s);
                          setLabel(s.label);
                          setHost(s.host);
                          setPort(s.port.toString());
                          setUsername(s.username);
                          setFromEmail(s.from_email);
                          setPassword('');
                          setError('');
                          setSuccess('');
                          setShowEditModal(true);
                        }}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSmtp(s.id)}
                        className="px-2.5 py-1.5 bg-rose-50 border border-rose-100 hover:bg-rose-100 hover:text-rose-800 text-rose-600 text-xs font-bold rounded-lg cursor-pointer transition-all"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add SMTP Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-base text-slate-800">Add SMTP Configuration</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddSmtp} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Label</label>
                  <input
                    type="text"
                    required
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Corp SMTP"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">From Email</label>
                  <input
                    type="email"
                    required
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="noreply@company.com"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Host</label>
                  <input
                    type="text"
                    required
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="smtp.company.com"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Port</label>
                  <input
                    type="text"
                    required
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="587"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="smtp_user"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#5038ED] hover:bg-[#402bd6] text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit SMTP Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-base text-slate-800">Edit SMTP Configuration</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleEditSmtp} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Label</label>
                  <input
                    type="text"
                    required
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Corp SMTP"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">From Email</label>
                  <input
                    type="email"
                    required
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="noreply@company.com"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Host</label>
                  <input
                    type="text"
                    required
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="smtp.company.com"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Port</label>
                  <input
                    type="text"
                    required
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="587"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="smtp_user"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password (Optional)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#5038ED] hover:bg-[#402bd6] text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
