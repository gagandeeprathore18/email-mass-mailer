'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface UserProfile {
  email: string;
  role: string;
  name?: string | null;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/auth');
          return;
        }
        const data = await res.json();
        if (data.authenticated && data.user?.role === 'admin') {
          setUser(data.user);
        } else {
          router.push('/dashboard');
        }
      } catch (err) {
        console.error('Failed to verify admin authentication', err);
        router.push('/auth');
      } finally {
        setLoading(false);
      }
    }
    checkUser();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7fb] text-slate-500 font-sans">
        <div className="flex flex-col items-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-[#5038ED]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-semibold">Verifying Admin Access...</span>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: 'Dashboard', href: '/admin' },
    { name: 'Users', href: '/admin/users' },
    { name: 'SMTP Accounts', href: '/admin/smtp-servers' },
    { name: 'SMTP Assignments', href: '/admin/smtp-assignments' },
    { name: 'Campaigns', href: '/admin/campaigns' },
  ];

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <nav className="sticky top-4 z-40 mx-auto w-[calc(100%-4rem)] max-w-7xl bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-2xl shadow-lg px-8 py-3 flex items-center justify-between transition-all mt-4">
        <div className="flex items-center space-x-12">
          {/* Logo */}
          <Link href="/admin" className="flex flex-col items-start leading-none">
            <span className="font-extrabold text-2xl tracking-tight text-[#5038ED] leading-none">
              Queuvo
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 leading-none">
              Admin Portal
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`py-2 text-sm font-semibold relative transition-colors ${
                    isActive ? 'text-[#5038ED]' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {item.name}
                  {isActive && (
                    <span className="absolute bottom-[-13px] left-0 right-0 h-[3px] bg-[#5038ED] rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* User Stats & Actions */}
        <div className="flex items-center space-x-5">
          <div className="flex items-center space-x-4 pl-2 border-l border-slate-200">
            <div className="flex flex-col text-right leading-tight">
              <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">
                {user?.name || 'Administrator'}
              </span>
              <span className="text-[9px] text-slate-400 truncate max-w-[150px]">
                {user?.email}
              </span>
            </div>
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-[#5038ED] text-xs font-bold rounded-lg transition-all cursor-pointer"
            >
              User Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 hover:text-rose-600 text-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto px-8 py-6 text-center text-xs text-slate-400 mt-12 border-t border-slate-200/40">
        &copy; {new Date().getFullYear()} Queuvo. Admin Portal Control Center.
      </footer>
    </div>
  );
}
