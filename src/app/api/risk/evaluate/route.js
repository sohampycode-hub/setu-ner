import { NextResponse } from 'next/server';
import { supabase } from '../../../../utils/supabase';

export async function POST() {
  try {
    // 1. Fetch geographic centroids for all 133 districts directly from PostGIS
    const { data: centroids, error: centroidErr } = await supabase.rpc('get_district_centroids');

    if (centroidErr || !centroids || centroids.length === 0) {
      return NextResponse.json(
        { success: false, error: centroidErr?.message || 'No district centroids found' },
        { status: 404 }
      );
    }

    // 2. Open-Meteo batch request supports up to ~100 locations per call.
    // Chunk district centroids into batches of 65.
    const chunkSize = 65;
    const districtMetrics = [];

    for (let i = 0; i < centroids.length; i += chunkSize) {
      const batch = centroids.slice(i, i + chunkSize);
      const lats = batch.map((c) => c.latitude.toFixed(4)).join(',');
      const lons = batch.map((c) => c.longitude.toFixed(4)).join(',');

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=precipitation,rain,wind_speed_10m`
      );

      if (!weatherRes.ok) continue;

      const weatherData = await weatherRes.json();
      // If batch size is 1, Open-Meteo returns an object; for multiple, it returns an array
      const weatherArray = Array.isArray(weatherData) ? weatherData : [weatherData];

      weatherArray.forEach((w, index) => {
        const district = batch[index];
        if (!district) return;

        const rainMm = Number(w?.current?.precipitation ?? 0.0);
        const windKm = Number(w?.current?.wind_speed_10m ?? 0.0);

        // District-specific Heuristic Hazard Engine:
        // Rain + High-Altitude Terrain Gradient Rules
        let riskScore = 10;
        let riskStatus = 'clear';

        if (rainMm > 20.0) {
          riskScore = 90;
          riskStatus = 'blocked';
        } else if (rainMm > 5.0) {
          riskScore = 55;
          riskStatus = 'at_risk';
        } else {
          // Terrain Vulnerability: Known high-altitude steep districts in NER
          const mountainousDistricts = [
            'North Sikkim', 'West Sikkim', 'Tawang', 'Upper Subansiri', 
            'East Kameng', 'West Kameng', 'Kurung Kumey', 'East Khasi Hills', 
            'West Khasi Hills', 'Churachandpur', 'Phek', 'Kiphire'
          ];

          if (mountainousDistricts.some((name) => district.name.includes(name))) {
            riskScore = 45;
            riskStatus = 'at_risk';
          }
        }

        districtMetrics.push({
          district_id: district.district_id,
          name: district.name,
          state: district.state,
          rainfall_mm: rainMm,
          risk_score: riskScore,
          risk_status: riskStatus,
        });
      });
    }

    // 3. Batch write district telemetry and propagate risk to highway segments inside each district
    const { data: updateRes, error: updateErr } = await supabase.rpc('update_district_telemetry', {
      p_district_metrics: districtMetrics,
    });

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      totalDistrictsEvaluated: districtMetrics.length,
      sampleSummary: districtMetrics.slice(0, 10),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}