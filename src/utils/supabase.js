import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Default client (Citizen portal / general operations)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// DLO Dedicated Client (Isolated Session Storage)
export const getDloSupabaseClient = () => {
  if (typeof window === 'undefined') return supabase;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: window.sessionStorage,
      storageKey: 'sb-dlo-auth-token',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
};

// Field Officer Dedicated Client (Isolated Session Storage)
let officerClientInstance = null;

export function getOfficerSupabaseClient() {
  if (officerClientInstance) {
    return officerClientInstance;
  }

  officerClientInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        storageKey: 'sb-officer-auth-token',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );

  return officerClientInstance;
};