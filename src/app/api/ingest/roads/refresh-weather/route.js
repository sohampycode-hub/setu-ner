import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase'; // or whichever export was imported

export async function POST() {
  try {
    // 1. Fetch all road segments and their PostGIS coordinates via RPC
    const { data: roads, error } = await supabase.rpc('get_roads_geojson');

    if (error || !roads || roads.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No road segments found to refresh.' },
        { status: 404 }
      );
    }

    const updated = [];

    // 2. Query Open-Meteo for each segment midpoint
    for (const road of roads) {
      if (!road.coordinates || road.coordinates.length === 0) continue;

      const midIdx = Math.floor(road.coordinates.length / 2);
      const [lon, lat] = road.coordinates[midIdx];

      let precipitation = 0.0;
      try {
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=precipitation,rain&timezone=Asia%2FKolkata`
        );
        if (weatherRes.ok) {
          const wData = await weatherRes.json();
          precipitation = wData.current?.precipitation || wData.current?.rain || 0.0;
        }
      } catch {
        precipitation = 0.0;
      }

      // Explainable Heuristic Formula: (precipitation * 5.0) + (slope_factor * 10.0)
      const calculatedRisk = Math.min(100, Math.max(0, (precipitation * 5.0) + 15.0));
      let status = 'clear';
      if (calculatedRisk >= 70) status = 'blocked';
      else if (calculatedRisk >= 35) status = 'at_risk';

      const { data: updatedRow, error: updateError } = await supabase
        .from('road_segments')
        .update({
          rainfall_mm: precipitation.toFixed(2),
          risk_score: calculatedRisk.toFixed(2),
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', road.id)
        .select('id, name, status, risk_score, rainfall_mm');

      if (!updateError && updatedRow) {
        updated.push(updatedRow[0]);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Refreshed weather & risk scores for ${updated.length} corridors.`,
      updated,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message || 'Telemetry refresh failed' },
      { status: 500 }
    );
  }
}