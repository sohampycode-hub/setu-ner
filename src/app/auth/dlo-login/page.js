'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getDloSupabaseClient } from '../../../utils/supabase';
import { StateEmblem, AshokaChakraWatermark } from '../../../components/emblems/NationalEmblem';
import GovFooter from '../../../components/GovFooter';

export default function DLOLoginPage() {
  const router = useRouter();
  const dloSupabase = useMemo(() => getDloSupabaseClient(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only clears DLO session in this tab
    dloSupabase.auth.signOut();
  }, [dloSupabase]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const { data: authData, error: authError } = await dloSupabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;

      const { data: profile, error: profError } = await dloSupabase
        .from('user_profiles')
        .select('role, full_name, assigned_district_id')
        .eq('id', authData.user.id)
        .single();

      if (profError || !profile) {
        await dloSupabase.auth.signOut();
        throw new Error('No official credentials profile found.');
      }

      if (profile.role !== 'dlo') {
        await dloSupabase.auth.signOut();
        throw new Error(`Unauthorized. This account is registered as "${profile.role.toUpperCase()}".`);
      }

      router.replace('/dlo/dashboard');
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans relative overflow-x-hidden">
      <div className="fixed -right-20 top-20 pointer-events-none z-0">
        <AshokaChakraWatermark className="w-[520px] h-[520px]" opacity="0.03" />
      </div>

      <div className="h-1.5 w-full flex z-10">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      <header className="bg-slate-900 text-slate-300 text-xs py-2 px-4 sm:px-8 border-b border-slate-800 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-100">भारत सरकार</span>
            <span>•</span>
            <span>District Disaster Management Authority (DDMA) Command Desk</span>
          </div>
          <Link href="/" className="text-cyan-400 hover:underline font-mono text-[11px]">
            ← Citizen Portal
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-8">
        <div className="bg-white border border-slate-300 rounded-md shadow-xl max-w-md w-full p-6 sm:p-8 space-y-5">
          <div className="text-center space-y-1.5">
            <div className="flex justify-center">
              <StateEmblem className="h-14 w-auto" variant="gold" />
            </div>
            <span className="bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              DLO Command Portal
            </span>
            <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase mt-1">
              District Logistics Officer Sign In
            </h1>
            <p className="text-xs text-slate-500">
              Administrative Command Portal for District Nodal Officers
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded leading-relaxed">
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="block font-semibold text-slate-700">Official DLO Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dlo.kamrup@setu.gov.in"
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-blue-900"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-700">Passcode</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-blue-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded text-xs transition shadow-xs cursor-pointer disabled:opacity-50 min-h-[42px] mt-2 flex items-center justify-center space-x-2"
            >
              <span>🛡️</span>
              <span>{loading ? 'Authenticating Command...' : 'Sign In as DLO'}</span>
            </button>
          </form>

          <div className="pt-3 flex justify-between items-center text-xs text-slate-500 border-t border-slate-100">
            <Link href="/auth/officer-login" className="text-amber-800 font-semibold hover:underline">
              Are you a Field Officer? Sign In Here ➔
            </Link>
            <Link href="/" className="hover:underline">
              Citizen Portal
            </Link>
          </div>
        </div>
      </div>

      <GovFooter />
    </main>
  );
}