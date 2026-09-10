'use client';

import { useState, useEffect, useCallback } from 'react';

export default function ManifestArchiveModal({ isOpen, onClose, onSelectManifest }) {
  const [manifests, setManifests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchArchives = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/manifests?limit=40');
      const data = await res.json();
      if (data.success) {
        setManifests(data.manifests || []);
      }
    } catch (err) {
      console.error('Failed to load archives:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchArchives();
    }
  }, [isOpen, fetchArchives]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto print:hidden">
      <div className="bg-white border border-slate-300 rounded-md shadow-2xl max-w-4xl w-full my-8 text-slate-900 font-sans">
        <div className="flex justify-between items-center px-6 py-3.5 border-b border-slate-200 bg-slate-100">
          <div className="flex items-center space-x-2">
            <span className="text-base">📜</span>
            <h2 className="font-bold text-sm text-slate-800 uppercase tracking-wider">
              Emergency Transit Dispatch Archives
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchArchives}
              disabled={loading}
              className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded text-xs font-bold border border-slate-300 transition cursor-pointer"
            >
              {loading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold transition cursor-pointer"
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div className="p-6 overflow-x-auto max-h-[70vh]">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Retrieving registered transit orders from database...
            </div>
          ) : manifests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs italic">
              No historical dispatch orders recorded in this sector yet.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">Manifest Code</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Route Sector</th>
                  <th className="py-2.5 px-3">Distance & Time</th>
                  <th className="py-2.5 px-3">Hazards</th>
                  <th className="py-2.5 px-3">Issued Timestamp</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manifests.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-cyan-900">{m.manifest_code}</td>
                    <td className="py-2.5 px-3 capitalize">
                      <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                        {m.vehicle_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      {m.origin_name} <span className="text-slate-400">➔</span> {m.destination_name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {m.total_distance_km} km <span className="text-slate-400">({m.estimated_duration})</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          m.blocked_hazards_count === 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {m.blocked_hazards_count} Blockages
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {new Date(m.created_at).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => {
                          onSelectManifest(m);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-[11px] font-bold shadow-xs transition cursor-pointer"
                      >
                        🖨️ View & Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}