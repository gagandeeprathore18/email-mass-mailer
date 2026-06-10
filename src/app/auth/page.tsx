'use client';

import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
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

      // Successful Auth -> Redirect to Dashboard
      router.push('/dashboard');
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
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black p-4">
      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      <div className="w-full max-w-xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-2xl rounded-2xl p-8 md:p-10 transition-all duration-300">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Email Mass Mailer
          </h1>
          <p className="text-slate-400 text-sm">
            {isSignUp ? 'Configure your SMTP settings to launch bulk campaigns' : 'Sign in to manage your campaigns'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-start space-x-2">
            <svg className="w-5 h-5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="break-words">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* General Auth Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* SMTP Configuration Section (Only for SignUp) */}
          {isSignUp && (
            <div className="pt-4 border-t border-slate-800/80 space-y-4 transition-all duration-300">
              <h3 className="text-sm font-semibold text-indigo-400 tracking-wide">SMTP Settings</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1.5">SMTP Host</label>
                  <input
                    type="text"
                    required={isSignUp}
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                    placeholder="smtp.mailtrap.io"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Port</label>
                  <input
                    type="text"
                    required={isSignUp}
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">SMTP Username / Email</label>
                  <input
                    type="text"
                    required={isSignUp}
                    value={smtpEmail}
                    onChange={(e) => setSmtpEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                    placeholder="smtp-user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">SMTP Password</label>
                  <input
                    type="password"
                    required={isSignUp}
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {isSignUp ? 'Verifying SMTP & Creating Account...' : 'Signing in...'}
              </>
            ) : (
              isSignUp ? 'Verify SMTP & Create Account' : 'Sign In'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800/60 text-center">
          <p className="text-slate-400 text-sm">
            {isSignUp ? 'Already have an account?' : "Don't have an account yet?"}{' '}
            <button
              onClick={handleToggleMode}
              className="text-indigo-400 hover:text-indigo-300 font-semibold focus:outline-none transition-colors"
            >
              {isSignUp ? 'Sign In' : 'Create Account'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
