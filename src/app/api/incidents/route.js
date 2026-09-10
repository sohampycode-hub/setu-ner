import { NextResponse } from 'next/server';
import { supabase } from '../../../utils/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter'); // 'verified' | 'pending' | 'resolved' | 'all' | null
    const districtId = searchParams.get('districtId');

    let query;

    if (districtId) {
      // 1. PostGIS Spatial RPC
      const { data: spatialData, error: spatialErr } = await supabase.rpc(
        'get_incidents_by_district',
        { p_district_id: districtId }
      );

      if (!spatialErr && spatialData && spatialData.length > 0) {
        // Pending tally in this district
        const pendingCount = spatialData.filter((i) => i.status === 'pending').length;

        let filtered = spatialData;
        if (filter === 'verified') {
          filtered = filtered.filter((i) => i.status === 'verified');
        } else if (filter === 'pending') {
          filtered = filtered.filter((i) => i.status === 'pending');
        } else if (filter === 'resolved') {
          filtered = filtered.filter((i) => i.status === 'resolved');
        } else {
          // ACTIVE ONLY: ignore resolved incidents for map rendering
          filtered = filtered.filter((i) => i.status === 'verified' || i.status === 'pending');
        }

        return NextResponse.json({
          success: true,
          data: filtered,
          incidents: filtered,
          pendingCount,
        });
      }

      // 2. District Name Fallback
      const { data: distRec } = await supabase
        .from('districts')
        .select('name')
        .eq('id', districtId)
        .single();

      query = supabase.from('incident_reports').select('*').order('created_at', { ascending: false });

      if (distRec?.name) {
        query = query.ilike('description', `%${distRec.name}%`);
      }

      const { data: rawFallback, error: fbErr } = await query;
      if (!fbErr && rawFallback) {
        const pendingCount = rawFallback.filter((i) => i.status === 'pending').length;

        let filtered = rawFallback;
        if (filter === 'verified') {
          filtered = filtered.filter((i) => i.status === 'verified');
        } else if (filter === 'pending') {
          filtered = filtered.filter((i) => i.status === 'pending');
        } else if (filter === 'resolved') {
          filtered = filtered.filter((i) => i.status === 'resolved');
        } else {
          // ACTIVE ONLY
          filtered = filtered.filter((i) => i.status === 'verified' || i.status === 'pending');
        }

        return NextResponse.json({
          success: true,
          data: filtered,
          incidents: filtered,
          pendingCount,
        });
      }
    }

    // 3. Global Fetch (Citizen Radar & Overview Map)
    const { data: allReports, error } = await supabase
      .from('incident_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rawList = allReports || [];
    const totalPendingCount = rawList.filter((i) => i.status === 'pending').length;
    const totalResolvedCount = rawList.filter((i) => i.status === 'resolved').length;
    const totalReportsCount = rawList.length;

    let results = rawList;
    if (filter === 'verified') {
      results = results.filter((i) => i.status === 'verified');
    } else if (filter === 'pending') {
      results = results.filter((i) => i.status === 'pending');
    } else if (filter === 'resolved') {
      results = results.filter((i) => i.status === 'resolved');
    } else {
      // DEFAULT / 'all': Strip out resolved rows so maps only display active threats!
      results = results.filter((i) => i.status === 'verified' || i.status === 'pending');
    }

    return NextResponse.json({
      success: true,
      data: results,
      incidents: results,
      pendingCount: totalPendingCount,
      resolvedCount: totalResolvedCount,
      totalCount: totalReportsCount,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { hazardType, severity, description, latitude, longitude, radiusMeters, userRole, photoUrl } = body;

    if (!hazardType || !latitude || !longitude) {
      return NextResponse.json({ success: false, error: 'Missing required incident parameters' }, { status: 400 });
    }

    const initialStatus = userRole === 'officer' || userRole === 'dlo' ? 'verified' : 'pending';

    const { data, error } = await supabase.from('incident_reports').insert({
      hazard_type: hazardType,
      severity: severity || 'critical_blocked',
      description: description || 'Hazard reported on regional corridor',
      latitude: Number(latitude),
      longitude: Number(longitude),
      radius_meters: radiusMeters || 2500,
      photo_url: photoUrl || null,
      status: initialStatus,
      verified_at: initialStatus === 'verified' ? new Date().toISOString() : null,
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ success: true, data, incident: data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { incidentId, action } = body;

    if (!incidentId || !action) {
      return NextResponse.json({ success: false, error: 'Missing incidentId or action' }, { status: 400 });
    }

    let updatePayload = {};
    if (action === 'verify') {
      updatePayload = { status: 'verified', verified_at: new Date().toISOString() };
    } else if (action === 'resolve') {
      updatePayload = { status: 'resolved', resolved_at: new Date().toISOString() };
    } else if (action === 'reject') {
      updatePayload = { status: 'rejected' };
    } else {
      return NextResponse.json({ success: false, error: 'Invalid moderation action' }, { status: 400 });
    }

    // Try primary update
    let { data, error } = await supabase
      .from('incident_reports')
      .update(updatePayload)
      .eq('id', incidentId)
      .select()
      .single();

    // Fallback: if resolved_at is not present in the table schema, update status only
    if (error && error.message?.includes('resolved_at')) {
      const fallback = await supabase
        .from('incident_reports')
        .update({ status: 'resolved' })
        .eq('id', incidentId)
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return NextResponse.json({ success: true, incident: data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}