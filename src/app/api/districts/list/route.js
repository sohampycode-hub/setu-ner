import { NextResponse } from 'next/server';
import { supabase } from '../../../../utils/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('districts')
      .select('id, name, state')
      .order('state', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, districts: data || [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}