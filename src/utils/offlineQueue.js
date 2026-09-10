import { openDB } from 'idb';

const DB_NAME = 'setu_ner_offline_db';
const STORE_NAME = 'incident_queue';

// Initialize client-side IndexedDB store
export async function getOfflineDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'local_id', autoIncrement: true });
      }
    },
  });
}

// Queue report locally when network is down
export async function queueIncidentLocally(incidentData) {
  const db = await getOfflineDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const localRecord = {
    ...incidentData,
    // Guarantee coordinates exist regardless of key name used
    latitude: Number(incidentData.latitude ?? incidentData.lat),
    longitude: Number(incidentData.longitude ?? incidentData.lng),
    queued_at: new Date().toISOString(),
  };

  const id = await store.add(localRecord);
  await tx.done;
  return id;
}

// Get all unsynced reports from IndexedDB
export async function getQueuedIncidents() {
  const db = await getOfflineDB();
  return db.getAll(STORE_NAME);
}

// Clear the entire queue (useful for flushing bad/stale test payloads)
export async function clearOfflineQueue() {
  const db = await getOfflineDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).clear();
  await tx.done;
}

// Push an incident through the official API endpoint
export async function pushIncidentToServer(incident) {
  const resolvedLat = Number(incident.latitude ?? incident.lat);
  const resolvedLng = Number(incident.longitude ?? incident.lng);

  if (isNaN(resolvedLat) || isNaN(resolvedLng)) {
    throw new Error('Invalid coordinates saved in queued report');
  }

  const res = await fetch('/api/incidents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hazardType: incident.hazardType || incident.category || 'landslide',
      severity: incident.severity || 'critical_blocked',
      description: incident.description || 'Offline queued report',
      latitude: resolvedLat,
      longitude: resolvedLng,
      radiusMeters: incident.radiusMeters || 2500,
      userRole: incident.userRole || 'citizen',
    }),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Server rejected incident sync');
  }
  return json;
}

// Synchronize all locally queued reports once back online
export async function syncOfflineQueue() {
  const db = await getOfflineDB();
  const queued = await db.getAll(STORE_NAME);

  if (!queued || queued.length === 0) {
    return { syncedCount: 0, remaining: 0, errors: [] };
  }

  let successCount = 0;
  const errors = [];

  for (const item of queued) {
    try {
      await pushIncidentToServer(item);
      const tx = db.transaction(STORE_NAME, 'readwrite');
      await tx.objectStore(STORE_NAME).delete(item.local_id);
      await tx.done;
      successCount++;
    } catch (err) {
      console.error('Failed to sync item ID:', item.local_id, err);
      errors.push(`Item #${item.local_id}: ${err.message}`);
    }
  }

  return {
    syncedCount: successCount,
    remaining: queued.length - successCount,
    errors,
  };
}