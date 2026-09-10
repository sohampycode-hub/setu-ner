import { NextResponse } from 'next/server';
import osmtogeojson from 'osmtogeojson';
import { supabase } from '../../../../utils/supabase';

function generateDistrictColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}

export async function POST(request) {
  try {
    const { stateName } = await request.json().catch(() => ({}));

    const nerStates = [
      'Assam',
      'Meghalaya',
      'Arunachal Pradesh',
      'Nagaland',
      'Manipur',
      'Mizoram',
      'Tripura',
      'Sikkim',
    ];

    const targetStates = stateName ? [stateName] : nerStates;
    let totalSaved = 0;
    const summaries = [];

    for (const state of targetStates) {
      // Query OSM Overpass with geom mode (full boundary coordinates, not bounding boxes)
      const query = `
        [out:json][timeout:90];
        area["name"="${state}"]["admin_level"="4"]->.stateArea;
        (
          relation["boundary"="administrative"]["admin_level"="5"](area.stateArea);
        );
        out body;
        >;
        out skel qt;
      `;

      const mirrors = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
      ];

      let osmData = null;
      for (const mirror of mirrors) {
        try {
          const res = await fetch(`${mirror}?data=${encodeURIComponent(query)}`, {
            headers: { 'User-Agent': 'SETU-NER-GovLogistics/1.0' },
          });
          if (res.ok) {
            osmData = await res.json();
            if (osmData?.elements?.length) break;
          }
        } catch {
          // Try next mirror
        }
      }

      if (!osmData || !osmData.elements) {
        summaries.push({ state, fetched: 0, saved: 0 });
        continue;
      }

      // Convert raw OSM relation topology into standard GeoJSON FeatureCollection
      const geojson = osmtogeojson(osmData);
      const batchPayload = [];

      for (const feature of geojson.features) {
        if (!feature.geometry || (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')) {
          continue;
        }

        const districtName = feature.properties?.name || feature.properties?.['name:en'] || `District #${feature.id}`;
        const osmId = feature.id.toString().replace(/\D/g, '') || Math.floor(Math.random() * 1000000);

        batchPayload.push({
          osm_id: osmId,
          name: districtName,
          state: state,
          color_hex: generateDistrictColor(districtName),
          geojson: feature.geometry,
        });
      }

      const { data: result, error } = await supabase.rpc('bulk_upsert_districts', {
        p_districts: batchPayload,
      });

      if (error) {
        summaries.push({ state, fetched: geojson.features.length, saved: 0, rpc_error: error.message });
      } else {
        const savedCount = Number(result?.inserted || 0);
        totalSaved += savedCount;
        summaries.push({
          state,
          fetched: geojson.features.length,
          saved: savedCount,
          failed: result?.failed || 0,
          db_error: result?.error || 'none',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Ingestion of non-overlapping district boundaries completed.',
      totalDistricts: totalSaved,
      stateBreakdown: summaries,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message || 'Ingestion failure' },
      { status: 500 }
    );
  }
}