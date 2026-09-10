import { NextResponse } from 'next/server';
import osmtogeojson from 'osmtogeojson';
import { supabase } from '../../../../utils/supabase';

export async function POST(request) {
  try {
    const { districtQuery = 'Kamrup Metropolitan', state = 'Assam', colorHex = '#1d4ed8' } = await request.json().catch(() => ({}));

    // Explicit Overpass query: fetches administrative relation, all member ways, and coordinate nodes
    const query = `
      [out:json][timeout:120];
      relation["boundary"="administrative"]["name"~"${districtQuery}",i];
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
          if (osmData?.elements?.length > 0) break;
        }
      } catch {
        // Try fallback mirror
      }
    }

    if (!osmData || !osmData.elements || osmData.elements.length === 0) {
      return NextResponse.json(
        { success: false, error: `No OSM administrative relation found for "${districtQuery}".` },
        { status: 404 }
      );
    }

    // Convert raw ways/nodes into stitched topological MultiPolygon GeoJSON
    const geojson = osmtogeojson(osmData);

    // Find the primary polygon feature that represents the district boundary
    const districtFeature = geojson.features.find(
      (f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
    );

    if (!districtFeature) {
      return NextResponse.json(
        { success: false, error: 'Failed to construct a valid polygon from OSM relation members.' },
        { status: 422 }
      );
    }

    const officialName = districtFeature.properties?.name || districtFeature.properties?.['name:en'] || districtQuery;
    const osmId = districtFeature.id ? districtFeature.id.toString().replace(/\D/g, '') : '1951374';

    // Upsert via existing bulk_upsert_districts RPC (which uses ST_MakeValid and ST_SimplifyPreserveTopology)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('bulk_upsert_districts', {
      p_districts: [
        {
          osm_id: osmId,
          name: officialName,
          state: state,
          color_hex: colorHex,
          geojson: districtFeature.geometry,
        },
      ],
    });

    if (rpcError) {
      return NextResponse.json({ success: false, error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      district: officialName,
      osm_id: osmId,
      geometryType: districtFeature.geometry.type,
      databaseResult: rpcResult,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error executing exact boundary ingestion' },
      { status: 500 }
    );
  }
}