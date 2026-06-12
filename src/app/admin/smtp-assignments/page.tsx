'use client';

import React, { useState, useEffect } from 'react';

interface Assignment {
  id: number;
  user_id: number;
  smtp_account_id: number;
  user_email: string;
  user_name: string | null;
  smtp_label: string;
  smtp_from: string;
}

interface UserSelect {
  id: number;
  email: string;
  name: string | null;
}

interface SmtpSelect {
  id: number;
  label: string;
  from_email: string;
}

export default function AdminSmtpAccessPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<UserSelect[]>([]);
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedSmtpId, setSelectedSmtpId] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  async function fetchAccessData() {
    try {
      const res = await fetch('/api/admin/smtp-assignments');
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
        setUsers(data.users || []);
        setSmtpAccounts(data.smtpAccounts || []);
      } else {
        throw new Error('Failed to fetch SMTP assignment data.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAccessData();
  }, []);

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedUserId || !selectedSmtpId) {
      setError('Both User and SMTP Account are required.');
      return;
    }
    try {
      const res = await fetch('/api/admin/smtp-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: parseInt(selectedUserId, 10),
          smtpAccountId: parseInt(selectedSmtpId, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create assignment.');
      }
      setSuccess('SMTP Account assigned successfully.');
      setSelectedUserId('');
      setSelectedSmtpId('');
      setShowAddModal(false);
      fetchAccessData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveAssignment = async (id: number, userEmail: string, smtpLabel: string) => {
    if (!window.confirm(`Are you sure you want to remove assignment of "${smtpLabel}" for "${userEmail}"?`)) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/smtp-assignments/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove assignment.');
      }
      setSuccess('SMTP Assignment removed successfully.');
      fetchAccessData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn font-sans">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">SMTP Assignments</h1>
          <p className="text-slate-500 text-xs mt-1">
            Assign SMTP infrastructure access to regular users. Users can only send campaigns via assigned SMTP accounts.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedUserId('');
            setSelectedSmtpId('');
            setError('');
            setSuccess('');
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 bg-[#5038ED] hover:bg-[#402bd6] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-2"
        >
          <span>Assign SMTP Account</span>
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

      {/* Assignments Table */}
      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <svg className="animate-spin h-8 w-8 text-[#5038ED] mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs">Loading SMTP assignments...</span>
          </div>
        ) : assignments.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs italic">
            No SMTP assignments found. Assign an SMTP account to a user to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/50">
                  <th className="py-4 px-6">User Name</th>
                  <th className="py-4 px-6">User Email</th>
                  <th className="py-4 px-6">SMTP Label</th>
                  <th className="py-4 px-6">SMTP From Email</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-800">
                      {a.user_name || <span className="text-slate-300 italic">No Name</span>}
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium">{a.user_email}</td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-indigo-50 text-[#5038ED]">
                        {a.smtp_label}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500 font-mono">{a.smtp_from}</td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleRemoveAssignment(a.id, a.user_email, a.smtp_label)}
                        className="px-2.5 py-1.5 bg-rose-50 border border-rose-100 hover:bg-rose-100 hover:text-rose-800 text-rose-600 text-xs font-bold rounded-lg cursor-pointer transition-all"
                      >
                        Remove Access
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Assignment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-base text-slate-800">Assign SMTP Access</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAddAssignment} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Select User
                </label>
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                >
                  <option value="">-- Choose User --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ? `${u.name} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Select SMTP Account
                </label>
                <select
                  required
                  value={selectedSmtpId}
                  onChange={(e) => setSelectedSmtpId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED]"
                >
                  <option value="">-- Choose SMTP Server --</option>
                  {smtpAccounts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({s.from_email})
                    </option>
                  ))}
                </select>
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
                  className="px-4 py-2 bg-[#5038ED] hover:bg-[#402bd6] text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Create Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
