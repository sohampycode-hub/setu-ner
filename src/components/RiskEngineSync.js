'use client';

import { useState, useEffect, useRef } from 'react';

export default function RiskEngineSync({ onSyncComplete }) {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState('Idle');
  const hasInitialTriggered = useRef(false);

  const runDynamicRiskSync = async () => {
    if (isEvaluating) return;
    setIsEvaluating(true);
    setSyncStatus('Evaluating Weather Grid...');

    try {
      const res = await fetch('/api/risk/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (data.success) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(timeStr);
        setSyncStatus(`Live Grid Active (${data.totalDistrictsEvaluated || 133} Dists)`);
        if (onSyncComplete) onSyncComplete();
      } else {
        setSyncStatus('Sync Deferred');
      }
    } catch {
      setSyncStatus('Weather Offline');
    } finally {
      setIsEvaluating(false);
    }
  };

  useEffect(() => {
    if (!hasInitialTriggered.current) {
      hasInitialTriggered.current = true;
      // Small initial delay so Leaflet finishes initial polyline rendering first
      const initialTimer = setTimeout(() => {
        runDynamicRiskSync();
      }, 3500);

      return () => clearTimeout(initialTimer);
    }

    // Auto-refresh dynamic risk every 15 minutes (Open-Meteo cache window)
    const interval = setInterval(() => {
      runDynamicRiskSync();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/90 text-slate-200 border border-slate-700 rounded text-[11px] font-mono shadow-xs shrink-0">
      <span className={`h-2 w-2 rounded-full ${isEvaluating ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
      <span className="font-bold text-slate-300">Risk Engine:</span>
      <span className="text-cyan-400">{syncStatus}</span>
      {lastSyncTime && (
        <span className="text-slate-500 text-[10px] pl-1 border-l border-slate-700">
          Updated: {lastSyncTime}
        </span>
      )}
      <button
        type="button"
        onClick={runDynamicRiskSync}
        disabled={isEvaluating}
        className="ml-1 text-[10px] text-cyan-300 hover:text-cyan-100 underline cursor-pointer disabled:opacity-50"
      >
        {isEvaluating ? '...' : 'Sync'}
      </button>
    </div>
  );
}