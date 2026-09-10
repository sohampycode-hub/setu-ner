import { NextResponse } from 'next/server';
import osmtogeojson from 'osmtogeojson';
import { supabase } from '../../../../utils/supabase';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request) {
  try {
    const { targetState, allStates = false } = await request.json().catch(() => ({}));

    const remainingStates = [
      'Meghalaya',
      'Arunachal Pradesh',
      'Nagaland',
      'Manipur',
      'Mizoram',
      'Tripura',
      'Sikkim',
    ];

    const stateQueue = targetState
      ? [targetState]
      : allStates
      ? remainingStates
      : ['Meghalaya'];

    const executionSummary = [];
    let grandTotalInserted = 0;

    const mirrors = [
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];

    for (const state of stateQueue) {
      // Query National (trunk) and State Corridors (primary/secondary) for mountainous states
      const query = `
        [out:json][timeout:120];
        area["name"="${state}"]["admin_level"="4"]->.stateArea;
        (
          way["highway"~"trunk|primary|secondary"](area.stateArea);
        );
        out body;
        >;
        out skel qt;
      `;

      let osmData = null;
      for (const mirror of mirrors) {
        try {
          const res = await fetch(`${mirror}?data=${encodeURIComponent(query)}`, {
            headers: { 'User-Agent': 'SETU-NER-GovLogistics/1.0' },
          });
          if (res.ok) {
            osmData = await res.json();
            if (osmData?.elements?.length > 0) break;
          }
        } catch {
          // Fall back to next mirror
        }
      }

      if (!osmData || !osmData.elements || osmData.elements.length === 0) {
        executionSummary.push({ state, totalFound: 0, inserted: 0, status: 'no_data' });
        continue;
      }

      const geojson = osmtogeojson(osmData);
      const batchPayload = [];

      for (const feature of geojson.features) {
        if (!feature.geometry || feature.geometry.type !== 'LineString') continue;

        const roadName = feature.properties?.name || feature.properties?.ref || `${state} Corridor #${feature.id}`;
        const highwayType = feature.properties?.highway || 'primary';
        const osmId = feature.id.toString().replace(/\D/g, '') || Math.floor(Math.random() * 10000000);

        batchPayload.push({
          osm_id: osmId,
          name: roadName,
          highway_type: highwayType,
          state: state,
          geojson: feature.geometry,
        });
      }

      // Ingest in chunks of 250 records
      const chunkSize = 250;
      let stateInserted = 0;
      let stateFailed = 0;
      let stateError = 'none';

      for (let i = 0; i < batchPayload.length; i += chunkSize) {
        const chunk = batchPayload.slice(i, i + chunkSize);
        const { data: res, error } = await supabase.rpc('bulk_upsert_roads', {
          p_roads: chunk,
        });

        if (!error && res) {
          stateInserted += Number(res.inserted || 0);
          stateFailed += Number(res.failed || 0);
          if (res.error !== 'none') stateError = res.error;
        } else if (error) {
          stateError = error.message;
        }
      }

      grandTotalInserted += stateInserted;
      executionSummary.push({
        state,
        totalParsed: batchPayload.length,
        inserted: stateInserted,
        failed: stateFailed,
        error: stateError,
      });

      // 1.5 second throttle to avoid Overpass gateway rate limiting
      await sleep(1500);
    }

    return NextResponse.json({
      success: true,
      processedStates: stateQueue.length,
      grandTotalInserted,
      details: executionSummary,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message || 'Highway ingestion failure' },
      { status: 500 }
    );
  }
}