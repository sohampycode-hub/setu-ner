"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getOfficerSupabaseClient } from "../../../utils/supabase";
import {
  StateEmblem,
  AshokaChakraWatermark,
} from "../../../components/emblems/NationalEmblem";
import GovFooter from "../../../components/GovFooter";
import TransitManifestModal from "../../../components/TransitManifestModal";
import OfficerManifestArchiveModal from "../../../components/OfficerManifestArchiveModal";

const DistrictMap = dynamic(() => import("../../../components/DistrictMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 text-xs font-medium p-4">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-700 mb-2" />
      <span>Rendering District Vector Boundary...</span>
    </div>
  ),
});

export default function FieldOfficerDashboard() {
  const router = useRouter();
  const officerSupabase = useMemo(() => getOfficerSupabaseClient(), []);
  const [incidents, setIncidents] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [roadSegments, setRoadSegments] = useState([]);
  const [assignedDistrict, setAssignedDistrict] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [evidenceModalPhoto, setEvidenceModalPhoto] = useState(null);

  // Manifest and Archive States
  const [manifestModalOpen, setManifestModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archivedManifests, setArchivedManifests] = useState([]);
  const [selectedArchivedManifest, setSelectedArchivedManifest] = useState(null);
  const [districtsList, setDistrictsList] = useState([]);

  // Monitor Network Connectivity Status
  useEffect(() => {
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOfflineMode(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fast, isolated incident fetcher
  const fetchDistrictIncidents = useCallback(async (districtId) => {
    try {
      const distParam = districtId ? `?districtId=${districtId}` : "";
      const res = await fetch(`/api/incidents${distParam}`);
      const data = await res.json();
      if (data.success) {
        const list = data.data || data.incidents || [];
        setIncidents(list);
        try {
          localStorage.setItem(`setu_cached_incidents_${districtId}`, JSON.stringify(list));
        } catch {}
      }
    } catch (err) {
      console.warn("Failed to fetch fresh incidents, checking offline cache:", err);
      try {
        const cached = localStorage.getItem(`setu_cached_incidents_${districtId}`);
        if (cached) setIncidents(JSON.parse(cached));
      } catch {}
    }
  }, []);

  // Fetch issued manifests archive
  const fetchArchivedManifests = useCallback(async () => {
    try {
      const { data, error } = await officerSupabase
        .from("transit_manifests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setArchivedManifests(data || []);
      try {
        localStorage.setItem("setu_cached_manifests", JSON.stringify(data || []));
      } catch {}
    } catch (err) {
      console.warn("Failed to load archived manifests over network, loading cache:", err.message);
      try {
        const cached = localStorage.getItem("setu_cached_manifests");
        if (cached) setArchivedManifests(JSON.parse(cached));
      } catch {}
    }
  }, [officerSupabase]);

  // Initial Bootstrap with LocalStorage Fallback for Cartography
  const checkAuthAndFetch = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
        error: authErr,
      } = await officerSupabase.auth.getUser();
      if (authErr || !user) {
        router.replace("/auth/officer-login");
        return;
      }

      const { data: profile, error: profileErr } = await officerSupabase
        .from("user_profiles")
        .select("id, role, assigned_district_id, full_name, approval_status")
        .eq("id", user.id)
        .single();

      if (profileErr || !profile || profile.role !== "field_officer") {
        router.replace("/auth/officer-login");
        return;
      }

      if (profile.approval_status === "pending_approval") {
        alert(
          "Account Pending: Your credentials require Ministry Apex administrative clearance."
        );
        await officerSupabase.auth.signOut();
        router.replace("/auth/officer-login");
        return;
      }

      setUserProfile({
        email: user.email,
        full_name: profile.full_name || "Ground Field Officer",
        role: "Ground Field Officer",
        assigned_district_id: profile.assigned_district_id || null,
      });

      // 1. Fetch Boundary GeoJSON (Network first, then Cache)
      let loadedDistricts = [];
      let targetDist = null;

      try {
        const { data: rpcDistricts } = await officerSupabase.rpc("get_districts_geojson");
        if (rpcDistricts) {
          loadedDistricts = typeof rpcDistricts === "string" ? JSON.parse(rpcDistricts) : rpcDistricts;
          localStorage.setItem("setu_cached_districts_geojson", JSON.stringify(loadedDistricts));
        }
      } catch (distErr) {
        console.warn("Using offline cached boundary data:", distErr);
        const cached = localStorage.getItem("setu_cached_districts_geojson");
        if (cached) loadedDistricts = JSON.parse(cached);
      }

      if (loadedDistricts.length > 0) {
        setDistricts(loadedDistricts);
        if (profile.assigned_district_id) {
          targetDist = loadedDistricts.find((d) => d.id === profile.assigned_district_id);
        }
        if (!targetDist) {
          targetDist =
            loadedDistricts.find((d) => d.name.toLowerCase().includes("kamrup metropolitan")) ||
            loadedDistricts.find((d) => d.name.toLowerCase().includes("kamrup")) ||
            loadedDistricts[0];
        }
        setAssignedDistrict(targetDist);
      }

      // 2. Fetch Simple District List for Manifest Dropdown
      try {
        const { data: simpleDist } = await officerSupabase
          .from("districts")
          .select("id, name, state")
          .order("name", { ascending: true });
        if (simpleDist && simpleDist.length > 0) {
          setDistrictsList(simpleDist);
        } else if (loadedDistricts.length > 0) {
          setDistrictsList(loadedDistricts);
        }
      } catch {
        if (loadedDistricts.length > 0) setDistrictsList(loadedDistricts);
      }

      // 3. Incidents & Archived Manifests
      await Promise.all([
        fetchDistrictIncidents(targetDist?.id),
        fetchArchivedManifests(),
      ]);

      // 4. Roads GeoJSON Bootstrap (Network first, then Cache)
      try {
        const { data: rawRoads } = await officerSupabase.rpc("get_roads_geojson", { p_limit: 4000 });
        if (rawRoads) {
          const roadsData = typeof rawRoads === "string" ? JSON.parse(rawRoads) : rawRoads;
          const formatted = [];
          for (const road of roadsData) {
            let rawCoords = road.coordinates;
            if (typeof rawCoords === "string") {
              try {
                rawCoords = JSON.parse(rawCoords);
              } catch {
                continue;
              }
            }
            if (Array.isArray(rawCoords) && rawCoords.length > 0) {
              if (Array.isArray(rawCoords[0]) && Array.isArray(rawCoords[0][0])) {
                rawCoords.forEach((subLine) => {
                  const line = subLine.map((pt) => [Number(pt[1]), Number(pt[0])]);
                  if (line.length >= 2) formatted.push({ ...road, coordinates: line });
                });
              } else if (Array.isArray(rawCoords[0])) {
                const line = rawCoords.map((pt) => [Number(pt[1]), Number(pt[0])]);
                if (line.length >= 2) formatted.push({ ...road, coordinates: line });
              }
            }
          }
          setRoadSegments(formatted);
          try {
            localStorage.setItem("setu_cached_road_segments", JSON.stringify(formatted.slice(0, 500)));
          } catch {}
        }
      } catch (roadsErr) {
        console.warn("Using offline cached road vectors:", roadsErr);
        const cachedRoads = localStorage.getItem("setu_cached_road_segments");
        if (cachedRoads) setRoadSegments(JSON.parse(cachedRoads));
      }
    } catch (err) {
      console.error("Field Officer initialization exception:", err);
    } finally {
      setLoading(false);
    }
  }, [officerSupabase, router, fetchDistrictIncidents, fetchArchivedManifests]);

  useEffect(() => {
    checkAuthAndFetch();
  }, [checkAuthAndFetch]);

  // Realtime listeners for Incidents & Manifests
  useEffect(() => {
    const incidentChannel = officerSupabase
      .channel("officer:realtime_incidents")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incident_reports" },
        () => {
          fetchDistrictIncidents(assignedDistrict?.id);
        }
      )
      .subscribe();

    const manifestChannel = officerSupabase
      .channel("officer:realtime_manifests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transit_manifests" },
        () => {
          fetchArchivedManifests();
        }
      )
      .subscribe();

    return () => {
      officerSupabase.removeChannel(incidentChannel);
      officerSupabase.removeChannel(manifestChannel);
    };
  }, [officerSupabase, assignedDistrict?.id, fetchDistrictIncidents, fetchArchivedManifests]);

  const handleSignOut = async () => {
    if (!confirm("Are you sure you want to sign out of the field patrol desk?")) return;
    try {
      await officerSupabase.auth.signOut();
      router.replace("/auth/officer-login");
    } catch (err) {
      console.error("Sign out error:", err.message);
      router.replace("/auth/officer-login");
    }
  };

  const handleIncidentAction = async (incidentId, action) => {
    const confirmMessage =
      action === "resolve"
        ? "Field Action: Confirm physical road clearance and reopen this highway segment?"
        : action === "verify"
        ? "Field Action: Verify physical blockage and apply emergency detour penalties?"
        : "Field Action: Dismiss citizen report as inaccurate?";

    if (!confirm(confirmMessage)) return;

    setActionInProgress(incidentId);
    try {
      const res = await fetch("/api/incidents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId, action }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(`Field Action Error (${res.status}): ${data.error || JSON.stringify(data)}`);
        return;
      }
      await fetchDistrictIncidents(assignedDistrict?.id);
    } catch (err) {
      alert(`Network Error: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const pendingList = useMemo(() => incidents.filter((i) => i.status === "pending"), [incidents]);
  const activeVerifiedList = useMemo(() => incidents.filter((i) => i.status === "verified"), [incidents]);
  const resolvedList = useMemo(() => incidents.filter((i) => i.status === "resolved"), [incidents]);

  if (loading && !userProfile) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white font-mono text-xs space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
        <span>Verifying Field Officer Session...</span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      <div className="fixed -right-20 top-24 pointer-events-none z-0">
        <AshokaChakraWatermark className="w-[580px] h-[580px]" opacity="0.025" />
      </div>

      <div className="h-1 w-full flex z-10">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      <header className="bg-slate-900 border-b border-slate-800 text-white z-10">
        <div className="border-b border-slate-800 bg-slate-950 text-slate-400 text-[10px] sm:text-[11px] px-4 sm:px-8 py-1.5 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-200">
              भारत सरकार | Government of India
            </span>
            <span>•</span>
            <span>DDMA Field Patrol & Emergency Highway Response</span>
          </div>

          <div className="flex items-center space-x-2.5">
            {isOfflineMode && (
              <span className="bg-rose-900/90 text-rose-200 border border-rose-700 text-[9px] font-bold px-2 py-0.5 rounded font-mono animate-pulse">
                ⚡ OFFLINE MODE (CACHED VECTORS)
              </span>
            )}
            <span className="font-mono text-slate-300 text-[10px]">
              {userProfile?.email ? `Officer: ${userProfile.email}` : "Field Patrol Active"}
            </span>
          </div>
        </div>

        <div className="px-4 sm:px-8 py-3 flex flex-wrap justify-between items-center max-w-7xl mx-auto w-full gap-3">
          <div className="flex items-center space-x-3.5">
            <StateEmblem className="h-11 w-auto" variant="gold" />
            <div className="border-l border-slate-700 pl-3.5">
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-white tracking-tight">SETU-NER</span>
                <span className="bg-amber-600 text-amber-50 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Ground Field Officer
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {assignedDistrict
                  ? `${assignedDistrict.name} (${assignedDistrict.state})`
                  : "Kamrup Metropolitan"}{" "}
                Highway Patrol Desk
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchDistrictIncidents(assignedDistrict?.id)}
              disabled={loading}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded border border-slate-700 transition cursor-pointer flex items-center space-x-1.5 min-h-[36px]"
            >
              <span className={loading ? "animate-spin inline-block" : ""}>🔄</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => {
                setSelectedArchivedManifest(null);
                setManifestModalOpen(true);
              }}
              className="text-xs bg-emerald-800 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded border border-emerald-600 transition cursor-pointer flex items-center space-x-1.5 min-h-[36px]"
            >
              <span>📋</span>
              <span>Issue Manifest</span>
            </button>

            <button
              onClick={() => setArchiveModalOpen(true)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold px-3 py-1.5 rounded border border-slate-700 transition cursor-pointer flex items-center space-x-1.5 min-h-[36px]"
            >
              <span>🗄️</span>
              <span>Archived Manifests ({archivedManifests.length})</span>
            </button>

            <Link
              href="/"
              className="text-xs font-semibold px-3 py-1.5 rounded bg-blue-800 hover:bg-blue-700 text-white transition shadow-xs flex items-center space-x-1 min-h-[36px]"
            >
              <span>🗺️</span>
              <span>Citizen Radar</span>
            </Link>

            <button
              onClick={handleSignOut}
              className="text-xs font-semibold px-3 py-1.5 rounded bg-rose-900 hover:bg-rose-800 text-rose-100 border border-rose-700 transition cursor-pointer flex items-center space-x-1 min-h-[36px]"
            >
              <span>🚪</span>
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6 w-full flex-1 z-10">
        <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-800 block">
              Assigned Operational District
            </span>
            <h1 className="text-xl font-black text-slate-900 mt-0.5">
              {assignedDistrict
                ? `${assignedDistrict.name} District (${assignedDistrict.state})`
                : "Kamrup Metropolitan District"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Field Operations Desk: Physical road inspection, obstacle verification, checkpoint clearance, and corridor restoral.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded font-mono text-xs text-slate-700">
            <span className="text-[10px] text-slate-400 block font-sans uppercase">Field Officer</span>
            <strong className="text-slate-900">{userProfile?.full_name || "Field Officer Active"}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-md border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-bold block uppercase">Ground Checks Pending</span>
            <span className="text-2xl font-black text-amber-600">{pendingList.length}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Citizen alerts awaiting physical verification</span>
          </div>
          <div className="bg-white p-4 rounded-md border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-bold block uppercase">Active District Blockages</span>
            <span className="text-2xl font-black text-rose-600">{activeVerifiedList.length}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Corridors currently closed in this district</span>
          </div>
          <div className="bg-white p-4 rounded-md border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-bold block uppercase">Corridors Reopened</span>
            <span className="text-2xl font-black text-emerald-600">{resolvedList.length}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Restored to clear status after debris removal</span>
          </div>
        </div>

        <div className="bg-white rounded-md border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span>🗺️</span>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Tactical District Vector Map ({assignedDistrict ? assignedDistrict.name : "Kamrup Metropolitan"})
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {isOfflineMode ? "Running on Local Offline Geometry Cache" : "Auto-Centered on District Boundary"}
            </span>
          </div>
          <div className="h-[340px] sm:h-[400px]">
            <DistrictMap
              targetDistrict={assignedDistrict}
              allDistricts={districts}
              roadSegments={roadSegments}
              incidents={incidents}
            />
          </div>
        </div>

        <div className="bg-white rounded-md border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-rose-50 border-b border-rose-100 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span>🚨</span>
              <h2 className="text-xs sm:text-sm font-bold text-rose-900 uppercase tracking-wide">
                Active Road Closures Within {assignedDistrict?.name || "District"}
              </h2>
            </div>
            <span className="text-xs font-bold text-rose-700 font-mono">
              {activeVerifiedList.length} Active
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-4">Hazard Type</th>
                  <th className="py-2.5 px-4">Observation Details</th>
                  <th className="py-2.5 px-4">Evidence</th>
                  <th className="py-2.5 px-4">Coordinates</th>
                  <th className="py-2.5 px-4">Verified At</th>
                  <th className="py-2.5 px-4 text-right">Clearance Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeVerifiedList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                      No active road blockages recorded in {assignedDistrict?.name || "this district"}.
                    </td>
                  </tr>
                ) : (
                  activeVerifiedList.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-rose-700 uppercase">
                        {inc.hazard_type.replace("_", " ")}
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs">{inc.description}</td>
                      <td className="py-3 px-4">
                        {inc.photo_url ? (
                          <button
                            type="button"
                            onClick={() => setEvidenceModalPhoto(inc.photo_url)}
                            className="flex items-center space-x-1.5 p-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-blue-900 font-bold text-[10px] cursor-pointer transition"
                          >
                            <img src={inc.photo_url} alt="Evidence" className="w-7 h-7 object-cover rounded border border-blue-300" />
                            <span>View Proof</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">No Photo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {Number(inc.latitude).toFixed(4)}°N, {Number(inc.longitude).toFixed(4)}°E
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {inc.verified_at ? new Date(inc.verified_at).toLocaleTimeString() : "N/A"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleIncidentAction(inc.id, "resolve")}
                          disabled={actionInProgress === inc.id}
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1 ml-auto min-h-[36px]"
                        >
                          <span>🟢</span>
                          <span>{actionInProgress === inc.id ? "Reopening..." : "Mark Cleared & Reopen"}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-md border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span>📢</span>
              <h2 className="text-xs sm:text-sm font-bold text-amber-900 uppercase tracking-wide">
                Incoming Citizen Reports ({assignedDistrict?.name || "District"})
              </h2>
            </div>
            <span className="text-xs font-bold text-amber-700 font-mono">
              {pendingList.length} Pending Inspection
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-4">Reported Hazard</th>
                  <th className="py-2.5 px-4">Citizen Description</th>
                  <th className="py-2.5 px-4">Photo Evidence</th>
                  <th className="py-2.5 px-4">Coordinates</th>
                  <th className="py-2.5 px-4">Report Time</th>
                  <th className="py-2.5 px-4 text-right">Patrol Decisions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                      No citizen reports pending field verification in {assignedDistrict?.name || "this district"}.
                    </td>
                  </tr>
                ) : (
                  pendingList.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-amber-800 uppercase">
                        {inc.hazard_type.replace("_", " ")}
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs">{inc.description}</td>
                      <td className="py-3 px-4">
                        {inc.photo_url ? (
                          <button
                            type="button"
                            onClick={() => setEvidenceModalPhoto(inc.photo_url)}
                            className="flex items-center space-x-1.5 p-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-blue-900 font-bold text-[10px] cursor-pointer transition"
                          >
                            <img src={inc.photo_url} alt="Evidence" className="w-7 h-7 object-cover rounded border border-blue-300" />
                            <span>View Proof</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">No Photo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {Number(inc.latitude).toFixed(4)}°N, {Number(inc.longitude).toFixed(4)}°E
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(inc.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleIncidentAction(inc.id, "verify")}
                          disabled={actionInProgress === inc.id}
                          className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs rounded transition shadow-xs cursor-pointer disabled:opacity-50 min-h-[36px]"
                        >
                          {actionInProgress === inc.id ? "Verifying..." : "⚠️ Confirm Hazard & Block"}
                        </button>
                        <button
                          onClick={() => handleIncidentAction(inc.id, "reject")}
                          disabled={actionInProgress === inc.id}
                          className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded transition cursor-pointer disabled:opacity-50 min-h-[36px]"
                        >
                          Dismiss (False Report)
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {evidenceModalPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-xl w-full p-4 space-y-3 shadow-2xl border border-slate-300">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                📷 Photographic Ground Evidence
              </span>
              <button
                onClick={() => setEvidenceModalPhoto(null)}
                className="text-slate-500 hover:text-slate-900 text-sm font-bold px-2 py-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-hidden rounded border border-slate-200 bg-black flex items-center justify-center">
              <img
                src={evidenceModalPhoto}
                alt="Ground Reality Evidence"
                className="max-h-[68vh] w-auto object-contain"
              />
            </div>
            <p className="text-[10px] text-slate-500 text-center font-mono">
              Captured by citizen/driver in field • Used for Patrol clearance verification
            </p>
          </div>
        </div>
      )}

      {manifestModalOpen && (
        <TransitManifestModal
          isOpen={manifestModalOpen}
          onClose={() => {
            setManifestModalOpen(false);
            setSelectedArchivedManifest(null);
          }}
          supabaseClient={officerSupabase}
          issuingOfficer={userProfile}
          activeIncidents={incidents}
          districts={districtsList}
          viewOnlyManifest={selectedArchivedManifest}
          onManifestSaved={fetchArchivedManifests}
        />
      )}

      {archiveModalOpen && (
        <OfficerManifestArchiveModal
          isOpen={archiveModalOpen}
          onClose={() => setArchiveModalOpen(false)}
          manifests={archivedManifests}
          onSelectManifest={(manifest) => {
            setSelectedArchivedManifest(manifest);
            setManifestModalOpen(true);
          }}
        />
      )}

      <GovFooter />
    </main>
  );
}