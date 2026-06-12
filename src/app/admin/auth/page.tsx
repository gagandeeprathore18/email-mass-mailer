'use client';

import React, { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminAuthPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // Form fields state
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [smtpHost, setSmtpHost] = useState<string>('');
  const [smtpPort, setSmtpPort] = useState<string>('587');
  const [smtpEmail, setSmtpEmail] = useState<string>('');
  const [smtpPass, setSmtpPass] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'signup' || params.get('signup') === 'true') {
        setIsSignUp(true);
      } else if (params.get('mode') === 'login') {
        setIsSignUp(false);
      }
    }
  }, []);

  const handleToggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
    const payload = isSignUp
      ? { email, password, smtp_host: smtpHost, smtp_email: smtpEmail, smtp_pass: smtpPass, smtp_port: smtpPort }
      : { email, password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong. Please check your credentials.');
      }

      // Admin page redirects directly to /admin
      router.push('/admin');
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg bg-white border border-slate-200/60 shadow-xl rounded-2xl p-8 md:p-10 transition-all duration-300">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#5038ED] mb-2 leading-none">
          Queuvo
        </h1>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
          Admin Portal
        </span>
        <p className="text-slate-500 text-sm mt-3 leading-relaxed">
          {isSignUp 
            ? 'Create an Administrator account to manage SMTP infrastructure, users, and campaigns.' 
            : 'Sign in to access your admin control center.'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-start space-x-2.5">
          <svg className="w-4.5 h-4.5 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="break-words font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* General Auth Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Admin Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] transition-all text-sm"
              placeholder="admin@company.com"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#5038ED] focus:ring-1 focus:ring-[#5038ED] transition-all text-sm"
              placeholder="••••••••"
            />
          </div>
        </div>

        {/* SMTP Configuration Section (Only for SignUp) */}
        {isSignUp && (
          <div className="pt-5 border-t border-slate-100 space-y-4 transition-all duration-300">
            <h3 className="text-sm font-bold text-[#5038ED] tracking-wide">System Default SMTP Settings</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">SMTP Host</label>
                <input
                  type="text"
                  required={isSignUp}
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#5038ED] text-xs"
                  placeholder="smtp.mailtrap.io"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Port</label>
                <input
                  type="text"
                  required={isSignUp}
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#5038ED] text-xs"
                  placeholder="587"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">SMTP Username</label>
                <input
                  type="text"
                  required={isSignUp}
                  value={smtpEmail}
                  onChange={(e) => setSmtpEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#5038ED] text-xs"
                  placeholder="smtp-user@example.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">SMTP Password</label>
                <input
                  type="password"
                  required={isSignUp}
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#5038ED] text-xs"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 bg-[#5038ED] hover:bg-[#402bd6] text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-500/10 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {isSignUp ? 'Verifying SMTP & Registering Admin...' : 'Signing in...'}
            </>
          ) : (
            isSignUp ? 'Verify SMTP & Register Admin' : 'Sign In'
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        <p className="text-slate-500 text-xs font-semibold">
          {isSignUp ? 'Already have an administrator account?' : 'Need to register as an administrator?'}{' '}
          <button
            onClick={handleToggleMode}
            className="text-[#5038ED] hover:text-[#402bd6] font-bold focus:outline-none transition-colors cursor-pointer"
          >
            {isSignUp ? 'Sign In' : 'Register Admin'}
          </button>
        </p>
      </div>
    </div>
  );
}
