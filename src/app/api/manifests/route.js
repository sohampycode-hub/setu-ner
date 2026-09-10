import { NextResponse } from 'next/server';
import { supabase } from '../../../utils/supabase';

// GET: Fetch recent transit manifests (latest 50)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const { data: manifests, error } = await supabase
      .from('transit_manifests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      manifests: manifests || [],
    });
  } catch (err) {
    console.error('Failed to fetch manifests:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Save and log a newly generated transit manifest
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      manifestCode,
      vehicleType,
      originName,
      destinationName,
      totalDistanceKm,
      estimatedDuration,
      appliedSpeedKmh,
      blockedHazardsCount,
      weatherSnapshot,
      itinerarySteps,
      issuedBy,
    } = body;

    if (!manifestCode || !originName || !destinationName) {
      return NextResponse.json(
        { success: false, error: 'Manifest code, origin, and destination are required.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('transit_manifests')
      .insert({
        manifest_code: manifestCode,
        vehicle_type: vehicleType || 'car',
        origin_name: originName,
        destination_name: destinationName,
        total_distance_km: Number(totalDistanceKm) || 0,
        estimated_duration: estimatedDuration || 'N/A',
        applied_speed_kmh: Number(appliedSpeedKmh) || 38,
        blocked_hazards_count: Number(blockedHazardsCount) || 0,
        weather_snapshot: weatherSnapshot || null,
        itinerary_steps: itinerarySteps || [],
        issued_by: issuedBy || 'Citizen / Logistics Coordinator',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, manifest: data });
  } catch (err) {
    console.error('Failed to log manifest:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}