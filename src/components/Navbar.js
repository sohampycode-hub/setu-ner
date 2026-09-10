'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GovBanner from './GovBanner';
import { signOutUser } from '../utils/auth';

export default function Navbar({ userRole = null, fullName = null }) {
  const router = useRouter();

  const handleLogout = async () => {
    await signOutUser();
    router.push('/auth');
  };

  return (
    <div className="sticky top-0 z-50 bg-white shadow-sm border-b border-[#cbd5e1]">
      <GovBanner />
      <header className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-3">
            <div className="h-10 w-10 border border-[#0b4f8a] bg-[#0e2a47] text-white flex flex-col items-center justify-center font-serif text-sm font-bold shadow-xs">
              <span>सेतु</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-[#0e2a47]">
                  SETU-NER
                </span>
                <span className="text-[11px] uppercase font-bold tracking-wider bg-[#0b4f8a] text-white px-1.5 py-0.5 rounded-xs">
                  LogixHub
                </span>
              </div>
              <p className="text-[11px] text-[#475569] hidden sm:block">
                AI Logistics &amp; Accessibility Intelligence Platform (SIH 2026)
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex items-center space-x-4">
          <Link
            href="/"
            className="text-xs font-semibold text-[#334155] hover:text-[#0b4f8a] transition px-2 py-1"
          >
            Public Corridor Map
          </Link>

          {userRole ? (
            <div className="flex items-center space-x-3 pl-3 border-l border-[#cbd5e1]">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-[#0f172a]">{fullName || 'Authorized Staff'}</p>
                <p className="text-[10px] text-[#0b4f8a] font-mono font-bold uppercase tracking-wider">
                  {userRole.replace('_', ' ')}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs bg-[#b91c1c] hover:bg-[#991b1b] text-white px-3 py-1.5 rounded-xs transition font-medium shadow-xs"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                href="/auth"
                className="text-xs border border-[#0b4f8a] text-[#0b4f8a] hover:bg-[#0b4f8a] hover:text-white font-semibold px-3.5 py-1.5 rounded-xs transition shadow-xs"
              >
                Official Sign In
              </Link>
            </div>
          )}
        </nav>
      </header>
    </div>
  );
}