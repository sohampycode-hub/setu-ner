import { NextResponse } from 'next/server';
import { supabase } from '../../../../utils/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const districtId = searchParams.get('districtId');

    let query = supabase
      .from('machinery_requisitions')
      .select(`
        id,
        resource_type,
        quantity,
        priority,
        requisition_status,
        authorized_by,
        created_at,
        source_district_id,
        target_district_id
      `)
      .order('created_at', { ascending: false });

    // If a DLO passes their districtId, return dispatches where they are either sender or receiver
    if (districtId) {
      query = query.or(`source_district_id.eq.${districtId},target_district_id.eq.${districtId}`);
    }

    const { data: rawList, error } = await query;
    if (error) throw error;

    // Fetch district names to populate relations cleanly
    const { data: districts } = await supabase
      .from('districts')
      .select('id, name, state');

    const distMap = new Map((districts || []).map((d) => [String(d.id), d]));

    const enriched = (rawList || []).map((req) => ({
      ...req,
      source_district: distMap.get(String(req.source_district_id)) || { name: 'Regional Stockpile' },
      target_district: distMap.get(String(req.target_district_id)) || { name: 'Affected Sector' },
    }));

    return NextResponse.json({ success: true, requisitions: enriched });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { sourceDistrictId, targetDistrictId, resourceType, quantity, authorizedBy, priority } = body;

    if (!sourceDistrictId || !targetDistrictId || !resourceType) {
      return NextResponse.json(
        { success: false, error: 'Source, Target, and Resource Type are required.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('machinery_requisitions')
      .insert([
        {
          source_district_id: String(sourceDistrictId),
          target_district_id: String(targetDistrictId),
          resource_type: resourceType,
          quantity: Number(quantity) || 1,
          authorized_by: authorizedBy || 'MDoNER National Apex Desk',
          priority: priority || 'critical_emergency',
          requisition_status: 'en_route',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, requisition: data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}