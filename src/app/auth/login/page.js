'use client';

import Link from 'next/link';
import { StateEmblem, AshokaChakraWatermark } from '../../../components/emblems/NationalEmblem';
import GovFooter from '../../../components/GovFooter';

export default function AuthGatewayPage() {
  return (
    <main className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans relative overflow-x-hidden">
      {/* Background Ashoka Chakra Watermark */}
      <div className="fixed -right-20 top-20 pointer-events-none z-0">
        <AshokaChakraWatermark className="w-[520px] h-[520px]" opacity="0.03" />
      </div>

      {/* Tricolor Ribbon */}
      <div className="h-1.5 w-full flex z-10">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      {/* Header */}
      <header className="bg-slate-900 text-slate-300 text-xs py-2 px-4 sm:px-8 border-b border-slate-800 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-100">भारत सरकार | Government of India</span>
            <span>•</span>
            <span>SETU-NER Sovereign Command Gateway</span>
          </div>
          <Link href="/" className="text-cyan-400 hover:underline font-mono text-[11px]">
            ← Return to Citizen Portal
          </Link>
        </div>
      </header>

      {/* Gateway Selector Card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-8">
        <div className="bg-white border border-slate-300 rounded-md shadow-xl max-w-lg w-full p-6 sm:p-8 space-y-6">
          
          <div className="text-center space-y-1.5">
            <div className="flex justify-center">
              <StateEmblem className="h-14 w-auto" variant="gold" />
            </div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
              Official Personnel Access Gateway
            </h1>
            <p className="text-xs text-slate-500">
              Select your designated administrative authority level to proceed to the isolated login portal
            </p>
          </div>

          <div className="space-y-3">
            {/* Field Officer Gateway */}
            <Link
              href="/auth/officer-login"
              className="block p-4 border border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 rounded-md transition shadow-xs group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🚔</span>
                  <div>
                    <h2 className="text-sm font-bold text-amber-950 group-hover:text-amber-900">
                      Ground Field Officer Portal
                    </h2>
                    <p className="text-[11px] text-slate-600">
                      Sector highway scouts, physical inspection units & on-site clearance
                    </p>
                  </div>
                </div>
                <span className="text-amber-800 font-bold text-sm">→</span>
              </div>
            </Link>

            {/* DLO Gateway */}
            <Link
              href="/auth/dlo-login"
              className="block p-4 border border-blue-200 bg-blue-50/50 hover:bg-blue-100/70 rounded-md transition shadow-xs group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🛡️</span>
                  <div>
                    <h2 className="text-sm font-bold text-blue-950 group-hover:text-blue-900">
                      District Logistics Officer (DLO) Desk
                    </h2>
                    <p className="text-[11px] text-slate-600">
                      District boundary jurisdiction, logistics telemetry, and machinery dispatch
                    </p>
                  </div>
                </div>
                <span className="text-blue-800 font-bold text-sm">→</span>
              </div>
            </Link>

            {/* Apex Ministry Gateway */}
            <Link
              href="/admin/login"
              className="block p-4 border border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-md transition shadow-xs group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🏛️</span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 group-hover:text-black">
                      Ministry Apex Super Admin
                    </h2>
                    <p className="text-[11px] text-slate-600">
                      National MDoNER / NDMA multi-state corridor overview
                    </p>
                  </div>
                </div>
                <span className="text-slate-800 font-bold text-sm">→</span>
              </div>
            </Link>
          </div>

          <div className="border-t border-slate-100 pt-3 text-center text-[10px] text-slate-400">
            Protected by statutory disaster response compliance regulations.
          </div>
        </div>
      </div>

      <GovFooter />
    </main>
  );
}