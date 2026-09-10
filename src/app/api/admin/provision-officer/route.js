import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role client to create auth users directly without email verification
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { fullName, email, password, role, districtId } = body;

    if (!fullName || !email || !password || !role || !districtId) {
      return NextResponse.json(
        { success: false, error: 'All fields (Name, Email, Password, Role, District) are mandatory.' },
        { status: 400 }
      );
    }

    // 1. Strict DLO Uniqueness check before creating user
    if (role === 'dlo') {
      const { data: existingDlo } = await supabaseAdmin
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('role', 'dlo')
        .eq('assigned_district_id', districtId)
        .maybeSingle();

      if (existingDlo) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Jurisdiction Conflict: Officer "${existingDlo.full_name}" is already designated as the sole DLO for this district.` 
          },
          { status: 409 }
        );
      }
    }

    // 2. Create the credentials directly in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });

    if (authError) throw authError;

    // 3. Upsert the authorized profile in user_profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: authData.user.id,
        full_name: fullName,
        email,
        role,
        assigned_district_id: districtId,
        approval_status: 'approved',
      })
      .select()
      .single();

    if (profileError) throw profileError;

    return NextResponse.json({
      success: true,
      message: `Personnel successfully provisioned as ${role.toUpperCase()}.`,
      user: profile,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}