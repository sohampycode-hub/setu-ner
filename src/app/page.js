"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../utils/supabase";
import {
  queueIncidentLocally,
  syncOfflineQueue,
  getQueuedIncidents,
} from "../utils/offlineQueue";
import TransitManifestModal from "../components/TransitManifestModal";
import { playHazardProximityAlert } from "../utils/audioAlert";
import GovHeader from "../components/GovHeader";
import GovFooter from "../components/GovFooter";
import RiskEngineSync from "../components/RiskEngineSync";

const GisMap = dynamic(() => import("../components/GisMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 text-sm font-medium p-4 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-700 mb-3" />
      <span>Loading Geospatial Visualizer...</span>
    </div>
  ),
});

const VEHICLE_MODES = [
  { id: "car", label: "Car", icon: "🚗", speed: 46 },
  { id: "bike", label: "Bike", icon: "🏍️", speed: 42 },
  { id: "bus", label: "Bus", icon: "🚌", speed: 34 },
  { id: "truck", label: "Truck", icon: "🚛", speed: 30 },
  { id: "auto", label: "Auto", icon: "🛺", speed: 26 },
];

const HAZARD_CATALOG = [
  { id: "landslide", label: "Landslide / Rockfall", icon: "⛰️" },
  { id: "flash_flood", label: "Flash Flood", icon: "🌊" },
  { id: "road_collapse", label: "Road / Culvert Collapse", icon: "🚧" },
  { id: "fallen_tree", label: "Fallen Tree / Debris", icon: "🌲" },
  { id: "dense_fog", label: "Dense Fog / Zero Visibility", icon: "🌫️" },
  { id: "waterlogging", label: "Severe Waterlogging", icon: "💧" },
  { id: "avalanche", label: "Snow Avalanche / Ice", icon: "❄️" },
];

function getPolygonCentroid(district) {
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

  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  for (const pt of coords) {
    if (Array.isArray(pt) && pt.length >= 2) {
      sumLng += Number(pt[0]);
      sumLat += Number(pt[1]);
      count++;
    }
  }

  if (count === 0) return null;
  return { lat: sumLat / count, lng: sumLng / count };
}

function calculateBearing(startLat, startLng, endLat, endLng) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const φ1 = toRad(startLat);
  const φ2 = toRad(endLat);
  const Δλ = toRad(endLng - startLng);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return (toDeg(θ) + 360) % 360;
}

function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isPointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function findDistrictContainingPoint(lat, lng, districtsList) {
  if (!districtsList || districtsList.length === 0) return null;

  for (const dist of districtsList) {
    let geom =
      dist.geojson ||
      (typeof dist.boundary === "string"
        ? JSON.parse(dist.boundary)
        : dist.boundary);
    if (!geom) continue;

    if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
      if (isPointInRing(lat, lng, geom.coordinates[0])) {
        return dist;
      }
    } else if (
      geom.type === "MultiPolygon" &&
      Array.isArray(geom.coordinates)
    ) {
      for (const poly of geom.coordinates) {
        if (isPointInRing(lat, lng, poly[0])) {
          return dist;
        }
      }
    }
  }

  let closestDist = null;
  let minDistance = 25;

  for (const dist of districtsList) {
    const centroid = getPolygonCentroid(dist);
    if (centroid) {
      const dKm = calculateHaversineDistanceKm(
        lat,
        lng,
        centroid.lat,
        centroid.lng,
      );
      if (dKm < minDistance) {
        minDistance = dKm;
        closestDist = dist;
      }
    }
  }

  return closestDist;
}

export default function HomePage() {
  const [mapKey, setMapKey] = useState(0);
  const [districts, setDistricts] = useState([]);
  const [roadSegments, setRoadSegments] = useState([]);
  const [verifiedIncidents, setVerifiedIncidents] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [stats, setStats] = useState({ clear: 0, atRisk: 0, blocked: 0 });
  const [inspectedLocation, setInspectedLocation] = useState(null);
  const [inspectedOutsideWarning, setInspectedOutsideWarning] = useState(false);
  const [weatherTelemetry, setWeatherTelemetry] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSubmittedStatus, setReportSubmittedStatus] = useState(null);

  const [activeTab, setActiveTab] = useState("routing");

  // Dynamic Routing State & Vehicle Selection
  const [selectedVehicle, setSelectedVehicle] = useState("car");
  const [selectedOriginDistId, setSelectedOriginDistId] = useState("");
  const [selectedDestDistId, setSelectedDestDistId] = useState("");
  const [customOrigin, setCustomOrigin] = useState(null);
  const [customDest, setCustomDest] = useState(null);
  const [waypointMode, setWaypointMode] = useState(null);
  const [primaryRoute, setPrimaryRoute] = useState(null);
  const [alternativeRoute, setAlternativeRoute] = useState(null);
  const [selectedRouteKey, setSelectedRouteKey] = useState("primary");
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState("");

  // Live GPS Journey & Proximity State
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [livePosition, setLivePosition] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [impendingHazard, setImpendingHazard] = useState(null);
  const [isRerouting, setIsRerouting] = useState(false);
  const watchIdRef = useRef(null);
  const simulationIntervalRef = useRef(null);

  // Offline Sync State
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Manifest Modals
  const [isManifestOpen, setIsManifestOpen] = useState(false);

  // Citizen Multi-Hazard & Photo Evidence Upload State
  const [reportHazardType, setReportHazardType] = useState("landslide");
  const [reportDescription, setReportDescription] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  const fetchWeather = async (lat, lng) => {
    setWeatherLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,snowfall,wind_speed_10m,wind_gusts_10m,surface_pressure,cloud_cover,visibility&daily=precipitation_sum&timezone=auto`;
      const res = await fetch(url);
      const data = await res.json();
      setWeatherTelemetry({
        ...data?.current,
        precip_24h:
          data?.daily?.precipitation_sum?.[0] ??
          data?.current?.precipitation ??
          0,
      });
    } catch {
      setWeatherTelemetry(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  const isFetchingRoadsRef = useRef(false);

  const fetchCorridorData = useCallback(async () => {
    // Guard: Never allow overlapping concurrent fetches
    if (isFetchingRoadsRef.current) return;
    isFetchingRoadsRef.current = true;
    setDataLoading(true);

    try {
      // 1. Fetch Districts
      let loadedDistricts = [];
      const { data: rpcDistricts, error: rpcErr } = await supabase.rpc(
        "get_districts_geojson",
      );

      if (!rpcErr && rpcDistricts) {
        loadedDistricts =
          typeof rpcDistricts === "string"
            ? JSON.parse(rpcDistricts)
            : rpcDistricts;
      } else {
        const { data: simpleDist } = await supabase
          .from("districts")
          .select("id, osm_id, name, state, color_hex, boundary")
          .order("state", { ascending: true })
          .order("name", { ascending: true });
        if (simpleDist) loadedDistricts = simpleDist;
      }

      if (loadedDistricts && loadedDistricts.length > 0) {
        setDistricts(loadedDistricts);
        setSelectedOriginDistId((prev) => prev || loadedDistricts[0].id);
        if (loadedDistricts.length > 1) {
          setSelectedDestDistId((prev) => prev || loadedDistricts[1].id);
        }

        // Set initial location once without causing recursive re-fetch
        setInspectedLocation((prev) => {
          if (prev) return prev;
          const firstCentroid = getPolygonCentroid(loadedDistricts[0]);
          if (firstCentroid) {
            fetchWeather(firstCentroid.lat, firstCentroid.lng);
            return {
              lat: firstCentroid.lat.toFixed(4),
              lng: firstCentroid.lng.toFixed(4),
              name: loadedDistricts[0].name,
              state: loadedDistricts[0].state,
              timestamp: Date.now(),
            };
          }
          return null;
        });
      }

      // 2. Fetch Incidents
      try {
        // Fetch incidents with pending count
        const incRes = await fetch("/api/incidents?filter=all");
        const incJson = await incRes.json();
        if (incJson.success) {
          const list = incJson.data || incJson.incidents || [];
          setVerifiedIncidents(list);

          const count =
            incJson.pendingCount !== undefined
              ? incJson.pendingCount
              : list.filter((i) => i.status === "pending").length;
          setPendingCount(count);
        }
      } catch (incErr) {
        console.warn("Incident fetch notice:", incErr.message);
      }

      // 3. Fetch Full 10,000 Corridors (Bypasses 1,000 row cap)
      const { data: rawRoads, error: roadErr } = await supabase.rpc(
        "get_roads_geojson",
        { p_limit: 10000 },
      );

      if (roadErr) {
        console.error("get_roads_geojson RPC Error:", roadErr.message);
        return;
      }

      if (rawRoads) {
        // Unpack the full scalar array
        const roadsData =
          typeof rawRoads === "string" ? JSON.parse(rawRoads) : rawRoads;
        console.log(`Received ${roadsData.length} records from database.`);

        const formattedRoads = [];
        let clearCount = 0;
        let atRiskCount = 0;
        let blockedCount = 0;

        for (let i = 0; i < roadsData.length; i++) {
          const road = roadsData[i];
          let rawCoords = road.coordinates;

          if (typeof rawCoords === "string") {
            try {
              rawCoords = JSON.parse(rawCoords);
            } catch {
              continue;
            }
          }

          if (!Array.isArray(rawCoords) || rawCoords.length === 0) continue;

          // MultiLineString: [[[lng, lat], ...], ...]
          if (Array.isArray(rawCoords[0]) && Array.isArray(rawCoords[0][0])) {
            rawCoords.forEach((subLine, subIdx) => {
              const line = subLine
                .filter(
                  (pt) =>
                    Array.isArray(pt) &&
                    pt.length >= 2 &&
                    !isNaN(pt[0]) &&
                    !isNaN(pt[1]),
                )
                .map((pt) => [Number(pt[1]), Number(pt[0])]); // [lng, lat] -> [lat, lng]

              if (line.length >= 2) {
                if (road.status === "blocked") blockedCount++;
                else if (road.status === "at_risk") atRiskCount++;
                else clearCount++;

                formattedRoads.push({
                  ...road,
                  uniqueKey: `road-${road.id || i}-sub-${subIdx}-${road.risk_score || 0}-${road.rainfall_factor || 0}`,
                  coordinates: line,
                });
              }
            });
          }
          // LineString: [[lng, lat], [lng, lat], ...]
          else if (Array.isArray(rawCoords[0])) {
            const line = rawCoords
              .filter(
                (pt) =>
                  Array.isArray(pt) &&
                  pt.length >= 2 &&
                  !isNaN(pt[0]) &&
                  !isNaN(pt[1]),
              )
              .map((pt) => [Number(pt[1]), Number(pt[0])]); // [lng, lat] -> [lat, lng]

            if (line.length >= 2) {
              if (road.status === "blocked") blockedCount++;
              else if (road.status === "at_risk") atRiskCount++;
              else clearCount++;

              formattedRoads.push({
                ...road,
                uniqueKey: `road-${road.id || i}-single-${road.risk_score || 0}-${road.rainfall_factor || 0}`,
                coordinates: line,
              });
            }
          }
        }

        console.log(
          `Rendered all ${formattedRoads.length} segments across the map.`,
        );
        setRoadSegments(formattedRoads);
        setStats({
          clear: clearCount,
          atRisk: atRiskCount,
          blocked: blockedCount,
        });
      }
    } catch (err) {
      console.error("Failed to load corridor layers:", err);
    } finally {
      setDataLoading(false);
      isFetchingRoadsRef.current = false;
    }
  }, []); // Empty dependencies: completely isolates the fetch lifecycle

  useEffect(() => {
    fetchCorridorData();

    const channel = supabase
      .channel("realtime:incident_reports")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incident_reports" },
        () => {
          fetchCorridorData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCorridorData]);

  const handleRefreshMap = async () => {
    setMapKey((prev) => prev + 1);
    await fetchCorridorData();
  };

  const handleManualSync = async () => {
    try {
      const res = await syncOfflineQueue();
      if (res?.syncedCount > 0) {
        alert(
          `Successfully synchronized ${res.syncedCount} queued hazard report(s)!`,
        );
        await fetchCorridorData();
      }
      const remaining = await getQueuedIncidents();
      setOfflineQueueCount(remaining.length);
    } catch (e) {
      alert(`Sync error: ${e.message}`);
    }
  };

  useEffect(() => {
    setIsOnline(typeof window !== "undefined" ? navigator.onLine : true);

    const refreshPendingQueue = async () => {
      try {
        const queued = await getQueuedIncidents();
        setOfflineQueueCount(queued.length);
      } catch (err) {
        console.warn("Could not inspect local queue:", err);
      }
    };

    refreshPendingQueue();

    const handleOnline = async () => {
      setIsOnline(true);
      try {
        const result = await syncOfflineQueue();
        if (result?.syncedCount > 0) {
          fetchCorridorData();
        }
        const remaining = await getQueuedIncidents();
        setOfflineQueueCount(remaining.length);
      } catch (err) {
        console.error("Auto-sync notice:", err);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, [fetchCorridorData]);

  const activeWaypoints = useMemo(() => {
    let originObj = null;
    let destObj = null;

    if (customOrigin) {
      originObj = customOrigin;
    } else if (selectedOriginDistId) {
      const dist = districts.find((d) => d.id === selectedOriginDistId);
      if (dist) {
        const centroid = getPolygonCentroid(dist);
        if (centroid) {
          originObj = {
            name: `${dist.name} (${dist.state})`,
            lat: centroid.lat,
            lng: centroid.lng,
          };
        }
      }
    }

    if (customDest) {
      destObj = customDest;
    } else if (selectedDestDistId) {
      const dist = districts.find((d) => d.id === selectedDestDistId);
      if (dist) {
        const centroid = getPolygonCentroid(dist);
        if (centroid) {
          destObj = {
            name: `${dist.name} (${dist.state})`,
            lat: centroid.lat,
            lng: centroid.lng,
          };
        }
      }
    }

    return { origin: originObj, destination: destObj };
  }, [
    districts,
    selectedOriginDistId,
    selectedDestDistId,
    customOrigin,
    customDest,
  ]);

  const isSameLocation = useMemo(() => {
    if (customOrigin || customDest) return false;
    return (
      selectedOriginDistId &&
      selectedDestDistId &&
      selectedOriginDistId === selectedDestDistId
    );
  }, [selectedOriginDistId, selectedDestDistId, customOrigin, customDest]);

  const currentlyActiveRoute = useMemo(() => {
    if (selectedRouteKey === "alternative" && alternativeRoute) {
      return alternativeRoute;
    }
    return primaryRoute;
  }, [selectedRouteKey, primaryRoute, alternativeRoute]);

  const checkInTransitProximity = useCallback(
    (currentLat, currentLng) => {
      if (!verifiedIncidents || verifiedIncidents.length === 0) {
        setImpendingHazard(null);
        return;
      }

      for (const inc of verifiedIncidents) {
        const distKm = calculateHaversineDistanceKm(
          currentLat,
          currentLng,
          inc.latitude,
          inc.longitude,
        );
        if (distKm <= 8.0) {
          setImpendingHazard({
            id: inc.id,
            hazardType: inc.hazard_type.replace("_", " ").toUpperCase(),
            description: inc.description,
            distanceKm: distKm.toFixed(1),
            latitude: inc.latitude,
            longitude: inc.longitude,
          });

          // Trigger Tactical Sound Chime
          playHazardProximityAlert();
          return;
        }
      }
      setImpendingHazard(null);
    },
    [verifiedIncidents],
  );

  const handleCalculateRoute = async (
    customStart = null,
    customEnd = null,
    overrideVehicle = null,
  ) => {
    const originPoint = customStart || activeWaypoints.origin;
    const destPoint = customEnd || activeWaypoints.destination;
    const mode = overrideVehicle || selectedVehicle;

    if (!originPoint || !destPoint) {
      setRoutingError("Select valid origin and destination coordinates.");
      return;
    }

    if (!customStart && !customEnd && isSameLocation) {
      setRoutingError(
        "Origin and Destination cannot be the same district. Please choose two distinct locations.",
      );
      return;
    }

    setRoutingLoading(true);
    setRoutingError("");
    setSelectedRouteKey("primary");
    setImpendingHazard(null);
    handleStopJourney();

    try {
      const res = await fetch("/api/routing/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startLat: originPoint.lat,
          startLng: originPoint.lng,
          endLat: destPoint.lat,
          endLng: destPoint.lng,
          vehicleType: mode,
        }),
      });

      const json = await res.json();
      if (!json.success)
        throw new Error(json.error || "Failed to compute route.");

      setPrimaryRoute(json.safeRoute);
      setAlternativeRoute(json.alternativeRoute || null);
    } catch (err) {
      setRoutingError(err.message || "Routing calculation failed.");
    } finally {
      setRoutingLoading(false);
    }
  };

  const handleClearTrajectory = () => {
    handleStopJourney();
    setPrimaryRoute(null);
    setAlternativeRoute(null);
    setSelectedRouteKey("primary");
    setRoutingError("");
    setImpendingHazard(null);
    setCustomOrigin(null);
    setCustomDest(null);
    setWaypointMode(null);
  };

  const handleVehicleChange = (newMode) => {
    setSelectedVehicle(newMode);
    if (primaryRoute) {
      handleCalculateRoute(
        activeWaypoints.origin,
        activeWaypoints.destination,
        newMode,
      );
    }
  };

  const handleDynamicReroute = async () => {
    if (!livePosition || !activeWaypoints.destination) return;

    setIsRerouting(true);
    try {
      const res = await fetch("/api/routing/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startLat: livePosition.lat,
          startLng: livePosition.lng,
          endLat: activeWaypoints.destination.lat,
          endLng: activeWaypoints.destination.lng,
          avoidLat: impendingHazard?.latitude,
          avoidLng: impendingHazard?.longitude,
          vehicleType: selectedVehicle,
        }),
      });

      const json = await res.json();
      if (json.success && json.safeRoute) {
        setPrimaryRoute(json.safeRoute);
        setAlternativeRoute(json.alternativeRoute || null);
        setSelectedRouteKey("primary");
        setImpendingHazard(null);
      }
    } catch (err) {
      console.error("Dynamic reroute error:", err);
    } finally {
      setIsRerouting(false);
    }
  };

  const handleStartLiveJourney = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    handleStopJourney();
    setIsNavigating(true);
    setIsSimulating(false);

    const activeProfile = VEHICLE_MODES.find((v) => v.id === selectedVehicle);
    const nominalSpeed = activeProfile ? activeProfile.speed : 38;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, heading, speed, accuracy } = pos.coords;
        setGpsAccuracy(accuracy ? Math.round(accuracy) : null);
        setLivePosition({
          lat: latitude,
          lng: longitude,
          heading: heading || 0,
          speed: speed ? Math.round(speed * 3.6) : nominalSpeed,
          accuracy: Math.round(accuracy),
        });
        checkInTransitProximity(latitude, longitude);
      },
      (err) => console.warn("GPS notice:", err.message),
      { enableHighAccuracy: true },
    );

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading, speed, accuracy } = pos.coords;
        setGpsAccuracy(accuracy ? Math.round(accuracy) : null);
        setLivePosition({
          lat: latitude,
          lng: longitude,
          heading: heading || 0,
          speed: speed ? Math.round(speed * 3.6) : nominalSpeed,
          accuracy: Math.round(accuracy),
        });
        checkInTransitProximity(latitude, longitude);
      },
      (err) => console.warn("GPS stream notice:", err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );

    watchIdRef.current = id;
  };

  const handleStartSimulation = () => {
    if (
      !currentlyActiveRoute?.coordinates ||
      currentlyActiveRoute.coordinates.length < 2
    )
      return;

    handleStopJourney();
    setIsNavigating(true);
    setIsSimulating(true);
    setGpsAccuracy(5);

    const coords = currentlyActiveRoute.coordinates;
    let stepIndex = 0;

    const activeProfile = VEHICLE_MODES.find((v) => v.id === selectedVehicle);
    const simSpeed = activeProfile ? activeProfile.speed : 38;

    setLivePosition({
      lat: coords[0][0],
      lng: coords[0][1],
      heading: calculateBearing(
        coords[0][0],
        coords[0][1],
        coords[1][0],
        coords[1][1],
      ),
      speed: simSpeed,
      accuracy: 5,
    });
    checkInTransitProximity(coords[0][0], coords[0][1]);

    const tickInterval = Math.max(450, 1000 - (simSpeed - 20) * 15);

    simulationIntervalRef.current = setInterval(() => {
      stepIndex += 1;
      if (stepIndex >= coords.length) {
        handleStopJourney();
        return;
      }

      const prev = coords[stepIndex - 1];
      const curr = coords[stepIndex];
      const heading = calculateBearing(prev[0], prev[1], curr[0], curr[1]);

      setLivePosition({
        lat: curr[0],
        lng: curr[1],
        heading,
        speed: simSpeed,
        accuracy: 5,
      });

      checkInTransitProximity(curr[0], curr[1]);
    }, tickInterval);
  };

  const handleStopJourney = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setIsNavigating(false);
    setIsSimulating(false);
    setLivePosition(null);
    setGpsAccuracy(null);
    setImpendingHazard(null);
  };

  const handleWaypointSet = (lat, lng) => {
    if (waypointMode === "origin") {
      const newOrigin = {
        name: `Pinned Origin (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
        lat,
        lng,
      };
      setCustomOrigin(newOrigin);
      setWaypointMode(null);
      if (activeWaypoints.destination) {
        handleCalculateRoute(newOrigin, activeWaypoints.destination);
      }
    } else if (waypointMode === "destination") {
      const newDest = {
        name: `Pinned Target (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
        lat,
        lng,
      };
      setCustomDest(newDest);
      setWaypointMode(null);
      if (activeWaypoints.origin) {
        handleCalculateRoute(activeWaypoints.origin, newDest);
      }
    }
  };

  const handleWaypointDrag = (type, lat, lng) => {
    const formattedName = `Pinned Point (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
    if (type === "origin") {
      const newOrigin = { name: formattedName, lat, lng };
      setCustomOrigin(newOrigin);
      if (activeWaypoints.destination) {
        handleCalculateRoute(newOrigin, activeWaypoints.destination);
      }
    } else {
      const newDest = { name: formattedName, lat, lng };
      setCustomDest(newDest);
      if (activeWaypoints.origin) {
        handleCalculateRoute(activeWaypoints.origin, newDest);
      }
    }
  };

  const handleMapInspect = async (lat, lng, targetObj = null) => {
    setReportSubmittedStatus(null);

    const matchedDistrict = targetObj?.id
      ? targetObj
      : findDistrictContainingPoint(Number(lat), Number(lng), districts);

    if (!matchedDistrict) {
      setInspectedOutsideWarning(true);
      setInspectedLocation({
        lat: Number(lat).toFixed(4),
        lng: Number(lng).toFixed(4),
        name: "Non-Jurisdictional Territory",
        state: "Outside Republic of India (NER Scope)",
        timestamp: Date.now(),
      });
      setWeatherTelemetry(null);
      return;
    }

    setInspectedOutsideWarning(false);
    setInspectedLocation({
      lat: Number(lat).toFixed(4),
      lng: Number(lng).toFixed(4),
      name: matchedDistrict.name || "Selected Corridor Coordinate",
      state: matchedDistrict.state || "Northeastern Sector",
      timestamp: Date.now(),
    });

    fetchWeather(lat, lng);
  };

  // Client-Side Canvas Image Compression Helper (~150-250 KB)
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (PNG, JPG, JPEG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const scaleSize = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
        setSelectedPhoto(compressedBase64);
        setPhotoPreview(compressedBase64);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleClearPhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCitizenSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!inspectedLocation || inspectedOutsideWarning) return;

    setSubmittingReport(true);
    setReportSubmittedStatus(null);

    let uploadedUrl = null;

    if (selectedPhoto && navigator.onLine) {
      try {
        const res = await fetch(selectedPhoto);
        const blob = await res.blob();
        const fileName = `hazard-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("incident-evidence")
          .upload(fileName, blob, { contentType: "image/jpeg" });

        if (!uploadErr && uploadData) {
          const { data: pubUrlData } = supabase.storage
            .from("incident-evidence")
            .getPublicUrl(fileName);
          uploadedUrl = pubUrlData?.publicUrl || null;
        } else {
          uploadedUrl = selectedPhoto;
        }
      } catch (uploadException) {
        console.warn("Storage upload notice:", uploadException);
        uploadedUrl = selectedPhoto;
      }
    } else if (selectedPhoto) {
      uploadedUrl = selectedPhoto;
    }

    // Read directly from DOM to prevent React re-rendering the whole map on every character typed
    const descInput = document.getElementById("hazard-report-description");
    const descriptionText =
      descInput?.value?.trim() ||
      reportDescription?.trim() ||
      `Citizen hazard advisory (${reportHazardType.replace("_", " ")}) near ${inspectedLocation.name}`;

    const payload = {
      hazardType: reportHazardType,
      severity: "critical_blocked",
      description: descriptionText,
      latitude: Number(inspectedLocation.lat),
      longitude: Number(inspectedLocation.lng),
      radiusMeters: 2500,
      userRole: "citizen",
      photoUrl: uploadedUrl,
    };

    if (!navigator.onLine) {
      try {
        await queueIncidentLocally(payload);
        const queued = await getQueuedIncidents();
        setOfflineQueueCount(queued.length);
        setReportSubmittedStatus(
          "Offline Mode: Advisory & photographic proof saved locally. Transmitting automatically when network restores.",
        );
        handleClearPhoto();

        // Clear textarea directly in offline success path
        if (descInput) descInput.value = "";
        setReportDescription("");
      } catch (err) {
        console.error("Offline storage error:", err);
      } finally {
        setSubmittingReport(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setReportSubmittedStatus(
          "Advisory & photo evidence registered. Awaiting Field Officer inspection.",
        );
        handleClearPhoto();

        // Clear textarea directly in online success path
        if (descInput) descInput.value = "";
        setReportDescription("");

        // Optimistically add the pending report to the map and increment pending counter
        const newPendingIncident = {
          id: json.data?.id || `pending-${Date.now()}`,
          latitude: Number(inspectedLocation.lat),
          longitude: Number(inspectedLocation.lng),
          hazard_type: reportHazardType,
          description: descriptionText,
          status: "pending",
          photo_url: uploadedUrl,
          created_at: new Date().toISOString(),
        };

        const createdItem = json.incident || json.data || newPendingIncident;

        // 1. Force state update directly
        setVerifiedIncidents((prev) => [createdItem, ...(prev || [])]);
        if (typeof setPendingCount === "function") {
          setPendingCount((prev) => (Number(prev) || 0) + 1);
        }

        // 2. Delay background refetch so database commit finishes first
        setTimeout(() => {
          fetchCorridorData();
        }, 1200);
      } else {
        throw new Error(json.error || "Submission failed");
      }
    } catch (err) {
      console.warn(
        "Direct upload rejected, saving to local queue:",
        err.message,
      );
      await queueIncidentLocally(payload);
      const queued = await getQueuedIncidents();
      setOfflineQueueCount(queued.length);
      setReportSubmittedStatus(
        "Poor connection detected. Saved report & photo to local queue. Will auto-sync when online.",
      );
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <main
      id="main-content"
      className="min-h-screen bg-slate-50 flex flex-col font-sans overflow-x-hidden"
    >
      {/* GIGW 3.0 Standard Institutional Sovereign Header */}
      <GovHeader
        isOnline={isOnline}
        offlineQueueCount={offlineQueueCount}
        onManualSync={handleManualSync}
      />

      <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full space-y-3 sm:space-y-4 flex-1 flex flex-col print:hidden">
        {/* Metric Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          <RiskEngineSync onSyncComplete={fetchCorridorData} />
          <div className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 font-medium shrink-0">
            Districts:{" "}
            <strong className="text-slate-900">{districts.length}</strong>
          </div>
          <div className="px-2.5 py-1 bg-green-50 border border-green-200 text-green-800 rounded font-bold shrink-0">
            ● Clear: {stats.clear}
          </div>
          <div className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded font-bold shrink-0">
            ● At Risk: {stats.atRisk}
          </div>
          <div className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-800 rounded font-bold shrink-0">
            ● Blocked: {stats.blocked}
          </div>
          <div className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded font-bold shrink-0">
            ● Pending: {pendingCount}
          </div>
        </div>

        {/* 1. Geospatial Map Canvas */}
        <div className="bg-white rounded-md border border-slate-200 shadow-2xs overflow-hidden h-[380px] sm:h-[520px] relative">
          {dataLoading && (
            <div className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-700 shadow flex items-center space-x-1.5">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-700" />
              <span>Syncing...</span>
            </div>
          )}
          {waypointMode && (
            <div className="absolute top-2 left-2 z-10 bg-cyan-900 text-cyan-100 px-2.5 py-1 rounded shadow text-xs font-mono border border-cyan-700 animate-pulse">
              Tap map: <strong>{waypointMode.toUpperCase()}</strong>
            </div>
          )}

          {/* In-Transit Impending Hazard Warning Banner */}
          {impendingHazard && isNavigating && (
            <div className="absolute top-2 inset-x-2 sm:inset-x-14 z-20 bg-rose-950/95 text-rose-100 border border-rose-600 p-3 rounded shadow-2xl backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-bounce">
              <div className="flex items-start space-x-2">
                <span className="text-lg leading-none">🚨</span>
                <div>
                  <span className="font-bold text-xs uppercase tracking-wide text-rose-300 block">
                    Hazard Ahead ({impendingHazard.distanceKm} km):{" "}
                    {impendingHazard.hazardType}
                  </span>
                  <p className="text-[10px] text-rose-200 line-clamp-1">
                    {impendingHazard.description}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDynamicReroute}
                disabled={isRerouting}
                className="w-full sm:w-auto px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded transition shadow cursor-pointer text-center"
              >
                {isRerouting ? "Computing Detour..." : "⚡ Reroute Now"}
              </button>
            </div>
          )}

          {/* GPS Telemetry Pill */}
          {isNavigating && !impendingHazard && (
            <div className="absolute top-2 left-2 z-10 bg-slate-950/90 text-cyan-400 px-2.5 py-1 rounded border border-cyan-700/60 shadow text-[11px] font-mono flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              <span>
                {isSimulating
                  ? `SIMULATING (${selectedVehicle.toUpperCase()})`
                  : `LIVE GPS (${selectedVehicle.toUpperCase()})`}
              </span>
              {gpsAccuracy && (
                <span className="text-[9px] text-slate-400 pl-1 border-l border-slate-700">
                  ±{gpsAccuracy}m
                </span>
              )}
            </div>
          )}

          <GisMap
            mapKey={mapKey}
            roadSegments={roadSegments}
            districts={districts}
            incidents={verifiedIncidents}
            primaryRoute={primaryRoute}
            alternativeRoute={alternativeRoute}
            selectedRouteKey={selectedRouteKey}
            onSelectRoute={(key) => setSelectedRouteKey(key)}
            routeWaypoints={activeWaypoints}
            waypointMode={waypointMode}
            livePosition={livePosition}
            isNavigating={isNavigating}
            inspectedLocation={inspectedLocation}
            onWaypointSet={handleWaypointSet}
            onWaypointDrag={handleWaypointDrag}
            onMapInspect={handleMapInspect}
          />
        </div>

        {/* 2. Weather Telemetry Deck */}
        <div className="bg-white rounded-md border border-slate-200 shadow-2xs p-3 sm:p-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-1.5">
              <span>🌦️</span>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Atmospheric Telemetry
                </h3>
                <p className="text-[10px] text-slate-500 truncate max-w-xs sm:max-w-none">
                  {inspectedLocation
                    ? `${inspectedLocation.name} (${inspectedLocation.state})`
                    : "Tap any map coordinate to stream weather telemetry."}
                </p>
              </div>
            </div>
            {weatherLoading && (
              <span className="text-[11px] text-blue-700 font-medium">
                Streaming sensors...
              </span>
            )}
          </div>

          {weatherTelemetry ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono">
              {/* 1. Temperature & Feels Like */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-slate-400 text-[9px] block font-sans uppercase font-bold">
                    Temperature
                  </span>
                  <strong className="text-slate-900 text-sm font-black">
                    {weatherTelemetry.temperature_2m}°C
                  </strong>
                </div>
                <span className="text-[10px] text-slate-500 font-sans mt-1">
                  Feels:{" "}
                  <strong className="text-slate-700">
                    {weatherTelemetry.apparent_temperature ??
                      weatherTelemetry.temperature_2m}
                    °C
                  </strong>
                </span>
              </div>

              {/* 2. Precipitation & 24h Accumulation */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-slate-400 text-[9px] block font-sans uppercase font-bold">
                    Rainfall
                  </span>
                  <strong className="text-blue-700 text-sm font-black">
                    {weatherTelemetry.precipitation} mm/h
                  </strong>
                </div>
                <span className="text-[10px] text-blue-900 font-sans mt-1">
                  24h Total:{" "}
                  <strong className="text-blue-700">
                    {weatherTelemetry.precip_24h ?? 0} mm
                  </strong>
                </span>
              </div>

              {/* 3. Snowfall & Season Status */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-slate-400 text-[9px] block font-sans uppercase font-bold">
                    Snowfall
                  </span>
                  <strong className="text-slate-800 text-sm font-black">
                    {weatherTelemetry.snowfall} cm
                  </strong>
                </div>
                <span className="text-[10px] text-slate-500 font-sans mt-1 truncate">
                  {weatherTelemetry.snowfall > 0
                    ? "⚠️ Active Flurries"
                    : weatherTelemetry.temperature_2m > 5
                      ? "Monsoon / Warm"
                      : "Clear Sector"}
                </span>
              </div>

              {/* 4. Wind Velocity & Gusts */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-slate-400 text-[9px] block font-sans uppercase font-bold">
                    Wind
                  </span>
                  <strong className="text-slate-800 text-sm font-black">
                    {weatherTelemetry.wind_speed_10m} km/h
                  </strong>
                </div>
                <span className="text-[10px] text-amber-800 font-sans mt-1">
                  Gusts:{" "}
                  <strong className="text-amber-900">
                    {weatherTelemetry.wind_gusts_10m ??
                      weatherTelemetry.wind_speed_10m}{" "}
                    km/h
                  </strong>
                </span>
              </div>

              {/* 5. Humidity & Cloud Cover */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-slate-400 text-[9px] block font-sans uppercase font-bold">
                    Humidity
                  </span>
                  <strong className="text-slate-800 text-sm font-black">
                    {weatherTelemetry.relative_humidity_2m}%
                  </strong>
                </div>
                <span className="text-[10px] text-slate-600 font-sans mt-1 truncate">
                  Sky:{" "}
                  <strong className="text-slate-800">
                    {weatherTelemetry.cloud_cover > 80
                      ? `Overcast (${weatherTelemetry.cloud_cover}%)`
                      : weatherTelemetry.cloud_cover > 40
                        ? `Partly Cloudy (${weatherTelemetry.cloud_cover}%)`
                        : `Clear (${weatherTelemetry.cloud_cover}%)`}
                  </strong>
                </span>
              </div>

              {/* 6. Pressure & Visibility */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-slate-400 text-[9px] block font-sans uppercase font-bold">
                    Pressure
                  </span>
                  <strong className="text-slate-800 text-sm font-black">
                    {Math.round(weatherTelemetry.surface_pressure)} hPa
                  </strong>
                </div>
                <span className="text-[10px] text-slate-600 font-sans mt-1 truncate">
                  Visibility:{" "}
                  <strong className="text-emerald-700">
                    {weatherTelemetry.visibility
                      ? `${(weatherTelemetry.visibility / 1000).toFixed(1)} km`
                      : "10.0+ km"}
                  </strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 py-2 text-center italic">
              Tap any district inside the 8 Northeastern states to stream live
              telemetry.
            </div>
          )}
        </div>

        {/* 3. Logistics Operations Desk */}
        <div className="bg-white rounded-md border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
              Logistics & Incident Desk
            </h2>

            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("routing")}
                className={`py-1.5 px-3 text-xs font-bold rounded transition cursor-pointer text-center min-h-[36px] ${
                  activeTab === "routing"
                    ? "bg-white text-cyan-950 shadow-xs border border-slate-200"
                    : "text-slate-600"
                }`}
              >
                🧭 Route Planner
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("advisory")}
                className={`py-1.5 px-3 text-xs font-bold rounded transition cursor-pointer text-center min-h-[36px] ${
                  activeTab === "advisory"
                    ? "bg-white text-blue-950 shadow-xs border border-slate-200"
                    : "text-slate-600"
                }`}
              >
                📢 Report Hazard
              </button>
            </div>
          </div>

          {activeTab === "routing" ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="space-y-3.5">
                {routingError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-2 rounded">
                    {routingError}
                  </div>
                )}

                {/* Vehicle Mode Selector */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block">
                    Mode of Transit:
                  </label>
                  <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 rounded border border-slate-200">
                    {VEHICLE_MODES.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleVehicleChange(v.id)}
                        className={`flex flex-col items-center justify-center py-2 px-1 rounded transition cursor-pointer min-h-[44px] ${
                          selectedVehicle === v.id
                            ? "bg-cyan-700 text-white shadow-xs"
                            : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200/60"
                        }`}
                      >
                        <span className="text-base leading-none">{v.icon}</span>
                        <span className="text-[10px] font-bold mt-0.5">
                          {v.label}
                        </span>
                        <span
                          className={`text-[8px] font-mono leading-none ${selectedVehicle === v.id ? "text-cyan-200" : "text-slate-400"}`}
                        >
                          {v.speed}k
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Origin Selector */}
                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-700 block">
                    Origin (Point A)
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded p-2 text-xs bg-white text-slate-800 focus:outline-cyan-700 min-h-[40px]"
                    value={customOrigin ? "CUSTOM" : selectedOriginDistId}
                    onChange={(e) => {
                      if (e.target.value !== "CUSTOM") {
                        setCustomOrigin(null);
                        setSelectedOriginDistId(e.target.value);
                      }
                    }}
                  >
                    {customOrigin && (
                      <option value="CUSTOM">{customOrigin.name}</option>
                    )}
                    {districts.map((d) => (
                      <option key={`origin-${d.id}`} value={d.id}>
                        {d.name} ({d.state})
                      </option>
                    ))}
                  </select>
                  <div className="flex justify-between items-center pt-0.5">
                    <button
                      onClick={() => setWaypointMode("origin")}
                      className="text-[11px] text-cyan-800 font-semibold hover:underline cursor-pointer py-1"
                    >
                      🎯 Tap Pin on Map
                    </button>
                    {customOrigin && (
                      <button
                        onClick={() => setCustomOrigin(null)}
                        className="text-[11px] text-slate-500 hover:underline cursor-pointer py-1"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Destination Selector */}
                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-700 block">
                    Destination (Point B)
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded p-2 text-xs bg-white text-slate-800 focus:outline-cyan-700 min-h-[40px]"
                    value={customDest ? "CUSTOM" : selectedDestDistId}
                    onChange={(e) => {
                      if (e.target.value !== "CUSTOM") {
                        setCustomDest(null);
                        setSelectedDestDistId(e.target.value);
                      }
                    }}
                  >
                    {customDest && (
                      <option value="CUSTOM">{customDest.name}</option>
                    )}
                    {districts
                      .filter((d) =>
                        customOrigin ? true : d.id !== selectedOriginDistId,
                      )
                      .map((d) => (
                        <option key={`dest-${d.id}`} value={d.id}>
                          {d.name} ({d.state})
                        </option>
                      ))}
                  </select>
                  <div className="flex justify-between items-center pt-0.5">
                    <button
                      onClick={() => setWaypointMode("destination")}
                      className="text-[11px] text-cyan-800 font-semibold hover:underline cursor-pointer py-1"
                    >
                      🏁 Tap Pin on Map
                    </button>
                    {customDest && (
                      <button
                        onClick={() => setCustomDest(null)}
                        className="text-[11px] text-slate-500 hover:underline cursor-pointer py-1"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {isSameLocation && (
                  <p className="text-xs text-amber-700 font-semibold">
                    ⚠️ Origin and Destination cannot be the same.
                  </p>
                )}

                <button
                  disabled={routingLoading || isSameLocation}
                  onClick={() => handleCalculateRoute()}
                  className="w-full py-2.5 bg-cyan-700 hover:bg-cyan-800 text-white font-bold rounded text-xs transition shadow cursor-pointer disabled:opacity-40 flex items-center justify-center space-x-2 min-h-[44px]"
                >
                  <span>
                    {VEHICLE_MODES.find((v) => v.id === selectedVehicle)?.icon}
                  </span>
                  <span>
                    {routingLoading
                      ? "Computing..."
                      : `Compute Route Trajectory`}
                  </span>
                </button>
                {(primaryRoute || customOrigin || customDest) && (
                  <button
                    type="button"
                    onClick={handleClearTrajectory}
                    className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded text-xs transition cursor-pointer min-h-[44px]"
                    title="Reset routing inputs and clear map"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Navigation Telemetry & Routes */}
              <div className="lg:col-span-2">
                {primaryRoute && currentlyActiveRoute ? (
                  <div className="bg-slate-900 text-slate-100 p-3 sm:p-4 rounded space-y-3 font-mono text-xs border border-slate-800 shadow-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Corridor 1 */}
                      <button
                        type="button"
                        onClick={() => setSelectedRouteKey("primary")}
                        className={`p-2.5 rounded text-left transition border cursor-pointer min-h-[44px] ${
                          selectedRouteKey === "primary"
                            ? "bg-cyan-950/80 border-cyan-500 text-cyan-200 ring-1 ring-cyan-500/50"
                            : "bg-slate-950/60 border-slate-800 text-slate-400"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold flex items-center space-x-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${selectedRouteKey === "primary" ? "bg-cyan-400" : "bg-slate-600"}`}
                            />
                            <span>Primary Path</span>
                          </span>
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded border bg-emerald-950 text-emerald-400 border-emerald-800">
                            {primaryRoute.blockedCount === 0
                              ? "Clear"
                              : `${primaryRoute.blockedCount} Hazard`}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-300 font-sans">
                          <span>
                            <strong>{primaryRoute.totalDistanceKm}</strong> km
                          </span>
                          <span className="text-emerald-400 font-bold">
                            {primaryRoute.estimatedDurationFormatted}
                          </span>
                        </div>
                      </button>

                      {/* Corridor 2 */}
                      {alternativeRoute && (
                        <button
                          type="button"
                          onClick={() => setSelectedRouteKey("alternative")}
                          className={`p-2.5 rounded text-left transition border cursor-pointer min-h-[44px] ${
                            selectedRouteKey === "alternative"
                              ? "bg-cyan-950/80 border-cyan-500 text-cyan-200 ring-1 ring-cyan-500/50"
                              : "bg-slate-950/60 border-slate-800 text-slate-400"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold flex items-center space-x-1.5">
                              <span
                                className={`h-2 w-2 rounded-full ${selectedRouteKey === "alternative" ? "bg-cyan-400" : "bg-slate-600"}`}
                              />
                              <span>Alternative Detour</span>
                            </span>
                            <span className="text-[9px] font-bold px-1 py-0.2 rounded border bg-slate-900 text-cyan-300 border-cyan-800">
                              {alternativeRoute.blockedCount === 0
                                ? "Clear"
                                : `${alternativeRoute.blockedCount} Hazard`}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-300 font-sans">
                            <span>
                              <strong>
                                {alternativeRoute.totalDistanceKm}
                              </strong>{" "}
                              km
                            </span>
                            <span className="text-emerald-400 font-bold">
                              {alternativeRoute.estimatedDurationFormatted}
                            </span>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800">
                      <div className="flex items-center space-x-3 text-xs">
                        <div>
                          <span className="text-slate-500 text-[9px] block uppercase">
                            Distance
                          </span>
                          <span className="font-bold text-white">
                            {currentlyActiveRoute.totalDistanceKm} km
                          </span>
                        </div>
                        <div className="border-l border-slate-800 pl-3">
                          <span className="text-slate-500 text-[9px] block uppercase">
                            ETA (~{currentlyActiveRoute.appliedSpeedKmh || 38}
                            k/h)
                          </span>
                          <span className="font-bold text-emerald-400">
                            {currentlyActiveRoute.estimatedDurationFormatted}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 w-full sm:w-auto">
                        <button
                          onClick={() => {
                            setIsManifestOpen(true);
                          }}
                          className="flex-1 sm:flex-initial px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded text-xs transition flex items-center justify-center space-x-1 cursor-pointer font-sans min-h-[40px]"
                        >
                          <span>📄</span>
                          <span>Manifest</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleClearTrajectory}
                          className="flex-1 sm:flex-initial px-3 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 font-bold rounded text-xs transition flex items-center justify-center space-x-1 cursor-pointer font-sans min-h-[40px]"
                          title="Clear computed trajectory and reset map"
                        >
                          <span>✕</span>
                          <span>Clear Route</span>
                        </button>

                        {!isNavigating ? (
                          <>
                            <button
                              onClick={handleStartLiveJourney}
                              className="flex-1 sm:flex-initial px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition flex items-center justify-center space-x-1 cursor-pointer font-sans min-h-[40px]"
                            >
                              <span>🚗</span>
                              <span>GPS</span>
                            </button>
                            <button
                              onClick={handleStartSimulation}
                              className="flex-1 sm:flex-initial px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded text-xs transition flex items-center justify-center space-x-1 cursor-pointer font-sans min-h-[40px]"
                            >
                              <span>▶️</span>
                              <span>Sim</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={handleStopJourney}
                            className="w-full sm:w-auto px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded text-xs transition flex items-center justify-center space-x-1 cursor-pointer font-sans animate-pulse min-h-[40px]"
                          >
                            <span>🛑</span>
                            <span>End Journey</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Turn-By-Turn Directions */}
                    {currentlyActiveRoute.steps &&
                      currentlyActiveRoute.steps.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-800">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                            Turn-By-Turn Checkpoints (
                            {currentlyActiveRoute.steps.length}):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                            {currentlyActiveRoute.steps.map((st) => (
                              <div
                                key={st.id}
                                className="bg-slate-950/90 border border-slate-800 p-1.5 rounded flex justify-between items-start text-[11px]"
                              >
                                <div className="flex items-start space-x-1.5 pr-1">
                                  <span className="text-cyan-400 font-bold font-mono">
                                    {st.id}.
                                  </span>
                                  <span className="text-slate-200 font-sans">
                                    {st.instruction}
                                  </span>
                                </div>
                                <span className="text-slate-400 font-mono text-[10px] shrink-0">
                                  {st.distance}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded p-6 text-center text-slate-400 text-xs">
                    <span className="text-2xl mb-1">🧭</span>
                    <span>
                      Select an Origin, Destination, and Vehicle above and tap{" "}
                      <strong>Compute Route</strong>.
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Multi-Hazard & Photo Evidence Reporting Console */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                  Target Coordinate
                </span>
                {inspectedLocation ? (
                  <div className="p-3 rounded border border-slate-200 bg-slate-50 text-xs space-y-1">
                    <p className="font-bold text-slate-900 text-sm">
                      {inspectedLocation.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {inspectedLocation.state}
                    </p>
                    <p className="text-[10px] font-mono text-cyan-800 font-semibold pt-1 border-t border-slate-200">
                      📍 {inspectedLocation.lat}° N, {inspectedLocation.lng}° E
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 p-4 border border-dashed border-slate-200 rounded text-center">
                    Tap any point on the map to pin the incident coordinates.
                  </div>
                )}
              </div>

              <div className="lg:col-span-2 space-y-3">
                <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                  File Highway Obstruction Advisory
                </span>

                {reportSubmittedStatus ? (
                  <div className="bg-green-50 border border-green-200 p-3.5 rounded text-xs text-green-800 space-y-2">
                    <p className="font-bold">✓ Advisory Logged Successfully</p>
                    <p className="text-[11px]">{reportSubmittedStatus}</p>
                    <button
                      onClick={() => setReportSubmittedStatus(null)}
                      className="px-3 py-1 bg-green-800 text-white rounded text-xs font-bold cursor-pointer hover:bg-green-700"
                    >
                      Report Another Incident
                    </button>
                  </div>
                ) : !inspectedOutsideWarning && inspectedLocation ? (
                  <form
                    onSubmit={handleCitizenSubmit}
                    className="space-y-3 text-xs"
                  >
                    {/* Standardized 7-Hazard Category Grid */}
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Select Hazard Category:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {HAZARD_CATALOG.map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => setReportHazardType(h.id)}
                            className={`p-2 rounded border text-left transition cursor-pointer min-h-[46px] flex flex-col justify-center ${
                              reportHazardType === h.id
                                ? "bg-blue-900 text-white border-blue-900 shadow-xs"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <span className="text-sm">{h.icon}</span>
                            <span className="text-[10px] font-bold mt-0.5 leading-tight">
                              {h.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Description Notes */}
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Landmark / Observation Details (Optional):
                      </label>
                      {/* Isolated form container to stop parent re-renders */}
                      <textarea
                        id="hazard-report-description"
                        name="description"
                        rows={3}
                        defaultValue=""
                        placeholder="Describe corridor conditions, visible blockages, or flash flood marks..."
                        className="w-full px-3 py-2 border border-slate-300 rounded text-slate-800 text-xs focus:ring-1 focus:ring-cyan-700 outline-none"
                      />
                    </div>

                    {/* Photographic Evidence Attachment */}
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Attach Photographic Evidence (Recommended for Fast
                        Verification):
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          ref={fileInputRef}
                          onChange={handlePhotoSelect}
                          className="hidden"
                          id="hazard-photo-upload"
                        />
                        <label
                          htmlFor="hazard-photo-upload"
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded font-semibold text-xs cursor-pointer flex items-center space-x-1.5 transition"
                        >
                          <span>📸</span>
                          <span>
                            {photoPreview
                              ? "Change Photo"
                              : "Upload / Snap Photo"}
                          </span>
                        </label>

                        {photoPreview && (
                          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 p-1.5 rounded">
                            <img
                              src={photoPreview}
                              alt="Hazard evidence thumbnail"
                              className="w-10 h-10 object-cover rounded border border-slate-300"
                            />
                            <button
                              type="button"
                              onClick={handleClearPhoto}
                              className="text-rose-600 hover:text-rose-800 font-bold text-xs px-1 cursor-pointer"
                              title="Remove Photo"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={submittingReport}
                      className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded text-xs transition shadow cursor-pointer disabled:opacity-50 min-h-[44px] flex items-center justify-center space-x-2"
                    >
                      <span>📢</span>
                      <span>
                        {submittingReport
                          ? "Transmitting Advisory & Evidence..."
                          : "Submit Highway Advisory"}
                      </span>
                    </button>
                  </form>
                ) : (
                  <div className="text-xs text-slate-400 p-4 border border-dashed border-slate-200 rounded text-center">
                    Tap a highway location inside the 8 Northeastern states on
                    the map to file an advisory.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Official Logistics Dispatch Manifest Modal */}
      <TransitManifestModal
        isOpen={isManifestOpen}
        onClose={() => {
          setIsManifestOpen(false);
        }}
        routeData={currentlyActiveRoute}
        originName={
          activeWaypoints.origin?.name
        }
        destinationName={
          activeWaypoints.destination?.name
        }
        vehicleType={selectedVehicle}
        weatherTelemetry={
         weatherTelemetry
        }
      />
      
      {/* GIGW 3.0 Compliance & NIC Hosting Footer */}
      <GovFooter />
    </main>
  );
}
