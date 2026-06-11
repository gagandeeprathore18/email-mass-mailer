'use client';

import React from 'react';

export default function ThemeToggle() {
  return (
    <div
      className="p-2 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center"
      aria-label="Theme Mode"
    >
      <svg className="w-5 h-5 cursor-not-allowed" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    </div>
  );
}
