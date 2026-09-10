'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../utils/supabase';
import { StateEmblem, AshokaChakraWatermark } from '../../components/emblems/NationalEmblem';
import GovFooter from '../../components/GovFooter';

function VerifyManifestContent() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code') || '';
  const [manifestCode, setManifestCode] = useState(codeParam);
  const [loading, setLoading] = useState(false);
  const [manifest, setManifest] = useState(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const lookupManifest = async (codeToSearch) => {
    const cleanCode = (codeToSearch || '').trim();
    if (!cleanCode) return;

    setLoading(true);
    setErrorMsg('');
    setSearchAttempted(true);

    try {
      const { data, error } = await supabase
        .from('transit_manifests')
        .select('*')
        .eq('manifest_code', cleanCode)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setManifest(null);
        setErrorMsg(`No official transit record found matching dispatch identifier "${cleanCode}".`);
      } else {
        setManifest(data);
      }
    } catch (err) {
      console.error('Manifest lookup failure:', err);
      setErrorMsg(`Verification service query error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (codeParam) {
      setManifestCode(codeParam);
      lookupManifest(codeParam);
    }
  }, [codeParam]);

  const handleSubmit = (e) => {
    e.preventDefault();
    lookupManifest(manifestCode);
  };

  const isCleared = manifest?.clearance_status === 'AUTHORIZED';

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6 w-full flex-1 z-10">
      {/* Search Header Form */}
      <div className="bg-white p-5 rounded-md border border-slate-200 shadow-2xs space-y-3">
        <div>
          <span className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">
            Checkpoint Electronic Registry
          </span>
          <h1 className="text-base sm:text-lg font-black text-slate-900">
            Statutory Transit Manifest Authenticator
          </h1>
          <p className="text-xs text-slate-500">
            Law enforcement detachments, NHAI checkposts, and BRO personnel can verify statutory travel clearances issued by DDMA Field Officers.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <input
            type="text"
            required
            value={manifestCode}
            onChange={(e) => setManifestCode(e.target.value.toUpperCase())}
            placeholder="e.g., NER-DSP-20260910-XXXX"
            className="flex-1 border border-slate-300 rounded p-2.5 text-xs font-mono uppercase focus:outline-blue-700 bg-slate-50"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>🔍</span>
            <span>{loading ? 'Verifying Registry...' : 'Validate Dispatch'}</span>
          </button>
        </form>
      </div>

      {/* Error or Not Found Alert */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-md text-xs font-semibold space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-base">⚠️</span>
            <strong>Verification Alert: Record Unverified</strong>
          </div>
          <p className="text-rose-800 text-[11px]">{errorMsg}</p>
        </div>
      )}

      {/* Verified Manifest Certificate */}
      {manifest && (
        <div className="relative bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden font-sans">
          {/* Subtle Watermark */}
          <div className="absolute right-0 top-1/4 pointer-events-none opacity-[0.03]">
            <AshokaChakraWatermark className="w-[420px] h-[420px]" />
          </div>

          {/* Tricolor Ribbon */}
          <div className="h-1.5 w-full flex">
            <div className="flex-1 bg-[#FF9933]" />
            <div className="flex-1 bg-white" />
            <div className="flex-1 bg-[#138808]" />
          </div>

          {/* Certificate Header */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3.5">
              <StateEmblem className="h-12 w-auto shrink-0" variant="gold" />
              <div>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block">
                  भारत सरकार | Government of India
                </span>
                <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                  Ministry of Development of North Eastern Region (MDoNER)
                </h2>
                <p className="text-[11px] font-semibold text-slate-500">
                  Authenticated Checkpoint Transit Record
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded text-xs font-mono font-bold tracking-wider ${
                isCleared 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {isCleared ? '● AUTHORIZED CLEAR' : '🛑 TRANSIT PROHIBITED'}
              </span>
            </div>
          </div>

          {/* Certificate Body */}
          <div className="p-5 sm:p-6 space-y-4 text-xs">
            {/* Dispatch Code & QR Confirmation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  Sovereign Dispatch Code
                </span>
                <p className="text-base font-black font-mono text-slate-900">
                  {manifest.manifest_code}
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Issued: {manifest.created_at ? new Date(manifest.created_at).toLocaleString() : 'Recent'}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-2 rounded shrink-0 flex items-center space-x-2">
                <QRCodeSVG
                  value={typeof window !== 'undefined' ? window.location.href : manifest.manifest_code}
                  size={58}
                  level="M"
                />
                <span className="text-[9px] text-slate-500 font-mono max-w-[90px] leading-tight">
                  Cryptographically Verified
                </span>
              </div>
            </div>

            {/* Officer & Jurisdiction Info */}
            <div className="bg-slate-50 border border-slate-200 rounded p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Issuing Authority</span>
                <strong className="text-slate-900 block">{manifest.issued_by_officer}</strong>
                <span className="text-[10px] text-slate-500 font-mono">DDMA Field Patrol Officer</span>
              </div>
              <div className="sm:text-right">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Jurisdiction Gate</span>
                <strong className="text-blue-900 block">{manifest.target_district || 'Regional Sector'}</strong>
                <span className="text-[10px] text-emerald-700 font-bold font-mono">VERIFIED ACTIVE RECORD</span>
              </div>
            </div>

            {/* Vehicle & Convoy Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 sm:col-span-2">
                <span className="text-[9px] font-sans text-slate-400 block uppercase">Conveyance / Unit</span>
                <strong className="text-slate-900 text-xs block truncate">{manifest.vehicle_type}</strong>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-[9px] font-sans text-slate-400 block uppercase">Registration</span>
                <strong className="text-blue-900 text-xs block">{manifest.vehicle_reg_number}</strong>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-[9px] font-sans text-slate-400 block uppercase">Clearance Gate</span>
                <strong className={`text-xs block ${isCleared ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {manifest.clearance_status}
                </strong>
              </div>
            </div>

            {/* Driver & Cargo Details */}
            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Convoy In-Charge / Driver:</span>
                <strong className="text-slate-900">{manifest.driver_name} ({manifest.driver_contact})</strong>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-500">Cargo / Consignment:</span>
                <strong className="text-slate-900">{manifest.cargo_description || 'Essential Emergency Supplies'}</strong>
              </div>
            </div>

            {/* Statutory Notice */}
            <div className="text-[9px] text-slate-500 border-t border-slate-200 pt-3 leading-relaxed">
              <p>
                <strong>Statutory Notice:</strong> This clearance slip has been issued under the Disaster Management Act by authorized field patrol personnel. Disciplinary action will be initiated against any counterfeit or unauthorized alteration of this manifest.
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white rounded text-xs font-bold transition cursor-pointer flex items-center space-x-1.5"
            >
              <span>🖨️</span>
              <span>Print Slip</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyManifestPage() {
  return (
    <main className="min-h-screen bg-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      {/* Sovereign Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white z-10">
        <div className="border-b border-slate-800 bg-slate-950 text-slate-400 text-[10px] sm:text-[11px] px-4 sm:px-8 py-1.5 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-200">
              भारत सरकार | Government of India
            </span>
            <span>•</span>
            <span>MDoNER & NDMA Sovereign Checkpoint Service</span>
          </div>
          <span className="font-mono text-emerald-400 text-[10px]">
            PUBLIC VERIFICATION DESK
          </span>
        </div>

        <div className="px-4 sm:px-8 py-3 flex justify-between items-center max-w-7xl mx-auto w-full">
          <div className="flex items-center space-x-3">
            <StateEmblem className="h-10 w-auto" variant="gold" />
            <div className="border-l border-slate-700 pl-3">
              <span className="text-base font-bold text-white tracking-tight">SETU-NER</span>
              <p className="text-[11px] text-slate-400">Electronic Transit Clearance Authenticator</p>
            </div>
          </div>

          <Link
            href="/"
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded border border-slate-700 font-semibold transition"
          >
            Citizen Radar
          </Link>
        </div>
      </header>

      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center p-8 text-xs text-slate-500 font-mono">
          Loading Verification Desk...
        </div>
      }>
        <VerifyManifestContent />
      </Suspense>

      <GovFooter />
    </main>
  );
}