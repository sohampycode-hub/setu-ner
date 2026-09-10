import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

// GET: Return all accounts waiting for approval
export async function GET() {
  try {
    const { data: pendingUsers, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, role, assigned_district_id, approval_status, created_at')
      .eq('approval_status', 'pending_approval')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      pendingUsers: pendingUsers || [],
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// PATCH: Approve or Reject a user account
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { userId, decision } = body;

    if (!userId || !['approve', 'reject'].includes(decision)) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters provided.' },
        { status: 400 }
      );
    }

    const nextStatus = decision === 'approve' ? 'approved' : 'rejected';

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ approval_status: nextStatus })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      user: data,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}