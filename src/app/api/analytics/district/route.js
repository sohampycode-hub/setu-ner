import { NextResponse } from 'next/server';
import { supabase } from '../../../../utils/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const districtId = searchParams.get('districtId');

    if (!districtId) {
      return NextResponse.json({ success: false, error: 'District ID required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('get_district_analytics', {
      p_district_id: districtId,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}