'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StateEmblem } from './emblems/NationalEmblem';

export default function GovHeader({ isOnline, offlineQueueCount, onManualSync }) {
  const [fontSizeLevel, setFontSizeLevel] = useState(0); // -1, 0, 1
  const [highContrast, setHighContrast] = useState(false);

  // GIGW Font Size Scaler
  const handleFontSize = (delta) => {
    const next = Math.max(-1, Math.min(2, fontSizeLevel + delta));
    setFontSizeLevel(next);
    if (typeof document !== 'undefined') {
      const scales = ['90%', '100%', '110%', '120%'];
      document.documentElement.style.fontSize = scales[next + 1];
    }
  };

  // High Contrast Mode Toggle
  const toggleContrast = () => {
    const next = !highContrast;
    setHighContrast(next);
    if (typeof document !== 'undefined') {
      if (next) {
        document.documentElement.classList.add('gov-high-contrast');
      } else {
        document.documentElement.classList.remove('gov-high-contrast');
      }
    }
  };

  return (
    <header className="border-b border-slate-300 bg-white print:hidden font-sans">
      {/* 1. Tricolor Brand Accent Line */}
      <div className="h-1 w-full flex">
        <div className="flex-1 bg-[#FF9933]" title="Saffron" />
        <div className="flex-1 bg-white" title="White" />
        <div className="flex-1 bg-[#138808]" title="Green" />
      </div>

      {/* 2. Top GIGW Standard Accessibility & Utility Ribbon */}
      <div className="bg-slate-900 text-slate-200 border-b border-slate-800 text-[11px] px-4 sm:px-8 py-1 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center space-x-2">
          <a
            href="#main-content"
            className="bg-blue-900 text-cyan-200 px-2 py-0.5 rounded text-[10px] font-bold focus:inline-block sr-only focus:not-sr-only"
          >
            Skip to Main Content
          </a>
          <span className="font-semibold text-slate-100">भारत सरकार</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300 font-medium">Government of India</span>
        </div>

        <div className="flex items-center space-x-4">
          {/* Font Resizing Controls */}
          <div className="flex items-center space-x-1 border-r border-slate-700 pr-3 font-mono font-bold text-[10px]">
            <button
              onClick={() => handleFontSize(-1)}
              className="px-1.5 py-0.5 hover:bg-slate-800 rounded text-slate-300 cursor-pointer"
              title="Decrease Font Size"
            >
              A-
            </button>
            <button
              onClick={() => handleFontSize(0)}
              className="px-1.5 py-0.5 hover:bg-slate-800 rounded text-slate-300 cursor-pointer"
              title="Default Font Size"
            >
              A
            </button>
            <button
              onClick={() => handleFontSize(1)}
              className="px-1.5 py-0.5 hover:bg-slate-800 rounded text-slate-300 cursor-pointer"
              title="Increase Font Size"
            >
              A+
            </button>
          </div>

          {/* High Contrast Mode Switcher */}
          <button
            onClick={toggleContrast}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
              highContrast
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle High Contrast Display"
          >
            {highContrast ? 'Standard View' : 'High Contrast'}
          </button>

          {/* Online/Offline Telemetry Status */}
          <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-700 font-mono text-[10px]">
            <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
            <span className={isOnline ? 'text-slate-300' : 'text-amber-300 font-bold'}>
              {isOnline ? 'NIC WAN' : 'Local Mesh'}
            </span>
            {offlineQueueCount > 0 && (
              <button
                onClick={onManualSync}
                className="bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-500/50 cursor-pointer"
              >
                {offlineQueueCount} Sync
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Primary Sovereign Ministry Identity Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center space-x-3.5">
          <StateEmblem className="h-12 w-auto" variant="gold" />
          <div className="border-l border-slate-300 pl-3.5 space-y-0.5">
            <div className="text-[11px] font-bold text-slate-800 leading-tight">
              उत्तर पूर्वी क्षेत्र विकास मंत्रालय
              <span className="block font-medium text-slate-600 text-[10px]">
                Ministry of Development of North Eastern Region
              </span>
            </div>
            <div className="flex items-center space-x-2 pt-0.5">
              <span className="bg-[#0b4f8a] text-white font-black text-xs px-1.5 py-0.5 rounded tracking-wide">
                SETU-NER
              </span>
              <span className="text-xs font-bold tracking-tight text-slate-900">
                पूर्वोत्तर सेतु सुरक्षा एवं पारवहन पोर्टल
              </span>
            </div>
          </div>
        </div>

        {/* Portals & Direct Links */}
       <nav className="flex items-center space-x-1.5 sm:space-x-2 text-xs font-semibold"> 
          <Link
            href="/"
            className="px-2.5 py-1.5 text-slate-700 hover:text-blue-900 border-b-2 border-transparent hover:border-blue-900 transition"
          >
            Citizen Radar
          </Link>
          <Link
            href="/auth/officer-login"
            className="px-2.5 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded font-bold shadow-xs transition flex items-center space-x-1"
            title="Ground Field Officer Highway Patrol"
          >
            <span>🚔</span>
            <span>Field Officer</span>
          </Link>
          <Link
            href="/auth/dlo-login"
            className="px-2.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded font-bold shadow-xs transition flex items-center space-x-1"
            title="District Logistics Officer Authority Desk"
          >
            <span>🛡️</span>
            <span>DLO Desk</span>
          </Link>
          <Link
            href="/admin/login"
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-black text-slate-200 rounded transition"
            title="Super Admin / Ministry Apex"
          >
            🏛️ Ministry Apex
          </Link>
        </nav>
      </div>
    </header>
  );
}