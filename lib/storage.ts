import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const PROJECT_ID = "pothole-alert-f0058";
export const FIREBASE_REST_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/potholes`;
const CACHE_KEY = "@potholes_cache";

export interface Pothole {
  id: string;
  latitude: string;
  longitude: string;
  magnitude: string;
  reportedAt: string;
  isOffline?: boolean; // Flag for locally created/unsynced data
}

// Internal helper to get cached data
async function getCachedPotholes(): Promise<Pothole[]> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

// Internal helper to set cached data
async function setCachedPotholes(potholes: Pothole[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(potholes));
  } catch (error) {
    console.error("Cache storage error:", error);
  }
}

export async function getPotholes(): Promise<Pothole[]> {
  // 1. Return cached data immediately for speed/offline
  const localData = await getCachedPotholes();

  try {
    const response = await fetch(FIREBASE_REST_URL);
    if (!response.ok) throw new Error("Network error");

    const data = await response.json();
    if (!data.documents) {
      await setCachedPotholes([]);
      return [];
    }

    const remoteData: Pothole[] = data.documents
      .filter((doc: any) => !doc.name.endsWith("esp32_status")) // Filter out status doc
      .map((doc: any) => {
        const fields = doc.fields;
        const val = (f: any) => f?.doubleValue?.toString() || f?.stringValue || "0";
        return {
          id: doc.name.split("/").pop(),
          latitude: val(fields.latitude),
          longitude: val(fields.longitude),
          magnitude: val(fields.magnitude),
          reportedAt: fields.reportedAt?.stringValue || new Date().toISOString(),
        };
      });

    // 2. Merge logic: keep local "isOffline" data that hasn't synced yet
    const offlineItems = localData.filter(p => p.isOffline);
    const finalData = [...remoteData, ...offlineItems];

    await setCachedPotholes(finalData);
    return finalData;
  } catch (error) {
    console.log("Fetch failed, serving purely from cache");
    return localData;
  }
}

export async function savePothole(pothole: { latitude: number; longitude: number; magnitude?: number }): Promise<Pothole> {
  const newId = Crypto.randomUUID();
  const tempPothole: Pothole = {
    id: newId,
    latitude: pothole.latitude.toString(),
    longitude: pothole.longitude.toString(),
    magnitude: (pothole.magnitude || 0).toString(),
    reportedAt: new Date().toISOString(),
    isOffline: true
  };

  // 1. Aggressively update local cache
  const current = await getCachedPotholes();
  await setCachedPotholes([...current, tempPothole]);

  try {
    const response = await fetch(FIREBASE_REST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          latitude: { stringValue: pothole.latitude.toString() },
          longitude: { stringValue: pothole.longitude.toString() },
          magnitude: { stringValue: (pothole.magnitude || 0).toString() },
          reportedAt: { stringValue: tempPothole.reportedAt },
        },
      }),
    });

    if (response.ok) {
      const doc = await response.json();
      const syncedPothole: Pothole = {
        id: doc.name.split("/").pop(),
        latitude: doc.fields.latitude.stringValue,
        longitude: doc.fields.longitude.stringValue,
        magnitude: doc.fields.magnitude.stringValue,
        reportedAt: doc.fields.reportedAt.stringValue,
      };

      // Replace temp with synced version
      const updated = (await getCachedPotholes()).map(p => p.id === newId ? syncedPothole : p);
      await setCachedPotholes(updated);
      return syncedPothole;
    }
  } catch (error) {
    console.log("Save failed, kept as offline item");
  }

  return tempPothole;
}

export async function updatePothole(id: string, updates: Partial<Pick<Pothole, "latitude" | "longitude">>): Promise<Pothole | null> {
  // 1. Update local cache immediately
  const current = await getCachedPotholes();
  const target = current.find(p => p.id === id);
  if (!target) return null;

  const localUpdated: Pothole = {
    ...target,
    latitude: updates.latitude?.toString() || target.latitude,
    longitude: updates.longitude?.toString() || target.longitude,
    isOffline: target.isOffline // Keep offline status if it already had it
  };

  await setCachedPotholes(current.map(p => p.id === id ? localUpdated : p));

  try {
    const url = `${FIREBASE_REST_URL}/${id}?updateMask.fieldPaths=latitude&updateMask.fieldPaths=longitude`;
    const fields: any = {};
    if (updates.latitude !== undefined) fields.latitude = { stringValue: updates.latitude.toString() };
    if (updates.longitude !== undefined) fields.longitude = { stringValue: updates.longitude.toString() };

    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });

    if (response.ok) {
      const doc = await response.json();
      const synced: Pothole = {
        id: doc.name.split("/").pop(),
        latitude: doc.fields.latitude.stringValue,
        longitude: doc.fields.longitude.stringValue,
        magnitude: doc.fields.magnitude.stringValue,
        reportedAt: doc.fields.reportedAt.stringValue,
      };
      return synced;
    }
  } catch (error) {
    console.log("Update failed locally, but cached on device");
  }
  return localUpdated;
}

export async function deletePothole(id: string): Promise<boolean> {
  // 1. Remove from local cache immediately
  const current = await getCachedPotholes();
  await setCachedPotholes(current.filter(p => p.id !== id));

  try {
    const url = `${FIREBASE_REST_URL}/${id}`;
    const response = await fetch(url, { method: "DELETE" });
    return response.ok;
  } catch (error) {
    console.log("Delete failed server-side, but removed from device cache");
    return true; // Return true because it's effectively "gone" for the user
  }
}

export interface SensorStatus {
  lastSeen: string;
  status: string;
  firmware: string;
}

export async function getSensorStatus(): Promise<SensorStatus | null> {
  // Fetch latest heartbeat from the potholes collection
  const url = `${FIREBASE_REST_URL}?orderBy=reportedAt desc&limit=1`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    
    // Find the latest one marked as "heartbeat"
    const latestDoc = (data.documents || []).find((doc: any) => doc.fields?.type?.stringValue === "heartbeat");

    if (!latestDoc) return null;
    
    const latest = latestDoc.fields;
    return {
      lastSeen: latest.lastSeen?.stringValue || latest.reportedAt?.stringValue || "",
      status: latest.status?.stringValue || "online",
      firmware: "1.2.0",
    };
  } catch (error) {
    console.log("Failed to fetch heartbeat status");
    return null;
  }
}

export async function clearAllPotholes(potholes: Pothole[]): Promise<void> {
  // 1. Remove local cache
  await AsyncStorage.removeItem(CACHE_KEY);

  // 2. Remove from Firebase server
  const deletePromises = potholes.map(p => {
    const url = `${FIREBASE_REST_URL}/${p.id}`;
    return fetch(url, { method: "DELETE" }).catch(e => console.log("Delete error for", p.id, e));
  });

  await Promise.all(deletePromises);
}
