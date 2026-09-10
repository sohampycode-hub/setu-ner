'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../utils/supabase';

export default function MinistryAdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@ner.gov.in');
  const [password, setPassword] = useState('Admin@SETU2026');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAdminAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authResult, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (loginError) {
        throw new Error(loginError.message);
      }

      if (!authResult?.user) {
        throw new Error('Authentication succeeded but user identity was not returned.');
      }

      // 2. Fetch role directly from public.user_profiles
      const { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('id, role, full_name')
        .eq('id', authResult.user.id)
        .maybeSingle();

      if (profileErr) {
        throw new Error(`Profile query error: ${profileErr.message}`);
      }

      if (!profile || profile.role !== 'super_admin') {
        await supabase.auth.signOut();
        throw new Error('Access denied: Unauthorized credential for Ministry Super Command.');
      }

      sessionStorage.setItem(
        'super_admin_session',
        JSON.stringify({
          userId: authResult.user.id,
          email: authResult.user.email,
          role: 'super_admin',
          fullName: profile.full_name,
        })
      );

      router.push('/admin/dashboard');
    } catch (err) {
      console.error('Super Admin Auth Error:', err);
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 font-sans text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-md shadow-2xl p-6 space-y-5">
        <div className="text-center space-y-2">
          <span className="text-[10px] uppercase font-bold tracking-widest bg-red-950 text-red-400 border border-red-800/60 px-2 py-0.5 rounded-xs">
            Apex Ministry Gate
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white">MDoNER Super Command</h1>
          <p className="text-xs text-slate-400">National Emergency Logistics Oversight Portal</p>
        </div>

        {errorMsg && (
          <div className="bg-red-950/60 border border-red-800 text-red-300 text-xs p-2.5 rounded-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAdminAuth} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Ministry Super Admin Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xs text-slate-200 focus:outline-red-600 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Master Access Key (Password)</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xs text-slate-200 focus:outline-red-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-red-800 hover:bg-red-700 text-white font-bold rounded-xs transition shadow-md cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Verifying Apex Clearance...' : 'Authenticate Super Admin'}
          </button>
        </form>

        <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-300 transition">
            ← Back to Public Portal
          </Link>
        </div>
      </div>
    </main>
  );
}