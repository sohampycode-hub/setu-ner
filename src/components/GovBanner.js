'use client';

export default function GovBanner() {
  return (
    <div className="bg-[#f0f4f8] border-b border-[#cbd5e1] text-[11px] text-[#334155]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Subtle National Tricolor Badge */}
          <div className="flex h-3.5 w-2 flex-col overflow-hidden rounded-xs shadow-xs">
            <span className="h-[33%] bg-[#FF9933]"></span>
            <span className="h-[34%] bg-[#FFFFFF]"></span>
            <span className="h-[33%] bg-[#138808]"></span>
          </div>
          <span className="font-semibold text-[#0f172a]">
            भारत सरकार | Government of India
          </span>
          <span className="text-[#94a3b8]">|</span>
          <span className="hidden md:inline text-[#475569]">
            Ministry of Development of North Eastern Region (MDoNER)
          </span>
        </div>

        <div className="flex items-center space-x-4 text-[11px]">
          <span className="text-[#475569] hidden sm:inline">
            Standard: NIC / GIGW 3.0 Compliant
          </span>
          <span className="bg-[#e2e8f0] text-[#0f172a] border border-[#cbd5e1] px-2 py-0.5 font-mono text-[10px] font-semibold">
            SECURE PORTAL
          </span>
        </div>
      </div>
    </div>
  );
}