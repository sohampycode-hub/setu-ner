'use client';

import { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Polyline,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Pin Icon for Waypoints A & B
const createPinIcon = (colorHex, label) =>
  L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${colorHex};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 800;
        font-size: 11px;
        font-family: sans-serif;
      ">
        ${label}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

// Vehicle Tracker Icon
const vehicleIcon = (heading = 0) =>
  L.divIcon({
    className: 'vehicle-div-icon',
    html: `
      <div style="
        transform: rotate(${heading}deg);
        transition: transform 0.25s linear;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: #0284c7;
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 10px rgba(2,132,199,0.8);
        font-size: 16px;
      ">
        ▲
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

// Tactical Pulsing Hazard Marker
const tacticalRadarHazardIcon = (type) => {
  let emoji = '⚠️';
  if (type === 'flash_flood') emoji = '🌊';
  else if (type === 'landslide') emoji = '⛰️';
  else if (type === 'road_collapse') emoji = '🚧';
  else if (type === 'fallen_tree') emoji = '🌲';
  else if (type === 'dense_fog') emoji = '🌫️';
  else if (type === 'waterlogging') emoji = '💧';
  else if (type === 'avalanche') emoji = '❄️';

  return L.divIcon({
    className: 'tactical-radar-marker',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <div class="radar-ping-ring" style="position: absolute; width: 36px; height: 36px; border-radius: 50%; border: 2px solid #ef4444; background: rgba(239, 68, 68, 0.25); pointer-events: none;"></div>
        <div class="radar-ping-delayed" style="position: absolute; width: 36px; height: 36px; border-radius: 50%; border: 2px solid #f97316; background: rgba(249, 115, 22, 0.15); pointer-events: none;"></div>
        <div style="
          position: relative;
          z-index: 2;
          background: #b91c1c;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid #ffffff;
          box-shadow: 0 0 10px rgba(185, 28, 28, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
        ">
          ${emoji}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

// Target Coordinate Crosshair
const targetCrosshairIcon = () =>
  L.divIcon({
    className: 'target-div-icon',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        border: 2px solid #0284c7;
        border-radius: 50%;
        background: rgba(2, 132, 199, 0.25);
        box-shadow: 0 0 8px rgba(2, 132, 199, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 6px; height: 6px; background: #0284c7; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

function MapCameraController({ bounds, livePosition, isNavigating, inspectedLocation }) {
  const map = useMap();
  const lastInspectedKeyRef = useRef(null);
  const lastBoundsKeyRef = useRef(null);

  useEffect(() => {
    if (inspectedLocation && inspectedLocation.timestamp !== lastInspectedKeyRef.current) {
      lastInspectedKeyRef.current = inspectedLocation.timestamp;
      map.panTo([Number(inspectedLocation.lat), Number(inspectedLocation.lng)], {
        animate: true,
        duration: 0.8,
      });
    }
  }, [inspectedLocation, map]);

  useEffect(() => {
    if (isNavigating && livePosition) {
      map.panTo([livePosition.lat, livePosition.lng], { animate: true, duration: 0.5 });
    }
  }, [isNavigating, livePosition, map]);

  useEffect(() => {
    if (!bounds || bounds.length < 2 || isNavigating) return;
    const boundsKey = `${bounds[0][0]},${bounds[0][1]}-${bounds[bounds.length - 1][0]},${bounds[bounds.length - 1][1]}`;

    if (boundsKey !== lastBoundsKeyRef.current) {
      lastBoundsKeyRef.current = boundsKey;
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [bounds, isNavigating, map]);

  return null;
}

function MapClickInterceptor({ waypointMode, onWaypointSet, onMapInspect }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      if (waypointMode) {
        onWaypointSet(lat, lng);
      } else if (onMapInspect) {
        onMapInspect(lat, lng);
      }
    },
  });
  return null;
}

export default function GisMap({
  mapKey = 0,
  roadSegments = [],
  districts = [],
  incidents = [],
  primaryRoute = null,
  alternativeRoute = null,
  selectedRouteKey = 'primary',
  onSelectRoute,
  routeWaypoints = { origin: null, destination: null },
  waypointMode = null,
  livePosition = null,
  isNavigating = false,
  inspectedLocation = null,
  onWaypointSet,
  onWaypointDrag,
  onMapInspect,
}) {
  const defaultCenter = [26.2006, 92.9376];
  const defaultZoom = 7;

  return (
    <div className="w-full h-full relative touch-pan-x touch-pan-y">
      <MapContainer
        key={mapKey}
        center={defaultCenter}
        zoom={defaultZoom}
        className="w-full h-full z-0"
        scrollWheelZoom={true}
        tap={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />

        <MapClickInterceptor
          waypointMode={waypointMode}
          onWaypointSet={onWaypointSet}
          onMapInspect={onMapInspect}
        />

        {/* District Vectors */}
        {districts.map((d) => {
          const geom = d.geojson || (typeof d.boundary === 'string' ? JSON.parse(d.boundary) : d.boundary);
          if (!geom) return null;
          return (
            <GeoJSON
              key={`dist-${d.id}`}
              data={{ type: 'Feature', geometry: geom, properties: { name: d.name, state: d.state } }}
              style={{
                color: d.color_hex || '#0284c7',
                weight: 1.2,
                opacity: 0.65,
                fillColor: d.color_hex || '#0284c7',
                fillOpacity: 0.04,
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  if (!waypointMode && onMapInspect) {
                    onMapInspect(e.latlng.lat, e.latlng.lng, d);
                  }
                },
              }}
            />
          );
        })}

        {/* Render 10,000 Road Corridors with Complete Risk Telemetry Popups */}
        {roadSegments.map((road) => {
          if (!road.coordinates || road.coordinates.length < 2) return null;

          const riskVal = Math.round(Number(road.risk_score) || 18);
          let color = '#22c55e'; // clear
          let weight = 2.5;

          if (road.status === 'blocked' || riskVal >= 75) {
            color = '#ef4444';
            weight = 4;
          } else if (road.status === 'at_risk' || riskVal >= 45) {
            color = '#f59e0b';
            weight = 3.5;
          }

          return (
            <Polyline
              key={road.uniqueKey}
              positions={road.coordinates}
              pathOptions={{
                color,
                weight,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            >
            <Popup>
              <div className="p-1 font-sans text-xs min-w-[200px] space-y-2">
              {/* 1. Roadway Name */}
                <div>
                  <h4 className="font-bold text-slate-900 text-sm leading-snug">
                    {road.name || 'Regional Corridor'}
                  </h4>
                </div>

              {/* 2. Roadway Type & Status */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Type</span>
                    <span className="font-mono text-slate-700 capitalize font-medium">
                      {road.highway_type || 'Primary'}
                    </span>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Status</span>
                    <span
                      className={`font-mono font-bold uppercase text-[9px] px-2 py-0.5 rounded border ${
                      road.status === 'blocked'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : road.status === 'at_risk'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                     >
                      {road.status || 'clear'}
                    </span>
                  </div>
                </div>

                {/* 3. Risk Index Score Bar */}
                <div className="pt-1.5 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Risk Index</span>
                    <span
                      className={`font-mono font-bold text-xs ${
                      (road.risk_score || 0) >= 70
                     ? 'text-rose-600'
                     : (road.risk_score || 0) >= 35
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                     }`}
                    >
                      {road.risk_score ?? 18} / 100
                     </span>
                   </div>
                 <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    (road.risk_score || 0) >= 70
                    ? 'bg-rose-500'
                    : (road.risk_score || 0) >= 35
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                   }`}
                  style={{ width: `${Math.min(100, road.risk_score ?? 18)}%` }}
                />
              </div>
             </div>
            </div>
          </Popup>
        </Polyline>
          );
        })}

        {/* Alternative Detour Polyline */}
        {alternativeRoute && alternativeRoute.coordinates && (
          <Polyline
            positions={alternativeRoute.coordinates}
            pathOptions={{
              color: selectedRouteKey === 'alternative' ? '#06b6d4' : '#64748b',
              weight: selectedRouteKey === 'alternative' ? 6 : 4,
              opacity: selectedRouteKey === 'alternative' ? 0.95 : 0.45,
              dashArray: '6, 8',
            }}
            eventHandlers={{
              click: () => onSelectRoute && onSelectRoute('alternative'),
            }}
          />
        )}

        {/* Primary Safe Route Polyline */}
        {primaryRoute && primaryRoute.coordinates && (
          <Polyline
            positions={primaryRoute.coordinates}
            pathOptions={{
              color: selectedRouteKey === 'primary' ? '#0284c7' : '#94a3b8',
              weight: selectedRouteKey === 'primary' ? 6 : 4,
              opacity: selectedRouteKey === 'primary' ? 0.95 : 0.45,
            }}
            eventHandlers={{
              click: () => onSelectRoute && onSelectRoute('primary'),
            }}
          />
        )}

        {/* Verified Incidents with Clean Pulsing Radar Marker */}
        {incidents &&
          incidents
            // Ignore resolved records from active map rendering
            .filter((inc) => inc.status !== 'resolved')
            .map((inc) => {
              const isPending = inc.status === 'pending';

              return (
                <Marker
                  key={`hazard-${inc.id}`}
                  position={[Number(inc.latitude), Number(inc.longitude)]}
                  icon={tacticalRadarHazardIcon(inc.hazard_type)}
                >
                  <Popup>
                    <div className="font-sans text-xs min-w-[170px] space-y-1">
                      {/* Status Indicator Badge */}
                      <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
                        <div
                          className={`flex items-center space-x-1.5 font-bold uppercase text-[9px] ${
                            isPending ? 'text-amber-700' : 'text-rose-700'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isPending ? 'bg-amber-500' : 'bg-rose-600 animate-ping'
                            }`}
                          />
                          <span>{isPending ? 'Pending Inspection' : 'Active Verified Hazard'}</span>
                        </div>

                        <span
                          className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded font-bold border ${
                            isPending
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          {inc.status || 'pending'}
                        </span>
                      </div>

                      {/* Hazard Details */}
                      <p className="font-bold text-slate-900 capitalize text-sm pt-0.5">
                        {(inc.hazard_type || 'Hazard').replace('_', ' ')}
                      </p>

                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        {inc.description || 'No detailed advisory provided.'}
                      </p>

                      {/* Incident Photo Proof */}
                      {inc.photo_url && (
                        <img
                          src={inc.photo_url}
                          alt="Hazard Evidence"
                          className="w-full h-24 object-cover rounded mt-2 border border-slate-200"
                        />
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

        {/* Origin Draggable Waypoint */}
        {routeWaypoints?.origin && (
          <Marker
            position={[routeWaypoints.origin.lat, routeWaypoints.origin.lng]}
            icon={createPinIcon('#0284c7', 'A')}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                if (onWaypointDrag) onWaypointDrag('origin', lat, lng);
              },
            }}
          />
        )}

        {/* Destination Draggable Waypoint */}
        {routeWaypoints?.destination && (
          <Marker
            position={[routeWaypoints.destination.lat, routeWaypoints.destination.lng]}
            icon={createPinIcon('#0f172a', 'B')}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                if (onWaypointDrag) onWaypointDrag('destination', lat, lng);
              },
            }}
          />
        )}

        {/* Target Crosshair Marker on Inspected Coordinate */}
        {inspectedLocation && inspectedLocation.lat && inspectedLocation.lng && (
          <Marker
            position={[Number(inspectedLocation.lat), Number(inspectedLocation.lng)]}
            icon={targetCrosshairIcon()}
          />
        )}

        {/* Live Vehicle Marker */}
        {livePosition && (
          <Marker
            position={[livePosition.lat, livePosition.lng]}
            icon={vehicleIcon(livePosition.heading)}
            zIndexOffset={1000}
          />
        )}

        <MapCameraController
          bounds={
            primaryRoute?.coordinates?.length >= 2
              ? primaryRoute.coordinates
              : routeWaypoints?.origin && routeWaypoints?.destination
              ? [
                  [routeWaypoints.origin.lat, routeWaypoints.origin.lng],
                  [routeWaypoints.destination.lat, routeWaypoints.destination.lng],
                ]
              : null
          }
          livePosition={livePosition}
          isNavigating={isNavigating}
          inspectedLocation={inspectedLocation}
        />
      </MapContainer>
    </div>
  );
}