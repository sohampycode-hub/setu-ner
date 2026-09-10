'use client';

import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Polyline,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// SVG Hazard Pin
const hazardIcon = (type) => {
  let emoji = '⚠️';
  if (type === 'flash_flood') emoji = '🌊';
  else if (type === 'landslide') emoji = '⛰️';
  else if (type === 'road_collapse') emoji = '🚧';
  else if (type === 'fallen_tree') emoji = '🌲';
  else if (type === 'dense_fog') emoji = '🌫️';
  else if (type === 'waterlogging') emoji = '💧';
  else if (type === 'avalanche') emoji = '❄️';

  return L.divIcon({
    className: 'hazard-div-icon',
    html: `
      <div style="
        background-color: #e11d48;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 0 8px rgba(225,29,72,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      ">
        ${emoji}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

// Auto-Fit Bounds to District Boundary
function DistrictBoundaryFitter({ targetDistrict }) {
  const map = useMap();

  useEffect(() => {
    if (!targetDistrict) return;
    const geom =
      targetDistrict.geojson ||
      (typeof targetDistrict.boundary === 'string'
        ? JSON.parse(targetDistrict.boundary)
        : targetDistrict.boundary);

    if (!geom || !geom.coordinates) return;

    try {
      const geoJsonLayer = L.geoJSON(geom);
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
      }
    } catch (err) {
      console.warn('Auto-fit bounds exception:', err);
    }
  }, [targetDistrict, map]);

  return null;
}

export default function DistrictMap({
  targetDistrict = null,
  allDistricts = [],
  roadSegments = [],
  incidents = [],
}) {
  const defaultCenter = [26.2006, 92.9376];

  // Separate the assigned district from surrounding districts
  const surroundingDistricts = useMemo(() => {
    if (!targetDistrict) return allDistricts;
    return allDistricts.filter((d) => d.id !== targetDistrict.id);
  }, [allDistricts, targetDistrict]);

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={defaultCenter}
        zoom={9}
        className="w-full h-full z-0"
        scrollWheelZoom={true}
        tap={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />

        {/* Dimmed Surrounding Districts */}
        {surroundingDistricts.map((d) => {
          const geom =
            d.geojson ||
            (typeof d.boundary === 'string' ? JSON.parse(d.boundary) : d.boundary);
          if (!geom) return null;
          return (
            <GeoJSON
              key={`dim-${d.id}`}
              data={{ type: 'Feature', geometry: geom }}
              style={{
                color: '#94a3b8',
                weight: 1,
                opacity: 0.35,
                fillColor: '#64748b',
                fillOpacity: 0.08,
              }}
            />
          );
        })}

        {/* Target Officer District Polygon (Highlighted) */}
        {targetDistrict && (() => {
          const geom =
            targetDistrict.geojson ||
            (typeof targetDistrict.boundary === 'string'
              ? JSON.parse(targetDistrict.boundary)
              : targetDistrict.boundary);
          if (!geom) return null;
          return (
            <GeoJSON
              key={`target-${targetDistrict.id}`}
              data={{ type: 'Feature', geometry: geom }}
              style={{
                color: '#0284c7',
                weight: 3,
                opacity: 0.95,
                fillColor: '#0284c7',
                fillOpacity: 0.18,
                dashArray: '4, 4',
              }}
            />
          );
        })()}

        {/* Road Networks */}
        {roadSegments.map((road, idx) => {
          let color = '#22c55e';
          let weight = 2.5;
          if (road.status === 'blocked') {
            color = '#ef4444';
            weight = 4;
          } else if (road.status === 'at_risk') {
            color = '#f59e0b';
            weight = 3.5;
          }

          return (
            <Polyline
              key={`road-${road.id || idx}`}
              positions={road.coordinates}
              pathOptions={{ color, weight, opacity: 0.8 }}
            >
              <Popup>
                <div className="font-sans text-xs min-w-[150px]">
                  <span
                    className={`font-bold uppercase text-[9px] px-1.5 py-0.5 rounded block mb-1 ${
                      road.status === 'blocked'
                        ? 'bg-red-100 text-red-800'
                        : road.status === 'at_risk'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {road.status ? road.status.replace('_', ' ') : 'CLEAR'}
                  </span>
                  <p className="font-bold text-slate-900 text-sm">{road.name || 'Highway Corridor'}</p>
                  <p className="text-[11px] text-slate-500 capitalize">{road.highway || 'Trunk / NH'}</p>
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* Incident Alerts Pins */}
        {incidents.map((inc) => (
          <Marker
            key={`hazard-${inc.id}`}
            position={[Number(inc.latitude), Number(inc.longitude)]}
            icon={hazardIcon(inc.hazard_type)}
          >
            <Popup>
              <div className="font-sans text-xs min-w-[150px]">
                <span className="font-bold text-rose-700 uppercase text-[9px] block">
                  {inc.status === 'pending' ? 'Pending Citizen Advisory' : 'Verified Blockage'}
                </span>
                <p className="font-bold text-slate-900 capitalize text-sm">
                  {inc.hazard_type.replace('_', ' ')}
                </p>
                <p className="text-slate-600 text-[11px] mt-1">{inc.description}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        <DistrictBoundaryFitter targetDistrict={targetDistrict} />
      </MapContainer>
    </div>
  );
}