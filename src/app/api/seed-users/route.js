import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Uses the SERVICE_ROLE_KEY to bypass client restrictions and interact with GoTrue natively
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. Get Kamrup Metropolitan District ID
    const { data: district } = await supabaseAdmin
      .from('districts')
      .select('id')
      .ilike('name', '%Kamrup%')
      .limit(1)
      .single();

    const kamrupId = district?.id || null;

    // 2. Define the 3 Demo Accounts
    const usersToCreate = [
      {
        email: 'admin@ner.gov.in',
        password: 'Admin@SETU2026',
        fullName: 'MDoNER National Secretary (Super Admin)',
        role: 'super_admin',
        districtId: null,
      },
      {
        email: 'dlo.kamrup@ner.gov.in',
        password: 'Dlo@Kamrup2026',
        fullName: 'Dr. B. Sarma (Executive DLO)',
        role: 'dlo',
        districtId: kamrupId,
      },
      {
        email: 'officer.kamrup@ner.gov.in',
        password: 'Officer@Kamrup2026',
        fullName: 'Insp. R. Baruah (Field Officer)',
        role: 'field_officer',
        districtId: kamrupId,
      },
    ];

    const results = [];

    for (const u of usersToCreate) {
      // Create user natively via GoTrue
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });

      if (authErr) {
        results.push({ email: u.email, error: authErr.message });
        continue;
      }

      // Link into user_profiles
      const { error: profileErr } = await supabaseAdmin.from('user_profiles').upsert({
        id: authData.user.id,
        email: u.email,
        full_name: u.fullName,
        role: u.role,
        assigned_district_id: u.districtId,
      });

      results.push({
        email: u.email,
        id: authData.user.id,
        role: u.role,
        profileStatus: profileErr ? profileErr.message : 'Linked Successfully',
      });
    }

    return NextResponse.json({ success: true, seeded: results });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}