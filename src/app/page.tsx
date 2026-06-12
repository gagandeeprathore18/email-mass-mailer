'use client';

import React from 'react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] flex flex-col justify-between font-sans selection:bg-[#5038ED] selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-4 z-40 mx-auto w-[calc(100%-4rem)] max-w-7xl bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-2xl shadow-lg px-8 py-3 flex items-center justify-between transition-all mt-4">
        <div className="flex items-center space-x-12">
          {/* Logo */}
          <div className="flex flex-col items-start leading-none">
            <span className="font-extrabold text-2xl tracking-tight text-[#5038ED] leading-none">
              Queuvo
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 leading-none">
              Email Marketing
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-5">
          <div className="flex items-center space-x-3 text-xs font-semibold text-slate-500">
            <span>System Status:</span>
            <span className="flex items-center text-emerald-600 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              ONLINE
            </span>
          </div>
        </div>
      </nav>

      {/* Hero Content Section */}
      <main className="max-w-7xl w-full mx-auto px-8 py-12 flex flex-col items-center justify-center text-center my-auto">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-none mb-6">
            High-Performance <br />
            <span className="text-[#5038ED] bg-gradient-to-r from-[#5038ED] to-[#705bf2] bg-clip-text text-transparent">
              Organization Mailing System
            </span>
          </h1>
          <p className="text-slate-500 text-sm max-w-xl mb-12 font-medium leading-relaxed">
            Bulk mailing infrastructure for businesses. Administrators control SMTP servers, accounts, and assignments, while users design and send campaigns.
          </p>
        </div>

        {/* Portal Entry Choices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
          {/* Admin Card */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="text-left mb-8">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-[#5038ED] mb-5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">Admin Administration</h3>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Configure provider-agnostic SMTP networks, create user profiles, manage routing access permissions, and audit logs.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/auth?mode=login"
                className="flex-1 py-3 bg-[#5038ED] hover:bg-[#402bd6] text-white text-center text-xs font-bold rounded-xl shadow-md transition-all"
              >
                Admin Login
              </Link>
              <Link
                href="/auth?mode=signup"
                className="flex-1 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-center text-xs font-bold rounded-xl transition-all"
              >
                Register Admin
              </Link>
            </div>
          </div>

          {/* User Card */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="text-left mb-8">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-5.625-3.75" />
                </svg>
              </div>
              <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">User Campaign Operations</h3>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Log in to write campaign messages, upload recipient rosters, upload attachments, schedule mailings, and view performance reports.
              </p>
            </div>

            <Link
              href="/auth?mode=login"
              className="w-full py-3 bg-slate-900 hover:bg-slate-850 text-white text-center text-xs font-bold rounded-xl shadow-md transition-all"
            >
              Sign In to Campaigns
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto px-8 py-8 border-t border-slate-200/40 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
        &copy; {new Date().getFullYear()} Queuvo Mail. Secure, Provider-Agnostic, High-Volume Delivery.
      </footer>
    </div>
  );
}
