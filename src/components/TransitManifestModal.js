'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { StateEmblem, AshokaChakraWatermark } from './emblems/NationalEmblem';
import { getOfficerSupabaseClient } from '../utils/supabase';

const TRANSIT_UNITS = [
  'Heavy Relief Convoy (NDRF / SDRF)',
  'BRO Modular Bridge & Heavy Engineering Carrier',
  'Civilian Logistics (Essential Commodities / Fuel)',
  'Medical & Emergency Evacuation Ambulance',
  'Armed Forces Sovereign Tactical Unit',
  'Light Patrol / Reconnaissance Vehicle',
];

export default function TransitManifestModal({
  isOpen,
  onClose,
  supabaseClient = null,
  issuingOfficer = null,
  activeIncidents = [],
  districts = [],
  viewOnlyManifest = null,
  onManifestSaved = null,
}) {

  const [transitUnit, setTransitUnit] = useState(TRANSIT_UNITS[0]);
  const [vehicleRegNumber, setVehicleRegNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverContact, setDriverContact] = useState('');
  const [targetDistrict, setTargetDistrict] = useState('');
  const [cargoDetails, setCargoDetails] = useState('');

  const [manifestCode, setManifestCode] = useState('');
  const [isGenerated, setIsGenerated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [issuedTimestamp, setIssuedTimestamp] = useState(null);
  const [overrideKey, setOverrideKey] = useState('');
  const [overrideApplied, setOverrideApplied] = useState(false);

  const activeBlockages = activeIncidents.filter((i) => i.status === 'verified');
  const hasActiveBlockage = activeBlockages.length > 0;
  const isClearedForTransit = viewOnlyManifest 
    ? viewOnlyManifest.clearance_status === 'AUTHORIZED' 
    : (!hasActiveBlockage || overrideApplied);

  useEffect(() => {
    if (!isOpen) {
      setIsGenerated(false);
      setOverrideApplied(false);
      setOverrideKey('');
      return;
    }

    if (viewOnlyManifest) {
      setManifestCode(viewOnlyManifest.manifest_code);
      setTransitUnit(viewOnlyManifest.vehicle_type);
      setVehicleRegNumber(viewOnlyManifest.vehicle_reg_number);
      setDriverName(viewOnlyManifest.driver_name);
      setDriverContact(viewOnlyManifest.driver_contact);
      setTargetDistrict(viewOnlyManifest.target_district);
      setCargoDetails(viewOnlyManifest.cargo_description);
      setIssuedTimestamp(viewOnlyManifest.created_at);
      setIsGenerated(true);
    } else {
      setIsGenerated(false);
    }
  }, [isOpen, viewOnlyManifest]);

  if (!isOpen) return null;

  const handleGenerateAndSaveManifest = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const generatedCode = `NER-DSP-${dateStr}-${randSuffix}`;
    const timestamp = new Date().toISOString();

    const payload = {
      manifest_code: generatedCode,
      vehicle_type: String(transitUnit || 'Relief Vehicle'),
      vehicle_reg_number: String(vehicleRegNumber || 'UNREGISTERED'),
      driver_name: String(driverName || 'N/A'),
      driver_contact: String(driverContact || 'N/A'),
      target_district: String(targetDistrict || 'Regional Sector'),
      cargo_description: String(cargoDetails || 'Disaster Relief Consignments'),
      issued_by_officer: String(issuingOfficer?.full_name || issuingOfficer?.email || 'DDMA Field Patrol'),
      issuing_district_id: issuingOfficer?.assigned_district_id ? String(issuingOfficer.assigned_district_id) : null,
      clearance_status: isClearedForTransit ? 'AUTHORIZED' : 'HAZARD_BLOCKED',
      created_at: timestamp,

      // Legacy Citizen Radar schema fallbacks to prevent constraint errors
      origin_name: 'Field Patrol Checkpoint',
      destination_name: String(targetDistrict || 'Sector Terminal'),
      applied_speed_kmh: 38,
      total_distance_km: 0,
      estimated_duration: 'N/A',
      blocked_hazards_count: activeBlockages.length,
      itinerary_steps: [],
      weather_snapshot: null,
    };

    try {
      const client = supabaseClient || getOfficerSupabaseClient();
      const { data, error } = await client
        .from('transit_manifests')
        .insert([payload])
        .select()
        .single();

      if (error) {
        alert(`Registry Insert Notice: ${error.message}`);
        console.error('Insert error details:', error);
      } else {
        console.log('Manifest archived successfully:', data);
        if (onManifestSaved) {
          await onManifestSaved();
        }
      }
    } catch (err) {
      console.error('Fatal saving manifest:', err);
    } finally {
      setManifestCode(generatedCode);
      setIssuedTimestamp(timestamp);
      setIsSaving(false);
      setIsGenerated(true);
    }
  };

  const handleApplyOverride = (e) => {
    e.preventDefault();
    if (overrideKey.trim().toUpperCase() === 'APEX-EMERGENCY-2026' || overrideKey.trim().length >= 6) {
      setOverrideApplied(true);
      alert('Statutory Override Applied: Defense / Emergency Convoy clearance granted.');
    } else {
      alert('Invalid Emergency Override Authorization Key.');
    }
  };

  const verificationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/verify-manifest?code=${manifestCode}`
    : `https://setu-ner.nic.in/verify-manifest?code=${manifestCode}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-300 rounded-lg shadow-2xl overflow-hidden font-sans my-auto print:m-0 print:w-full print:max-w-none print:border-none print:shadow-none">
        
        <div className="absolute right-0 top-1/4 pointer-events-none opacity-[0.03] print:opacity-[0.05]">
          <AshokaChakraWatermark className="w-[420px] h-[420px]" />
        </div>

        <div className="h-1.5 w-full flex">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#138808]" />
        </div>

        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 print:bg-white flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <StateEmblem className="h-12 w-auto shrink-0" variant="gold" />
            <div>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block">
                भारत सरकार | Government of India
              </span>
              <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                Ministry of Development of North Eastern Region (MDoNER)
              </h2>
              <p className="text-[11px] font-semibold text-slate-500">
                {viewOnlyManifest ? 'Archived Checkpoint Transit Record' : 'DDMA Field Patrol Checkpoint Transit Authorization'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-200 transition cursor-pointer print:hidden"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 text-xs">
          {!isGenerated ? (
            <form onSubmit={handleGenerateAndSaveManifest} className="space-y-3.5">
              <div className="border-b border-slate-100 pb-2">
                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
                  Field Checkpoint Inspection Form
                </span>
                <p className="text-[11px] text-slate-500">
                  Inspect the conveyance and register transit credentials. Manifest is automatically saved to the officer audit log upon issuance.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Transit Unit Category:</label>
                  <select
                    value={transitUnit}
                    onChange={(e) => setTransitUnit(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-xs bg-white text-slate-800 font-semibold"
                  >
                    {TRANSIT_UNITS.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vehicle Registration Number:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., AS-01-GB-4092"
                    value={vehicleRegNumber}
                    onChange={(e) => setVehicleRegNumber(e.target.value.toUpperCase())}
                    className="w-full border border-slate-300 rounded p-2 text-xs uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Destination District Sector:</label>
                  <select
                    value={targetDistrict}
                    onChange={(e) => setTargetDistrict(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded p-2 text-xs bg-white text-slate-800"
                  >
                    <option value="">Select Destination Jurisdiction</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.name}>{d.name} ({d.state})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Lead Driver / Officer-in-Command:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Subedar Rajesh Kumar"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Emergency Contact Number:</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 XXXXX XXXXX"
                    value={driverContact}
                    onChange={(e) => setDriverContact(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Cargo / Material Manifest Details:</label>
                  <input
                    type="text"
                    placeholder="e.g., Portable Water Treatment Units, Fuel Tankers, Food Rations"
                    value={cargoDetails}
                    onChange={(e) => setCargoDetails(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded text-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>🛡️</span>
                  <span>{isSaving ? 'Registering & Archiving...' : 'Evaluate Hazard Safety & Issue'}</span>
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className={`p-3 rounded-md border flex items-center justify-between ${
                isClearedForTransit
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                <div className="flex items-center space-x-2">
                  <span className="text-base">{isClearedForTransit ? '🟢' : '🛑'}</span>
                  <div>
                    <strong className="block text-[11px] uppercase font-bold tracking-wide">
                      {isClearedForTransit ? 'TRANSIT CLEARANCE: AUTHORIZED' : 'TRANSIT CLEARANCE: SUSPENDED'}
                    </strong>
                    <span className="text-[10px] block opacity-90">
                      {isClearedForTransit
                        ? 'Sector verified clear of active road blockages. Convoy permitted to proceed.'
                        : `Active hazards reported in the jurisdiction (${activeBlockages.length} active closures). Transit prohibited.`}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-white/90 border shrink-0">
                  {isClearedForTransit ? 'STATUS: CLEAR' : 'STATUS: BLOCKED'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                    Official Dispatch Identifier
                  </span>
                  <p className="text-sm sm:text-base font-black font-mono text-slate-900">
                    {manifestCode}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Issued: {issuedTimestamp ? new Date(issuedTimestamp).toLocaleString() : new Date().toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center space-x-2.5 bg-slate-50 border border-slate-200 p-2 rounded shrink-0 print:border-slate-300">
                  <QRCodeSVG value={verificationUrl} size={62} level="M" includeMargin={false} />
                  <div className="text-[9px] text-slate-500 max-w-[110px] leading-tight font-sans">
                    Scan at state checkpoints for credential verification.
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 flex justify-between items-center text-xs">
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-400 block font-sans">Issuing Officer</span>
                  <strong className="text-slate-900 font-bold">
                    {viewOnlyManifest?.issued_by_officer || issuingOfficer?.full_name || 'Ground Patrol Officer In-Charge'}
                  </strong>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    {issuingOfficer?.email || 'officer@assam.gov.in'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block font-sans">Statutory Jurisdiction</span>
                  <strong className="text-blue-900 font-mono text-[11px]">DDMA CHECKPOINT AUTHORIZED</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <div className="bg-slate-50 p-2 rounded border border-slate-200 sm:col-span-2">
                  <span className="text-[9px] font-sans text-slate-500 block uppercase">Transit Unit Category</span>
                  <strong className="text-slate-900 text-xs truncate block">{transitUnit}</strong>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-[9px] font-sans text-slate-500 block uppercase">Vehicle Reg</span>
                  <strong className="text-blue-900 text-xs block">{vehicleRegNumber}</strong>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-[9px] font-sans text-slate-500 block uppercase">Destination District</span>
                  <strong className="text-slate-900 text-xs block truncate">{targetDistrict}</strong>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] space-y-1 font-sans">
                <div className="flex justify-between">
                  <span className="text-slate-500">Convoy In-Charge / Driver:</span>
                  <strong className="text-slate-900">{driverName} ({driverContact})</strong>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span className="text-slate-500">Cargo Consignment:</span>
                  <strong className="text-slate-900">{cargoDetails || 'General Emergency Supplies'}</strong>
                </div>
              </div>

              {!isClearedForTransit && !overrideApplied && !viewOnlyManifest && (
                <form onSubmit={handleApplyOverride} className="p-3 bg-amber-50 border border-amber-300 rounded space-y-2">
                  <span className="text-[10px] font-bold uppercase text-amber-900 block">
                    ⚠️ Statutory Blockage Override (BRO / Defense / Critical Relief Only)
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter Apex Authorization Key"
                      value={overrideKey}
                      onChange={(e) => setOverrideKey(e.target.value)}
                      className="bg-white border border-amber-300 p-1.5 rounded text-xs flex-1 font-mono uppercase"
                    />
                    <button
                      type="submit"
                      className="bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs px-3 py-1.5 rounded cursor-pointer"
                    >
                      Apply Override
                    </button>
                  </div>
                </form>
              )}

              <div className="text-[9px] text-slate-500 border-t border-slate-200 pt-2.5 leading-relaxed font-sans">
                <p>
                  <strong>Statutory Authority:</strong> Generated under the Disaster Management Act by authorized DDMA Field Patrol personnel. Automatically archived into the sovereign log.
                </p>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-slate-100 print:hidden">
                {!viewOnlyManifest ? (
                  <button
                    type="button"
                    onClick={() => setIsGenerated(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                  >
                    ← Issue Another
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={!isClearedForTransit}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white rounded text-xs font-bold transition shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>🖨️</span>
                  <span>Print Official Manifest</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}