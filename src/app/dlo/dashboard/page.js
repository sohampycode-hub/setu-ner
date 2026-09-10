"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDloSupabaseClient } from "../../../utils/supabase";
import {
  StateEmblem,
  AshokaChakraWatermark,
} from "../../../components/emblems/NationalEmblem";
import GovFooter from "../../../components/GovFooter";

const DistrictMap = dynamic(() => import("../../../components/DistrictMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 text-xs font-medium p-4">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-700 mb-2" />
      <span>Rendering Assigned District Vector Boundary...</span>
    </div>
  ),
});

function HazardDonutChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-slate-400 italic">
        No recorded incidents in district.
      </div>
    );
  }

  let accumulatedAngle = 0;
  const radius = 38;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center justify-around py-2">
      <svg
        width="110"
        height="110"
        viewBox="0 0 100 100"
        className="transform -rotate-90"
      >
        {data.map((item, idx) => {
          if (item.value === 0) return null;
          const strokeDasharray = `${(item.value / total) * circumference} ${circumference}`;
          const strokeDashoffset = -accumulatedAngle;
          accumulatedAngle += (item.value / total) * circumference;

          return (
            <circle
              key={idx}
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="space-y-1.5 text-[11px]">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center space-x-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-600 font-medium">{item.label}:</span>
            <strong className="text-slate-900 font-mono">{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DLODashboard() {
  const router = useRouter();
  const dloSupabase = useMemo(() => getDloSupabaseClient(), []);
  const [incidents, setIncidents] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [roadSegments, setRoadSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [assignedDistrict, setAssignedDistrict] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [evidenceModalPhoto, setEvidenceModalPhoto] = useState(null);
  const [machineryRequisitions, setMachineryRequisitions] = useState([]);

  // Fast, isolated incident fetcher (used by Realtime and manual action triggers)
  const fetchDistrictIncidents = useCallback(async (districtId) => {
    try {
      const distParam = districtId ? `?districtId=${districtId}` : "";
      const res = await fetch(`/api/incidents${distParam}`);
      const data = await res.json();
      if (data.success) {
        const list = data.data || data.incidents || [];
        setIncidents(list);
      }
    } catch (err) {
      console.error("Failed to sync DLO district incidents:", err);
    }
  }, []);

  const fetchMachineryRequisitions = useCallback(async (districtId) => {
    if (!districtId) return;
    try {
      const res = await fetch(
        `/api/admin/requisitions?districtId=${districtId}`,
      );
      const data = await res.json();
      if (data.success) {
        setMachineryRequisitions(data.requisitions || []);
      }
    } catch (err) {
      console.error("Failed to sync DLO machinery dispatches:", err);
    }
  }, []);

  useEffect(() => {
    if (!assignedDistrict?.id) return;

    const reqChannel = dloSupabase
      .channel("dlo:realtime_requisitions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "machinery_requisitions" },
        () => {
          fetchMachineryRequisitions(assignedDistrict.id);
        },
      )
      .subscribe();

    return () => {
      dloSupabase.removeChannel(reqChannel);
    };
  }, [dloSupabase, assignedDistrict?.id, fetchMachineryRequisitions]);

  // Initial Full Bootstrap (Authentication, Districts GeoJSON, Roads)
  const checkAuthAndFetch = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
        error: authErr,
      } = await dloSupabase.auth.getUser();
      if (authErr || !user) {
        router.replace("/auth/dlo-login");
        return;
      }

      const { data: profile, error: profErr } = await dloSupabase
        .from("user_profiles")
        .select("id, role, assigned_district_id, full_name, approval_status")
        .eq("id", user.id)
        .single();

      if (profErr || !profile || profile.role !== "dlo") {
        router.replace("/auth/dlo-login");
        return;
      }

      if (profile.approval_status === "pending_approval") {
        alert(
          "Account Pending: Your credentials require Ministry Apex administrative clearance.",
        );
        await dloSupabase.auth.signOut();
        router.replace("/auth/dlo-login");
        return;
      }

      setUserProfile({
        email: user.email,
        fullName: profile.full_name || "District Logistics Officer",
        role: "District Logistics Officer (DLO)",
        districtId: profile.assigned_district_id || null,
      });

      const { data: rpcDistricts } = await dloSupabase.rpc(
        "get_districts_geojson",
      );
      let targetDist = null;

      if (rpcDistricts) {
        const loaded =
          typeof rpcDistricts === "string"
            ? JSON.parse(rpcDistricts)
            : rpcDistricts;
        setDistricts(loaded);

        if (profile.assigned_district_id) {
          targetDist = loaded.find(
            (d) => d.id === profile.assigned_district_id,
          );
        }

        if (!targetDist) {
          targetDist =
            loaded.find((d) =>
              d.name.toLowerCase().includes("kamrup metropolitan"),
            ) ||
            loaded.find((d) => d.name.toLowerCase().includes("kamrup")) ||
            loaded[0];
        }

        setAssignedDistrict(targetDist);
      }

      // Initial incidents fetch
      await fetchDistrictIncidents(targetDist?.id);

      // Roads GeoJSON bootstrap
      const { data: rawRoads } = await dloSupabase.rpc("get_roads_geojson", {
        p_limit: 4000,
      });
      if (rawRoads) {
        const roadsData =
          typeof rawRoads === "string" ? JSON.parse(rawRoads) : rawRoads;
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
                const line = subLine.map((pt) => [
                  Number(pt[1]),
                  Number(pt[0]),
                ]);
                if (line.length >= 2)
                  formatted.push({ ...road, coordinates: line });
              });
            } else if (Array.isArray(rawCoords[0])) {
              const line = rawCoords.map((pt) => [
                Number(pt[1]),
                Number(pt[0]),
              ]);
              if (line.length >= 2)
                formatted.push({ ...road, coordinates: line });
            }
          }
        }
        setRoadSegments(formatted);
      }
    } catch (err) {
      console.error("DLO Initialization error:", err);
    } finally {
      setLoading(false);
    }
  }, [dloSupabase, router, fetchDistrictIncidents]);

  // Initial load
  useEffect(() => {
    checkAuthAndFetch();
  }, [checkAuthAndFetch]);

  // Dedicated Realtime incident listener
  useEffect(() => {
    const channel = dloSupabase
      .channel("dlo:realtime_incidents")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incident_reports" },
        (payload) => {
          console.log(
            "Realtime event detected in DLO desk:",
            payload.eventType,
          );
          // Instantly refresh only the incident queue and map
          fetchDistrictIncidents(assignedDistrict?.id);
        },
      )
      .subscribe();

    return () => {
      dloSupabase.removeChannel(channel);
    };
  }, [dloSupabase, assignedDistrict?.id, fetchDistrictIncidents]);

  const handleSignOut = async () => {
    if (
      !confirm(
        "Are you sure you want to sign out of the District Logistics Command?",
      )
    )
      return;
    try {
      await dloSupabase.auth.signOut();
      router.replace("/auth/dlo-login");
    } catch (err) {
      console.error("Sign out error:", err.message);
      router.replace("/auth/dlo-login");
    }
  };

  const handleIncidentAction = async (incidentId, action) => {
    const confirmMessage =
      action === "resolve"
        ? "DLO Authority: Authorize road clearance and reopen this highway sector?"
        : action === "verify"
          ? "DLO Authority: Verify hazard and apply detour penalties across the district network?"
          : "DLO Authority: Dismiss report?";

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
        alert(
          `DLO Action Error (${res.status}): ${data.error || JSON.stringify(data)}`,
        );
        return;
      }
      // Re-fetch only the incidents quickly
      await fetchDistrictIncidents(assignedDistrict?.id);
    } catch (err) {
      alert(`Network Error: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const pendingList = useMemo(
    () => incidents.filter((i) => i.status === "pending"),
    [incidents],
  );
  const activeVerifiedList = useMemo(
    () => incidents.filter((i) => i.status === "verified"),
    [incidents],
  );
  const resolvedList = useMemo(
    () => incidents.filter((i) => i.status === "resolved"),
    [incidents],
  );

  const hazardTypeStats = useMemo(() => {
    const landslides = incidents.filter((i) =>
      i.hazard_type.includes("landslide"),
    ).length;
    const floods = incidents.filter(
      (i) =>
        i.hazard_type.includes("flood") ||
        i.hazard_type.includes("waterlogging"),
    ).length;
    const collapses = incidents.filter(
      (i) =>
        i.hazard_type.includes("road_collapse") ||
        i.hazard_type.includes("fallen_tree"),
    ).length;
    const others = incidents.length - landslides - floods - collapses;
    return [
      { label: "Landslide / Rockfall", value: landslides, color: "#d97706" },
      { label: "Flood / Inundation", value: floods, color: "#0284c7" },
      { label: "Road Structural / Trees", value: collapses, color: "#dc2626" },
      {
        label: "Fog / Ice / Others",
        value: Math.max(0, others),
        color: "#64748b",
      },
    ];
  }, [incidents]);

  const clearanceRate = useMemo(() => {
    const total = activeVerifiedList.length + resolvedList.length;
    if (total === 0) return 100;
    return Math.round((resolvedList.length / total) * 100);
  }, [activeVerifiedList, resolvedList]);

  if (loading && !userProfile) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white font-mono text-xs space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span>Authenticating DLO Command Authority...</span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      <div className="fixed -right-20 top-24 pointer-events-none z-0">
        <AshokaChakraWatermark
          className="w-[580px] h-[580px]"
          opacity="0.025"
        />
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
            <span>
              District Disaster Management Authority (DDMA) Logistics Command
            </span>
          </div>
          <span className="font-mono text-slate-300 text-[10px]">
            {userProfile?.email
              ? `DLO Desk: ${userProfile.email}`
              : "District Session Active"}
          </span>
        </div>

        <div className="px-4 sm:px-8 py-3 flex flex-wrap justify-between items-center max-w-7xl mx-auto w-full gap-3">
          <div className="flex items-center space-x-3.5">
            <StateEmblem className="h-11 w-auto" variant="gold" />
            <div className="border-l border-slate-700 pl-3.5">
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-white tracking-tight">
                  SETU-NER
                </span>
                <span className="bg-blue-600 text-blue-50 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  District Logistics Officer (DLO)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {assignedDistrict
                  ? `${assignedDistrict.name} District Jurisdiction`
                  : "District Command"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchDistrictIncidents(assignedDistrict?.id)}
              disabled={loading}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded border border-slate-700 transition cursor-pointer flex items-center space-x-1.5 min-h-[36px]"
            >
              <span className={loading ? "animate-spin inline-block" : ""}>
                🔄
              </span>
              <span className="hidden sm:inline">
                Refresh District Telemetry
              </span>
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
        <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-800">
                Authorized District Jurisdiction Locked
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 mt-1">
              {assignedDistrict
                ? `${assignedDistrict.name} District (${assignedDistrict.state})`
                : "Kamrup Metropolitan District"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Operating under statutory disaster logistics authority. Incident
              actions are strictly isolated to this jurisdiction.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded font-mono text-xs text-slate-700">
            <span className="text-[10px] text-slate-400 block font-sans uppercase">
              Officer In-Charge
            </span>
            <strong>
              {userProfile?.fullName || "District Logistics Officer"}
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-md border border-slate-200 shadow-2xs space-y-2">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Hazard Composition
              </span>
              <span className="text-[10px] font-mono bg-blue-50 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                {incidents.length} Total
              </span>
            </div>
            <HazardDonutChart data={hazardTypeStats} />
          </div>

          <div className="bg-white p-4 rounded-md border border-slate-200 shadow-2xs space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Corridor Pipeline Status
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Live Queue
              </span>
            </div>
            <div className="space-y-2 pt-1 text-xs">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-amber-700 font-semibold">
                    Pending Ground Verification
                  </span>
                  <strong className="font-mono">{pendingList.length}</strong>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full transition-all duration-500"
                    style={{
                      width: `${incidents.length ? (pendingList.length / incidents.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-rose-700 font-semibold">
                    Active Road Blockages
                  </span>
                  <strong className="font-mono">
                    {activeVerifiedList.length}
                  </strong>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-600 h-full transition-all duration-500"
                    style={{
                      width: `${incidents.length ? (activeVerifiedList.length / incidents.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-emerald-700 font-semibold">
                    Reopened Highway Corridors
                  </span>
                  <strong className="font-mono">{resolvedList.length}</strong>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full transition-all duration-500"
                    style={{
                      width: `${incidents.length ? (resolvedList.length / incidents.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-md border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Corridor Restoral Index
              </span>
              <span className="text-[10px] font-mono text-emerald-700 font-bold">
                24h SLA
              </span>
            </div>
            <div className="text-center py-3">
              <span className="text-4xl font-black text-slate-900 font-mono tracking-tight">
                {clearanceRate}%
              </span>
              <span className="text-[11px] text-slate-500 block mt-1 font-medium">
                Corridor Reopening & Clearance Ratio
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2 rounded text-[11px] text-slate-600 text-center font-mono">
              Active Closures:{" "}
              <strong className="text-rose-700">
                {activeVerifiedList.length}
              </strong>{" "}
              • Restored:{" "}
              <strong className="text-emerald-700">
                {resolvedList.length}
              </strong>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span>🗺️</span>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Tactical District Vector Map (
                {assignedDistrict
                  ? assignedDistrict.name
                  : "Kamrup Metropolitan"}
                )
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Spatial Point-in-Polygon Filter Active • Outer Districts Dimmed
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
                Active Corridor Closures Within{" "}
                {assignedDistrict?.name || "District"}
              </h2>
            </div>
            <span className="text-xs font-bold text-rose-700 font-mono">
              {activeVerifiedList.length} Blockages
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-4">Hazard</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4">Evidence</th>
                  <th className="py-2.5 px-4">Coordinates</th>
                  <th className="py-2.5 px-4">Verified At</th>
                  <th className="py-2.5 px-4 text-right">
                    DLO Clearance Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeVerifiedList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-slate-400 italic"
                    >
                      No active highway blockages in{" "}
                      {assignedDistrict?.name || "this district"}.
                    </td>
                  </tr>
                ) : (
                  activeVerifiedList.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-rose-700 uppercase">
                        {inc.hazard_type.replace("_", " ")}
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs">
                        {inc.description}
                      </td>
                      <td className="py-3 px-4">
                        {inc.photo_url ? (
                          <button
                            type="button"
                            onClick={() => setEvidenceModalPhoto(inc.photo_url)}
                            className="flex items-center space-x-1.5 p-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-blue-900 font-bold text-[10px] cursor-pointer transition"
                          >
                            <img
                              src={inc.photo_url}
                              alt="Evidence"
                              className="w-7 h-7 object-cover rounded border border-blue-300"
                            />
                            <span>View Proof</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">
                            No Photo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {Number(inc.latitude).toFixed(4)}°N,{" "}
                        {Number(inc.longitude).toFixed(4)}°E
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {inc.verified_at
                          ? new Date(inc.verified_at).toLocaleTimeString()
                          : "N/A"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() =>
                            handleIncidentAction(inc.id, "resolve")
                          }
                          disabled={actionInProgress === inc.id}
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1 ml-auto min-h-[36px]"
                        >
                          <span>🟢</span>
                          <span>
                            {actionInProgress === inc.id
                              ? "Authorizing..."
                              : "Authorize Reopening"}
                          </span>
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
                Incoming Citizen Incident Queue (
                {assignedDistrict?.name || "District"})
              </h2>
            </div>
            <span className="text-xs font-bold text-amber-700 font-mono">
              {pendingList.length} Awaiting Verification
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-4">Hazard</th>
                  <th className="py-2.5 px-4">Citizen Report</th>
                  <th className="py-2.5 px-4">Photo Evidence</th>
                  <th className="py-2.5 px-4">Coordinates</th>
                  <th className="py-2.5 px-4">Report Time</th>
                  <th className="py-2.5 px-4 text-right">DLO Decisions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-slate-400 italic"
                    >
                      No citizen reports pending review in this district.
                    </td>
                  </tr>
                ) : (
                  pendingList.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-amber-800 uppercase">
                        {inc.hazard_type.replace("_", " ")}
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs">
                        {inc.description}
                      </td>
                      <td className="py-3 px-4">
                        {inc.photo_url ? (
                          <button
                            type="button"
                            onClick={() => setEvidenceModalPhoto(inc.photo_url)}
                            className="flex items-center space-x-1.5 p-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-blue-900 font-bold text-[10px] cursor-pointer transition"
                          >
                            <img
                              src={inc.photo_url}
                              alt="Evidence"
                              className="w-7 h-7 object-cover rounded border border-blue-300"
                            />
                            <span>View Proof</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">
                            No Photo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {Number(inc.latitude).toFixed(4)}°N,{" "}
                        {Number(inc.longitude).toFixed(4)}°E
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
                          {actionInProgress === inc.id
                            ? "Working..."
                            : "⚠️ Verify & Block"}
                        </button>
                        <button
                          onClick={() => handleIncidentAction(inc.id, "reject")}
                          disabled={actionInProgress === inc.id}
                          className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded transition cursor-pointer disabled:opacity-50 min-h-[36px]"
                        >
                          Reject
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
              Captured by citizen/driver in field • Used for DLO and Patrol
              clearance validation
            </p>
          </div>
        </div>
      )}

      {/* Inter-District Heavy Machinery Allocation Deck */}
      <div className="bg-white rounded-md border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-base">🚜</span>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide">
                Statutory Heavy Machinery & Asset Deployments
              </h3>
              <p className="text-[10px] text-slate-400">
                Real-time MDoNER / NDMA inter-district transfers impacting{" "}
                {assignedDistrict?.name || "this district"}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-800 text-cyan-300 px-2.5 py-1 rounded border border-slate-700">
            {machineryRequisitions.length} Active Directives
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                <th className="py-2.5 px-4">Transfer Vector</th>
                <th className="py-2.5 px-4">Equipment Unit</th>
                <th className="py-2.5 px-4">Units</th>
                <th className="py-2.5 px-4">Origin / Stockpile</th>
                <th className="py-2.5 px-4">Destination</th>
                <th className="py-2.5 px-4">Directive Status</th>
                <th className="py-2.5 px-4 text-right">Mandate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {machineryRequisitions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-slate-400 italic"
                  >
                    No inter-district heavy machinery allocations currently
                    designated for this district.
                  </td>
                </tr>
              ) : (
                machineryRequisitions.map((req) => {
                  const isIncoming =
                    String(req.target_district_id) ===
                    String(assignedDistrict?.id);
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                            isIncoming
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-amber-100 text-amber-800 border border-amber-300"
                          }`}
                        >
                          {isIncoming
                            ? "📥 INCOMING RELIEF"
                            : "📤 OUTGOING STOCK"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 capitalize">
                        {req.resource_type.replace(/_/g, " ")}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-900">
                        {req.quantity} Units
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {req.source_district?.name || "Stockpile Sector"}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {req.target_district?.name || "Emergency Sector"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-cyan-50 text-cyan-800 border border-cyan-300 font-bold uppercase text-[9px] px-2 py-0.5 rounded">
                          {req.requisition_status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                        {req.authorized_by}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <GovFooter />
    </main>
  );
}
