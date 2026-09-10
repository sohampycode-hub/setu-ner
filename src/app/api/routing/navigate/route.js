import { NextResponse } from 'next/server';
import { supabase } from '../../../../utils/supabase';

function formatCoordinates(geometry) {
  if (!geometry || !geometry.coordinates) return [];
  return geometry.coordinates.map((pt) => [pt[1], pt[0]]);
}

function isPointInBangladesh(lat, lng) {
  if (lat >= 21.6 && lat <= 25.15 && lng >= 88.3 && lng <= 91.85) {
    const isTripura = lat >= 22.95 && lat <= 24.55 && lng >= 91.15 && lng <= 92.45;
    const isMeghalaya = lat >= 25.1 && lat <= 26.1 && lng >= 89.8 && lng <= 92.8;
    const isBarakMizoram = lat >= 21.9 && lat <= 25.1 && lng >= 92.2 && lng <= 93.5;

    if (!isTripura && !isMeghalaya && !isBarakMizoram) {
      return true;
    }
  }
  return false;
}

// NER Mode-Specific Speed Matrix
const VEHICLE_SPEED_PROFILES = {
  car: { clear: 46.0, risk: 36.0, label: 'Private Car', icon: '🚗' },
  bike: { clear: 42.0, risk: 30.0, label: 'Motorbike', icon: '🏍️' },
  bus: { clear: 34.0, risk: 25.0, label: 'Public Bus', icon: '🚌' },
  truck: { clear: 30.0, risk: 22.0, label: 'Heavy Truck', icon: '🚛' },
  auto: { clear: 26.0, risk: 18.0, label: '3-Wheeler Auto', icon: '🛺' },
};

function calculateRealisticDuration(distanceKm, vehicleType = 'car', hasWeatherRisk = false) {
  const profile = VEHICLE_SPEED_PROFILES[vehicleType] || VEHICLE_SPEED_PROFILES.car;
  const speedKmh = hasWeatherRisk ? profile.risk : profile.clear;
  const totalHours = distanceKm / speedKmh;
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);

  return {
    rawHours: Number(totalHours.toFixed(1)),
    formatted: hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`,
    appliedSpeedKmh: speedKmh,
    vehicleLabel: profile.label,
  };
}

function parseSteps(route) {
  const steps = [];
  const leg = route.legs?.[0];
  if (leg?.steps) {
    leg.steps.forEach((st, sIdx) => {
      if (!st.maneuver) return;
      const roadName = st.name || st.ref || 'Indian Trunk Highway';
      const distMeters = st.distance;
      const distKm = distMeters > 1000 ? `${(distMeters / 1000).toFixed(1)} km` : `${Math.round(distMeters)} m`;

      let instruction = '';
      const type = st.maneuver.type;
      const modifier = st.maneuver.modifier || '';

      if (type === 'depart') instruction = `Depart heading ${modifier || 'forward'} onto ${roadName}`;
      else if (type === 'turn') instruction = `Turn ${modifier} onto ${roadName}`;
      else if (type === 'new name') instruction = `Continue along ${roadName}`;
      else if (type === 'arrive') instruction = `Arrive at destination sector`;
      else instruction = `${type.replace('_', ' ')} ${modifier ? `(${modifier})` : ''} on ${roadName}`;

      steps.push({
        id: sIdx + 1,
        instruction,
        roadName,
        distance: distKm,
        rawDistance: distMeters,
        maneuverType: type,
      });
    });
  }
  return steps.filter((s) => s.rawDistance > 20 || s.maneuverType === 'arrive');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { startLat, startLng, endLat, endLng, avoidLat, avoidLng, vehicleType = 'car' } = body;

    if (!startLat || !startLng || !endLat || !endLng) {
      return NextResponse.json(
        { success: false, error: 'Origin and destination coordinates are required.' },
        { status: 400 }
      );
    }

    const { data: activeIncidents } = await supabase
      .from('incident_reports')
      .select('id, hazard_type, latitude, longitude, description, severity')
      .eq('status', 'verified');

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true&alternatives=true`;
    const osrmRes = await fetch(osrmUrl, { headers: { 'User-Agent': 'SETU-NER-Logistics/1.0' } });
    const osrmData = await osrmRes.json();

    if (!osrmData || osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Could not compute road trajectory between these points.' },
        { status: 404 }
      );
    }

    let validRoutes = osrmData.routes.filter((r) => {
      const coords = formatCoordinates(r.geometry);
      return !coords.some(([lat, lng]) => isPointInBangladesh(lat, lng));
    });

    if (validRoutes.length === 0) {
      validRoutes = [osrmData.routes[0]];
    }

    const mapRouteToPayload = (r, id, isPrimary) => {
      const lineCoords = formatCoordinates(r.geometry);
      const totalDistKm = Number((r.distance / 1000).toFixed(1));

      const hitBlockages = [];
      if (activeIncidents && activeIncidents.length > 0) {
        for (const inc of activeIncidents) {
          const isNear = lineCoords.some(([lat, lng]) => {
            return Math.abs(lat - inc.latitude) < 0.018 && Math.abs(lng - inc.longitude) < 0.018;
          });
          if (isNear) {
            hitBlockages.push({
              id: inc.id,
              hazardType: inc.hazard_type.replace('_', ' ').toUpperCase(),
              description: inc.description,
              latitude: inc.latitude,
              longitude: inc.longitude,
            });
          }
        }
      }

      const durationInfo = calculateRealisticDuration(totalDistKm, vehicleType, hitBlockages.length > 0);

      return {
        id,
        isPrimary,
        totalDistanceKm: totalDistKm,
        estimatedDurationFormatted: durationInfo.formatted,
        estimatedHoursRaw: durationInfo.rawHours,
        appliedSpeedKmh: durationInfo.appliedSpeedKmh,
        vehicleLabel: durationInfo.vehicleLabel,
        vehicleType,
        blockedCount: hitBlockages.length,
        blockagesEncountered: hitBlockages,
        status: hitBlockages.length > 0 ? 'blocked' : 'clear',
        coordinates: lineCoords,
        steps: parseSteps(r),
      };
    };

    let safeRoute = mapRouteToPayload(validRoutes[0], 1, true);
    let alternativeRoute = validRoutes.length > 1 ? mapRouteToPayload(validRoutes[1], 2, false) : null;

    if (!alternativeRoute || (avoidLat && avoidLng)) {
      try {
        let detourLat, detourLng;

        if (avoidLat && avoidLng) {
          detourLat = Number(avoidLat) + 0.15;
          detourLng = Number(avoidLng) + 0.15;
        } else {
          const midLat = (Number(startLat) + Number(endLat)) / 2;
          const midLng = (Number(startLng) + Number(endLng)) / 2;
          const dLat = Number(endLat) - Number(startLat);
          const dLng = Number(endLng) - Number(startLng);

          detourLat = midLat - dLng * 0.25;
          detourLng = midLng + dLat * 0.25;
        }

        if (!isPointInBangladesh(detourLat, detourLng)) {
          const detourUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${detourLng},${detourLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
          const detourRes = await fetch(detourUrl, { headers: { 'User-Agent': 'SETU-NER-Logistics/1.0' } });
          const detourData = await detourRes.json();

          if (detourData?.routes?.[0]) {
            const detourCoords = formatCoordinates(detourData.routes[0].geometry);
            if (!detourCoords.some(([lat, lng]) => isPointInBangladesh(lat, lng))) {
              if (avoidLat && avoidLng) {
                safeRoute = mapRouteToPayload(detourData.routes[0], 1, true);
              } else {
                alternativeRoute = mapRouteToPayload(detourData.routes[0], 2, false);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Detour calculation notice:', err.message);
      }
    }

    return NextResponse.json({
      success: true,
      safeRoute,
      alternativeRoute,
      vehicleType,
    });
  } catch (err) {
    console.error('Routing API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}