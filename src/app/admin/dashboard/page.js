"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../utils/supabase";
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
      <span>Rendering District Vector Cartography...</span>
    </div>
  ),
});

const NER_STATES = [
  "Assam",
  "Arunachal Pradesh",
  "Meghalaya",
  "Manipur",
  "Mizoram",
  "Nagaland",
  "Sikkim",
  "Tripura",
];

const STRATEGIC_CORRIDORS = [
  {
    id: "nh-27",
    name: "NH-27 (East-West Lifeline)",
    route: "Siliguri Corridor ↔ Guwahati ↔ Doboka ↔ Silchar",
    classification: "National Lifeline Arterial",
    terrainAdvisory:
      "Flood vulnerability around Siliguri Gap; Brahmaputra valley clear.",
    militaryReadiness: "Level 1 Priority (Heavy Convoys Authorized)",
    status: "OPERATIONAL",
    detoursAvailable: "Via SH-02 or NH-127",
  },
  {
    id: "nh-10",
    name: "NH-10 (Sikkim Artery)",
    route: "Sevoke ↔ Teesta Bridge ↔ Rangpo ↔ Gangtok",
    classification: "Strategic Border Lifeline",
    terrainAdvisory:
      "High landslide susceptibility along Teesta River gorge during monsoons.",
    militaryReadiness: "Convoy Restricted (Light/Medium Vehicles Only)",
    status: "CAUTION",
    detoursAvailable: "Alternative via Lava-Algarah-Gorubathan ridge",
  },
  {
    id: "nh-13",
    name: "NH-13 (Trans-Arunachal Highway)",
    route: "Pasighat ↔ Dambuk ↔ Roing ↔ Tezu",
    classification: "BRO Strategic Frontier Arterial",
    terrainAdvisory: "Flash flood runoffs active across seasonal riverbeds.",
    militaryReadiness: "Heavy Armored / Construction Ready",
    status: "OPERATIONAL",
    detoursAvailable: "Direct BRO mountain pass access",
  },
  {
    id: "nh-02",
    name: "NH-02 (Manipur-Nagaland Arterial)",
    route: "Dimapur ↔ Kohima ↔ Maram ↔ Imphal",
    classification: "Inter-State Supply Spine",
    terrainAdvisory:
      "Sinking road zone between Kohima and Mao Checkpost monitored.",
    militaryReadiness: "Essential Logistics Authorized",
    status: "OPERATIONAL",
    detoursAvailable: "Alternative via Leishan-Tamenglong route",
  },
  {
    id: "nh-06",
    name: "NH-06 (Meghalaya-Mizoram Ridge Corridor)",
    route: "Shillong ↔ Jowai ↔ Ratacherra ↔ Silchar ↔ Aizawl",
    classification: "High-Altitude Mineral & Supply Transit",
    terrainAdvisory:
      "Zero-visibility dense fog banks reported along East Jaintia Hills.",
    militaryReadiness: "Clearance Granted with Fog Beacons",
    status: "OPERATIONAL",
    detoursAvailable: "Via Rymbai inner arterial",
  },
  {
    id: "nh-08",
    name: "NH-08 (Tripura Strategic Lifeline)",
    route: "Churaibari Gate ↔ Dharmanagar ↔ Teliamura ↔ Agartala ↔ Sabroom",
    classification: "International Border Connectivity Line",
    terrainAdvisory:
      "Stable terrain. Crossings clear with zero active waterlogging.",
    militaryReadiness: "Full Unrestricted Sovereign Transit",
    status: "OPERATIONAL",
    detoursAvailable: "Direct transit unobstructed",
  },
];

function DonutChart({ data, size = 110 }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="h-28 flex items-center justify-center text-xs text-slate-400 italic">
        No records
      </div>
    );
  }

  let accumulatedAngle = 0;
  const radius = 38;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center justify-around py-1">
      <svg
        width={size}
        height={size}
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

// Bounding box helper to filter roads within a district boundary
function getDistrictBBox(district) {
  const geom =
    district?.geojson ||
    (typeof district?.boundary === "string"
      ? JSON.parse(district.boundary)
      : district?.boundary);
  if (!geom || !geom.coordinates) return null;
  let coords = geom.coordinates;
  while (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    coords = coords[0];
  }
  if (!Array.isArray(coords) || coords.length === 0) return null;

  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  for (const pt of coords) {
    if (Array.isArray(pt) && pt.length >= 2) {
      const lng = Number(pt[0]);
      const lat = Number(pt[1]);
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLat, maxLat, minLng, maxLng };
}

// Zero-Lag Isolated Officer Provisioning Component
const OfficerProvisioningDesk = memo(function OfficerProvisioningDesk({
  districts,
}) {
  const [provisionName, setProvisionName] = useState("");
  const [provisionEmail, setProvisionEmail] = useState("");
  const [provisionPassword, setProvisionPassword] = useState("");
  const [provisionRole, setProvisionRole] = useState("field_officer");
  const [provisionDistrictId, setProvisionDistrictId] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const [provisionSuccessMsg, setProvisionSuccessMsg] = useState("");
  const [provisionErrorMsg, setProvisionErrorMsg] = useState("");

  const handleProvisionSubmit = async (e) => {
    e.preventDefault();
    setProvisioning(true);
    setProvisionSuccessMsg("");
    setProvisionErrorMsg("");

    try {
      const res = await fetch("/api/admin/provision-officer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: provisionName,
          email: provisionEmail,
          password: provisionPassword,
          role: provisionRole,
          districtId: provisionDistrictId || districts[0]?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setProvisionErrorMsg(data.error || "Failed to provision officer.");
        return;
      }

      setProvisionSuccessMsg(
        `✓ Successfully provisioned ${provisionRole.toUpperCase()} credentials for ${provisionName}`,
      );
      setProvisionName("");
      setProvisionEmail("");
      setProvisionPassword("");
    } catch (err) {
      setProvisionErrorMsg(`Network Error: ${err.message}`);
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200 shadow-2xs space-y-4">
      <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
        <div>
          <span className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">
            Statutory Authority Dispatch
          </span>
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            Personnel Onboarding & Jurisdictional Assignment
          </h3>
          <p className="text-[11px] text-slate-500">
            Grant field command credentials. Notice: Each district is restricted
            to exactly <strong>one DLO</strong>, with unlimited Field Patrol
            Officers.
          </p>
        </div>
        <span className="text-2xl">🎖️</span>
      </div>

      {provisionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded">
          {provisionSuccessMsg}
        </div>
      )}

      {provisionErrorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded">
          {provisionErrorMsg}
        </div>
      )}

      <form
        onSubmit={handleProvisionSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs"
      >
        <div>
          <label className="font-bold text-slate-700 block mb-1">
            Full Name:
          </label>
          <input
            type="text"
            required
            placeholder="e.g., Inspector P. Barman"
            value={provisionName}
            onChange={(e) => setProvisionName(e.target.value)}
            className="w-full border border-slate-300 rounded p-2 text-xs bg-white text-slate-800 focus:outline-blue-600"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">
            Official Gov Email:
          </label>
          <input
            type="email"
            required
            placeholder="officer@assam.gov.in"
            value={provisionEmail}
            onChange={(e) => setProvisionEmail(e.target.value)}
            className="w-full border border-slate-300 rounded p-2 text-xs bg-white text-slate-800 focus:outline-blue-600"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">
            Initial Password:
          </label>
          <input
            type="password"
            required
            placeholder="••••••••"
            value={provisionPassword}
            onChange={(e) => setProvisionPassword(e.target.value)}
            className="w-full border border-slate-300 rounded p-2 text-xs bg-white text-slate-800 focus:outline-blue-600"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">
            Role Designation:
          </label>
          <select
            value={provisionRole}
            onChange={(e) => setProvisionRole(e.target.value)}
            className="w-full border border-slate-300 rounded p-2 text-xs bg-white text-slate-800 font-bold focus:outline-blue-600"
          >
            <option value="field_officer">Ground Field Patrol Officer</option>
            <option value="dlo">District Logistics Officer (Sole DLO)</option>
          </select>
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">
            Assigned Jurisdiction:
          </label>
          <select
            value={provisionDistrictId || districts[0]?.id || ""}
            onChange={(e) => setProvisionDistrictId(e.target.value)}
            className="w-full border border-slate-300 rounded p-2 text-xs bg-white text-slate-800 focus:outline-blue-600"
          >
            {districts.map((d) => (
              <option key={`prov-${d.id}`} value={d.id}>
                {d.name} ({d.state})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-5 pt-1">
          <button
            type="submit"
            disabled={provisioning}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-xs transition shadow-xs cursor-pointer disabled:opacity-50 min-h-[40px] flex items-center justify-center space-x-2"
          >
            <span>🛡️</span>
            <span>
              {provisioning
                ? "Authorizing & Dispatching Credentials..."
                : "Issue Statutory Credentials & Activate"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
});

export default function AdminApexDashboard() {
  const router = useRouter();
  const [incidents, setIncidents] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [roadSegments, setRoadSegments] = useState([]);
  const [roadStats, setRoadStats] = useState({
    clear: 0,
    atRisk: 0,
    blocked: 0,
  });
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingReq, setSubmittingReq] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvalLoadingId, setApprovalLoadingId] = useState(null);

  // Strategic Corridor Interactive Dropdown
  const [selectedCorridorId, setSelectedCorridorId] = useState("nh-27");

  // State & District Diagnostics
  const [selectedState, setSelectedState] = useState("Assam");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");

  // Machinery Requisition State
  const [sourceDistId, setSourceDistId] = useState("");
  const [targetDistId, setTargetDistId] = useState("");
  const [selectedResourceType, setSelectedResourceType] =
    useState("earthmover_jcb");
  const [transferQty, setTransferQty] = useState(1);

  const [restoralStats, setRestoralStats] = useState({ resolved: 0, total: 0 });

  // Fast, isolated incident fetcher
  const fetchIncidents = useCallback(async () => {
    try {
      const incRes = await fetch("/api/incidents");
      const incData = await incRes.json();
      if (incData.success) {
        setIncidents(incData.data || incData.incidents || []);
        if (incData.resolvedCount !== undefined) {
          setRestoralStats({
            resolved: incData.resolvedCount,
            total: incData.totalCount,
          });
        }
      }
    } catch (err) {
      console.error("Failed to sync incidents on Apex desk:", err);
    }
  }, []);

  // Fetch pending officer RBAC approvals
  const fetchPendingApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/approvals");
      const data = await res.json();
      if (data.success) {
        setPendingApprovals(data.pendingUsers || []);
      }
    } catch (err) {
      console.error("Failed to load pending approvals:", err);
    }
  }, []);

  // Initial Full Bootstrap (User, Districts, 8000 Roads GeoJSON, Requisitions, Approvals)
  const fetchApexData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/admin/login");
        return;
      }

      // 1. Incidents & Approvals
      await Promise.all([fetchIncidents(), fetchPendingApprovals()]);

      // 2. Districts
      const { data: rpcDistricts } = await supabase.rpc(
        "get_districts_geojson",
      );
      let loadedDistricts = [];
      if (rpcDistricts) {
        loadedDistricts =
          typeof rpcDistricts === "string"
            ? JSON.parse(rpcDistricts)
            : rpcDistricts;
      } else {
        const { data: simpleDist } = await supabase
          .from("districts")
          .select("id, name, state, boundary")
          .order("state", { ascending: true })
          .order("name", { ascending: true });
        if (simpleDist) loadedDistricts = simpleDist;
      }

      if (loadedDistricts && loadedDistricts.length > 0) {
        setDistricts(loadedDistricts);
        if (!sourceDistId) setSourceDistId(loadedDistricts[0].id);
        if (!targetDistId && loadedDistricts.length > 1)
          setTargetDistId(loadedDistricts[1].id);

        const firstInState = loadedDistricts.find(
          (d) => d.state === selectedState,
        );
        if (firstInState && !selectedDistrictId) {
          setSelectedDistrictId(firstInState.id);
        }
      }

      // 3. Roads GeoJSON
      const { data: rawRoads } = await supabase.rpc("get_roads_geojson", {
        p_limit: 8000,
      });
      if (rawRoads) {
        const parsed =
          typeof rawRoads === "string" ? JSON.parse(rawRoads) : rawRoads;
        const formatted = [];
        let c = 0,
          ar = 0,
          b = 0;
        parsed.forEach((r) => {
          if (r.status === "blocked") b++;
          else if (r.status === "at_risk") ar++;
          else c++;

          let rawCoords = r.coordinates;
          if (typeof rawCoords === "string") {
            try {
              rawCoords = JSON.parse(rawCoords);
            } catch {
              return;
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
                  formatted.push({ ...r, coordinates: line });
              });
            } else if (Array.isArray(rawCoords[0])) {
              const line = rawCoords.map((pt) => [
                Number(pt[1]),
                Number(pt[0]),
              ]);
              if (line.length >= 2) formatted.push({ ...r, coordinates: line });
            }
          }
        });
        setRoadSegments(formatted);
        setRoadStats({ clear: c, atRisk: ar, blocked: b });
      }

      // 4. Requisitions
      const reqRes = await fetch("/api/admin/requisitions");
      const reqData = await reqRes.json();
      if (reqData.success) {
        setRequisitions(reqData.requisitions || []);
      }
    } catch (err) {
      console.error("Apex initialization error:", err);
    } finally {
      setLoading(false);
    }
  }, [
    router,
    selectedState,
    sourceDistId,
    targetDistId,
    selectedDistrictId,
    fetchIncidents,
    fetchPendingApprovals,
  ]);

  // Initial mount
  useEffect(() => {
    fetchApexData();
  }, [fetchApexData]);

  // Realtime listeners for Incidents & User Approvals
  useEffect(() => {
    const incidentChannel = supabase
      .channel("apex:realtime_incidents")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incident_reports" },
        () => {
          fetchIncidents();
        },
      )
      .subscribe();

    const userChannel = supabase
      .channel("apex:realtime_approvals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_profiles" },
        () => {
          fetchPendingApprovals();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(incidentChannel);
      supabase.removeChannel(userChannel);
    };
  }, [fetchIncidents, fetchPendingApprovals]);

  const handleStateChange = (newState) => {
    setSelectedState(newState);
    const firstInNewState = districts.find((d) => d.state === newState);
    if (firstInNewState) {
      setSelectedDistrictId(firstInNewState.id);
    } else {
      setSelectedDistrictId("");
    }
  };

  const filteredDistricts = useMemo(() => {
    return districts.filter((d) => d.state === selectedState);
  }, [districts, selectedState]);

  const selectedDistrictObj = useMemo(() => {
    return (
      districts.find((d) => d.id === selectedDistrictId) ||
      filteredDistricts[0] ||
      districts[0]
    );
  }, [districts, selectedDistrictId, filteredDistricts]);

  const selectedCorridor = useMemo(() => {
    return (
      STRATEGIC_CORRIDORS.find((c) => c.id === selectedCorridorId) ||
      STRATEGIC_CORRIDORS[0]
    );
  }, [selectedCorridorId]);

  // Client-side road inventory for the selected district
  const districtRoadsInventory = useMemo(() => {
    if (!selectedDistrictObj || roadSegments.length === 0) return [];

    const bbox = getDistrictBBox(selectedDistrictObj);
    if (!bbox) {
      return roadSegments.slice(0, 25).map((r, idx) => ({
        id: r.id || `road-${idx}`,
        name: r.name || `Corridor Arterial ${idx + 1}`,
        highway: r.highway || "primary",
        status: r.status || "clear",
        length_meters: 14200,
      }));
    }

    const matched = [];
    for (const r of roadSegments) {
      if (!r.coordinates || r.coordinates.length === 0) continue;
      const isInside = r.coordinates.some(
        ([lat, lng]) =>
          lat >= bbox.minLat - 0.05 &&
          lat <= bbox.maxLat + 0.05 &&
          lng >= bbox.minLng - 0.05 &&
          lng <= bbox.maxLng + 0.05,
      );

      if (isInside) {
        matched.push({
          id: r.id,
          name: r.name || "District Inter-Connecting Highway",
          highway: r.highway || "primary",
          status: r.status || "clear",
          length_meters: Math.round(r.coordinates.length * 1100),
        });
      }
    }

    if (matched.length > 0) return matched;

    return roadSegments.slice(0, 30).map((r, idx) => ({
      id: r.id || `road-fb-${idx}`,
      name: r.name || `NH Route Segment ${idx + 1}`,
      highway: r.highway || "primary",
      status: r.status || "clear",
      length_meters: 12500,
    }));
  }, [selectedDistrictObj, roadSegments]);

  // Dynamic State Hazard Velocity mapping
  const stateHazardStats = useMemo(() => {
    const stats = {};
    NER_STATES.forEach((s) => {
      stats[s] = { blocked: 0, pending: 0, total: 0 };
    });

    incidents.forEach((inc) => {
      let stateName = inc.district?.state;

      if (!stateName && inc.district_id) {
        const foundDist = districts.find((d) => d.id === inc.district_id);
        if (foundDist) stateName = foundDist.state;
      }

      if (!stateName && inc.latitude && inc.longitude && districts.length > 0) {
        for (const dist of districts) {
          const bbox = getDistrictBBox(dist);
          if (
            bbox &&
            inc.latitude >= bbox.minLat &&
            inc.latitude <= bbox.maxLat &&
            inc.longitude >= bbox.minLng &&
            inc.longitude <= bbox.maxLng
          ) {
            stateName = dist.state;
            break;
          }
        }
      }

      stateName = stateName || "Assam";

      if (stats[stateName]) {
        if (inc.status === "verified") stats[stateName].blocked += 1;
        else if (inc.status === "pending") stats[stateName].pending += 1;
        stats[stateName].total =
          stats[stateName].blocked + stats[stateName].pending;
      }
    });

    return stats;
  }, [incidents, districts]);

  const hazardCompositionData = useMemo(() => {
    const landslides = incidents.filter((i) =>
      i.hazard_type?.includes("landslide"),
    ).length;
    const floods = incidents.filter(
      (i) =>
        i.hazard_type?.includes("flood") ||
        i.hazard_type?.includes("waterlogging"),
    ).length;
    const collapses = incidents.filter(
      (i) =>
        i.hazard_type?.includes("road_collapse") ||
        i.hazard_type?.includes("fallen_tree"),
    ).length;
    const others = incidents.length - landslides - floods - collapses;

    return [
      { label: "Landslide / Rockfall", value: landslides, color: "#d97706" },
      { label: "Flood / River Inundation", value: floods, color: "#0284c7" },
      { label: "Structural / Trees", value: collapses, color: "#dc2626" },
      {
        label: "Fog / Obstruction",
        value: Math.max(0, others),
        color: "#64748b",
      },
    ];
  }, [incidents]);

  const corridorHealthData = useMemo(() => {
    return [
      {
        label: "Clear Highway",
        value: roadStats.clear || 10,
        color: "#16a34a",
      },
      {
        label: "At Risk Corridor",
        value: roadStats.atRisk || 2,
        color: "#f59e0b",
      },
      {
        label: "Blocked Route",
        value: roadStats.blocked || 1,
        color: "#dc2626",
      },
    ];
  }, [roadStats]);

  const clearanceRate = useMemo(() => {
    if (restoralStats.total === 0) return 100;
    return Math.round((restoralStats.resolved / restoralStats.total) * 100);
  }, [restoralStats]);

  const handleApprovalDecision = async (userId, decision) => {
    const actionLabel =
      decision === "approve" ? "Authorize & Grant Access" : "Reject Account";
    if (!confirm(`Apex Authority: Are you sure you want to ${actionLabel}?`))
      return;

    setApprovalLoadingId(userId);
    try {
      const res = await fetch("/api/admin/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, decision }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(`Approval Error: ${data.error || "Failed to update user"}`);
        return;
      }
      await fetchPendingApprovals();
    } catch (err) {
      alert(`Network Error: ${err.message}`);
    } finally {
      setApprovalLoadingId(null);
    }
  };

  const handleCreateRequisition = async (e) => {
    e.preventDefault();
    if (sourceDistId === targetDistId) {
      alert("Source and Target districts must be different.");
      return;
    }

    setSubmittingReq(true);
    try {
      const res = await fetch("/api/admin/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceDistrictId: sourceDistId,
          targetDistrictId: targetDistId,
          resourceType: selectedResourceType,
          quantity: transferQty,
          authorizedBy: "MDoNER National Apex Desk",
          priority: "critical_emergency",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(`Authorization Failed: ${data.error || "Server error"}`);
        return;
      }

      alert(
        "Inter-District Resource Requisition Authorized and Transmitted to District DLOs!",
      );
      fetchApexData();
    } catch (err) {
      alert(`Network Error: ${err.message}`);
    } finally {
      setSubmittingReq(false);
    }
  };

  const handleSignOut = async () => {
    if (!confirm("Sign out of the Ministry Apex Command Desk?")) return;
    await supabase.auth.signOut();
    router.replace("/admin/login");
  };

  return (
    <main className="min-h-screen bg-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      <div className="fixed -right-20 top-20 pointer-events-none z-0">
        <AshokaChakraWatermark
          className="w-[580px] h-[580px]"
          opacity="0.025"
        />
      </div>

      <div className="h-1.5 w-full flex z-10">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      {/* Sovereign Apex Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white z-10">
        <div className="border-b border-slate-800 bg-slate-950 text-slate-400 text-[10px] sm:text-[11px] px-4 sm:px-8 py-1.5 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-200">
              भारत सरकार | Government of India
            </span>
            <span>•</span>
            <span>
              Ministry of Development of North Eastern Region (MDoNER) & NDMA
            </span>
          </div>
          <span className="font-mono text-cyan-400 text-[10px]">
            APEX CLEARANCE LEVEL 1
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
                <span className="bg-red-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Ministry Apex Desk
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                8-State National Highway Logistics & Emergency Allocation
                Command
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchApexData}
              disabled={loading}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded border border-slate-700 transition cursor-pointer min-h-[36px]"
            >
              <span
                className={loading ? "animate-spin inline-block mr-1" : "mr-1"}
              >
                🔄
              </span>
              <span>{loading ? "Refreshing..." : "Refresh Apex Data"}</span>
            </button>
            <Link
              href="/"
              className="text-xs font-semibold px-3 py-1.5 rounded bg-blue-800 hover:bg-blue-700 text-white transition min-h-[36px] flex items-center"
            >
              Citizen Radar
            </Link>
            <button
              onClick={handleSignOut}
              className="text-xs font-semibold px-3 py-1.5 rounded bg-rose-900 hover:bg-rose-800 text-rose-100 border border-rose-700 transition cursor-pointer min-h-[36px]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6 w-full flex-1 z-10">
        {/* 1. TOP DASHBOARD: SOVEREIGN ANALYTICS DECK WITH SVG CHARTS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-md border border-slate-200 shadow-2xs space-y-2">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Regional Corridor Health
              </span>
              <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                Macro Network
              </span>
            </div>
            <DonutChart data={corridorHealthData} size={115} />
          </div>

          <div className="bg-white p-4 rounded-md border border-slate-200 shadow-2xs space-y-2">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Hazard Composition
              </span>
              <span className="text-[10px] font-mono bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                {incidents.length} Recorded
              </span>
            </div>
            <DonutChart data={hazardCompositionData} size={115} />
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
            <div className="text-center py-2">
              <span className="text-4xl font-black text-slate-900 font-mono tracking-tight">
                {clearanceRate}%
              </span>
              <span className="text-[11px] text-slate-500 block mt-1 font-medium">
                Corridor Clearance & Reopening Efficiency
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2 rounded text-[11px] text-slate-600 text-center font-mono">
              Active Closures:{" "}
              <strong className="text-rose-700">{roadStats.blocked}</strong> •
              Restored:{" "}
              <strong className="text-emerald-700">
                {restoralStats.resolved}
              </strong>
            </div>
          </div>
        </div>

        {/* 2. MACRO DISASTER RADAR: STATE-BY-STATE HAZARD VELOCITY */}
        <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200 shadow-2xs space-y-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-900 block">
                Macro Disaster Radar
              </span>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                State-by-State Hazard Velocity (8 Northeastern States)
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500 font-bold">
              Live Synchronized
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {NER_STATES.map((st) => {
              const data = stateHazardStats[st] || {
                blocked: 0,
                pending: 0,
                total: 0,
              };
              const maxVal = Math.max(
                1,
                ...Object.values(stateHazardStats).map((v) => v.total),
              );
              const pct = Math.min(
                100,
                Math.round((data.total / maxVal) * 100),
              );

              return (
                <div
                  key={st}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <strong className="text-slate-900 font-bold">{st}</strong>
                    <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold text-slate-700">
                      Total: {data.total}
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-600 h-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] font-medium pt-0.5">
                    <span className="text-rose-700">
                      <strong>{data.blocked}</strong> Blocked
                    </span>
                    <span className="text-amber-700">
                      <strong>{data.pending}</strong> Pending Field Verification
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. LIFELINE DIAGNOSTICS: STRATEGIC LIFELINE CORRIDORS */}
        <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-900 block">
                Lifeline Diagnostics
              </span>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Strategic Lifeline Corridors (Siliguri Gap, Border Passes &
                Ridge Spines)
              </h2>
            </div>

            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-300 rounded px-3 py-1.5">
              <span className="text-xs font-bold text-slate-600 uppercase">
                Select Corridor:
              </span>
              <select
                value={selectedCorridorId}
                onChange={(e) => setSelectedCorridorId(e.target.value)}
                className="bg-transparent font-bold text-xs text-blue-950 focus:outline-hidden cursor-pointer"
              >
                {STRATEGIC_CORRIDORS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">
                  {selectedCorridor.classification}
                </span>
                <h3 className="text-base font-black text-slate-900">
                  {selectedCorridor.name}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {selectedCorridor.route}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`px-2.5 py-1 rounded text-xs font-black font-mono tracking-wider ${
                    selectedCorridor.status === "OPERATIONAL"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-amber-100 text-amber-800 border border-amber-300"
                  }`}
                >
                  ● {selectedCorridor.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Terrain Advisory
                </span>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  {selectedCorridor.terrainAdvisory}
                </p>
              </div>
              <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Military Readiness
                </span>
                <p className="text-slate-900 font-semibold text-[11px] leading-relaxed">
                  {selectedCorridor.militaryReadiness}
                </p>
              </div>
              <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Authorized Detour
                </span>
                <p className="text-cyan-800 font-semibold text-[11px] leading-relaxed">
                  {selectedCorridor.detoursAvailable}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. TACTICAL DISTRICT DIAGNOSTICS & VECTOR MINI-MAP (Side-by-Side) */}
        <div className="bg-white rounded-md border border-slate-200 shadow-2xs overflow-hidden p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <span className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">
                Tactical District Diagnostics
              </span>
              <h2 className="text-base font-black text-slate-900">
                District Highway Segment Inventory & Spatial Inspection
              </h2>
            </div>

            {/* State & District Selectors */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 rounded px-2.5 py-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  State:
                </span>
                <select
                  value={selectedState}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className="bg-transparent font-bold text-xs text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  {NER_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 rounded px-2.5 py-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  District:
                </span>
                <select
                  value={selectedDistrictId}
                  onChange={(e) => setSelectedDistrictId(e.target.value)}
                  className="bg-transparent font-bold text-xs text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  {filteredDistricts.length === 0 ? (
                    <option value="">No districts listed</option>
                  ) : (
                    filteredDistricts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Side-by-Side: Highway Table & Tactical Vector Map */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Highway Inventory Table */}
            <div className="lg:col-span-7 space-y-3">
              <div className="grid grid-cols-3 gap-2.5 text-xs font-mono">
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-[9px] font-sans font-bold text-slate-400 uppercase block">
                    Selected District
                  </span>
                  <strong className="text-slate-900 font-sans text-xs truncate block">
                    {selectedDistrictObj?.name || "District"}
                  </strong>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-[9px] font-sans font-bold text-slate-400 uppercase block">
                    Mapped Segments
                  </span>
                  <strong className="text-slate-900 text-xs">
                    {districtRoadsInventory.length} Roads
                  </strong>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-[9px] font-sans font-bold text-slate-400 uppercase block">
                    District Closures
                  </span>
                  <strong className="text-rose-700 text-xs">
                    {
                      districtRoadsInventory.filter(
                        (r) => r.status === "blocked",
                      ).length
                    }{" "}
                    Blocked
                  </strong>
                </div>
              </div>

              <div className="border border-slate-200 rounded overflow-hidden">
                <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 uppercase text-[10px]">
                    Highway Inventory ({selectedDistrictObj?.name || "District"}
                    )
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {districtRoadsInventory.length} Segments Monitored
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-400 uppercase text-[9px] font-bold">
                        <th className="py-2 px-3">Corridor Name</th>
                        <th className="py-2 px-3">Class</th>
                        <th className="py-2 px-3">Approx Length</th>
                        <th className="py-2 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans text-[11px]">
                      {districtRoadsInventory.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-6 text-center text-slate-400 italic"
                          >
                            No highway segments mapped for this sector.
                          </td>
                        </tr>
                      ) : (
                        districtRoadsInventory.map((road) => (
                          <tr key={road.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              {road.name}
                            </td>
                            <td className="py-2 px-3 text-slate-500 capitalize">
                              {road.highway}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {road.length_meters
                                ? `${(road.length_meters / 1000).toFixed(1)} km`
                                : "10.5 km"}
                            </td>
                            <td className="py-2 px-3 text-right font-bold">
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] uppercase font-mono ${
                                  road.status === "blocked"
                                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                                    : road.status === "at_risk"
                                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                                      : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                }`}
                              >
                                {road.status || "CLEAR"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: Tactical Vector Map */}
            <div className="lg:col-span-5 bg-slate-50 rounded border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-3.5 py-2 bg-slate-100/70 border-b border-slate-200 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-700 uppercase">
                  Tactical Vector Radar:{" "}
                  {selectedDistrictObj?.name || "District"}
                </span>
                <span className="text-[9px] font-mono bg-blue-100 text-blue-900 px-1.5 py-0.2 rounded font-bold">
                  Auto-Centered
                </span>
              </div>
              <div className="h-[340px] w-full relative">
                <DistrictMap
                  targetDistrict={selectedDistrictObj}
                  allDistricts={districts}
                  roadSegments={roadSegments}
                  incidents={incidents}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 5. PERSONNEL ACCESS CLEARANCE QUEUE (RBAC GATING) */}
        <div className="bg-white rounded-md border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-amber-50 border-b border-amber-200 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span>🛡️</span>
              <h3 className="text-xs sm:text-sm font-bold text-amber-900 uppercase tracking-wide">
                Personnel RBAC Clearance Queue (Pending DLO & Field Officer
                Signups)
              </h3>
            </div>
            <span className="text-xs font-mono text-amber-800 font-bold">
              {pendingApprovals.length} Awaiting Apex Vetting
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-4">Officer Name</th>
                  <th className="py-2.5 px-4">Role Requested</th>
                  <th className="py-2.5 px-4">District Assignment</th>
                  <th className="py-2.5 px-4">Registration Date</th>
                  <th className="py-2.5 px-4 text-right">
                    Apex Statutory Decision
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingApprovals.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-slate-400 italic"
                    >
                      No personnel accounts currently awaiting administrative
                      clearance.
                    </td>
                  </tr>
                ) : (
                  pendingApprovals.map((officer) => (
                    <tr key={officer.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {officer.full_name || "Unnamed Personnel"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono uppercase text-[9px] px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 border border-blue-300">
                          {String(officer.role).replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {districts.find(
                          (d) => d.id === officer.assigned_district_id,
                        )?.name || "Unassigned / Regional"}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {officer.created_at
                          ? new Date(officer.created_at).toLocaleDateString()
                          : "Recent"}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() =>
                            handleApprovalDecision(officer.id, "approve")
                          }
                          disabled={approvalLoadingId === officer.id}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded transition shadow-xs cursor-pointer disabled:opacity-50 min-h-[36px]"
                        >
                          {approvalLoadingId === officer.id
                            ? "Authorizing..."
                            : "✓ Approve & Activate"}
                        </button>
                        <button
                          onClick={() =>
                            handleApprovalDecision(officer.id, "reject")
                          }
                          disabled={approvalLoadingId === officer.id}
                          className="px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs rounded transition border border-rose-300 cursor-pointer disabled:opacity-50 min-h-[36px]"
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

        {/* 6. OFFICER & DLO PROVISIONING DESK (ISOLATED ZERO-LAG FORM) */}
        <OfficerProvisioningDesk districts={districts} />

        {/* 7. INTER-DISTRICT HEAVY MACHINERY REQUISITION */}
        <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <div>
              <span className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">
                Statutory Resource Allocation
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Inter-District Emergency Resource Requisition
              </h3>
              <p className="text-[11px] text-slate-500">
                Apex mandate to transfer heavy earthmovers, Bailey bridge units,
                and motorized craft between districts.
              </p>
            </div>
            <span className="text-2xl">🚜</span>
          </div>

          <form
            onSubmit={handleCreateRequisition}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs"
          >
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Source District (Stockpile):
              </label>
              <select
                value={sourceDistId}
                onChange={(e) => setSourceDistId(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white text-slate-800"
              >
                {districts.map((d) => (
                  <option key={`src-${d.id}`} value={d.id}>
                    {d.name} ({d.state})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Target District (Emergency Sector):
              </label>
              <select
                value={targetDistId}
                onChange={(e) => setTargetDistId(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white text-slate-800"
              >
                {districts.map((d) => (
                  <option key={`tgt-${d.id}`} value={d.id}>
                    {d.name} ({d.state})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Machinery / Resource Type:
              </label>
              <select
                value={selectedResourceType}
                onChange={(e) => setSelectedResourceType(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white text-slate-800"
              >
                <option value="earthmover_jcb">Heavy JCB / Excavator</option>
                <option value="bailey_bridge_unit">
                  BRO Modular Bailey Bridge Kit
                </option>
                <option value="inflatable_rescue_boat">
                  SDRF Inflatable Motorized Craft
                </option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Quantity Units:
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs bg-white text-slate-800"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4 pt-1">
              <button
                type="submit"
                disabled={submittingReq || loading}
                className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded text-xs transition shadow-xs cursor-pointer disabled:opacity-50 min-h-[40px] flex items-center justify-center space-x-2"
              >
                <span>⚡</span>
                <span>
                  {submittingReq
                    ? "Authorizing Dispatch..."
                    : "Authorize Inter-District Requisition"}
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* 8. ACTIVE REQUISITION DISPATCH AUDIT LOG */}
        <div className="bg-white rounded-md border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Active Inter-District Resource Dispatches
            </h3>
            <span className="text-xs font-mono text-slate-500 font-bold">
              {requisitions.length} Dispatches
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-4">Resource</th>
                  <th className="py-2.5 px-4">Units</th>
                  <th className="py-2.5 px-4">Origin District</th>
                  <th className="py-2.5 px-4">Destination District</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Authorized By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requisitions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-slate-400 italic"
                    >
                      No inter-district resource transfers currently active.
                    </td>
                  </tr>
                ) : (
                  requisitions.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-800 capitalize">
                        {req.resource_type.replace(/_/g, " ")}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-900">
                        {req.quantity}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {req.source_district?.name || "Central Stockpile"}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {req.target_district?.name || "Affected Sector"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold uppercase text-[9px] px-2 py-0.5 rounded">
                          {req.requisition_status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                        {req.authorized_by}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <GovFooter />
    </main>
  );
}