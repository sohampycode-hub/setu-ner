'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default Leaflet icon assets
const pickerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Helper component to capture click events directly on the Leaflet canvas
function MapClickHandler({ onSelectLocation }) {
  useMapEvents({
    click(e) {
      onSelectLocation(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPickerMap({ selectedLat, selectedLng, onSelectLocation }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#f8fafc] text-xs font-mono text-slate-500">
        Loading Incident Map Interface...
      </div>
    );
  }

  // Centered on Northeast India
  const center = selectedLat && selectedLng 
    ? [parseFloat(selectedLat), parseFloat(selectedLng)] 
    : [26.1445, 91.7362];

  return (
    <div className="h-full w-full border border-[#cbd5e1] rounded-xs relative">
      <MapContainer
        center={center}
        zoom={selectedLat && selectedLng ? 12 : 7}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onSelectLocation={onSelectLocation} />

        {selectedLat && selectedLng && (
          <Marker position={[parseFloat(selectedLat), parseFloat(selectedLng)]} icon={pickerIcon} />
        )}
      </MapContainer>
    </div>
  );
}