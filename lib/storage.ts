import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

// In a real app, this should come from process.env.EXPO_PUBLIC_API_URL
const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';

export interface Pothole {
  id: string;
  latitude: string;
  longitude: string;
  magnitude: string;
  reportedAt: string;
}

export async function getPotholes(): Promise<Pothole[]> {
  try {
    const response = await fetch(`${API_URL}/potholes`);
    if (!response.ok) throw new Error("Failed to fetch potholes");
    return await response.json();
  } catch (error) {
    console.error("getPotholes error:", error);
    return [];
  }
}

export async function savePothole(pothole: { latitude: number; longitude: number; magnitude?: number }): Promise<Pothole> {
  try {
    const response = await fetch(`${API_URL}/potholes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: pothole.latitude.toString(),
        longitude: pothole.longitude.toString(),
        magnitude: (pothole.magnitude || 0).toString(),
      }),
    });
    if (!response.ok) throw new Error("Failed to save pothole");
    return await response.json();
  } catch (error) {
    console.error("savePothole error:", error);
    // Fallback Mock for UI testing if server is down
    return {
      id: Crypto.randomUUID(),
      latitude: pothole.latitude.toString(),
      longitude: pothole.longitude.toString(),
      magnitude: (pothole.magnitude || 0).toString(),
      reportedAt: new Date().toISOString(),
    };
  }
}

export async function updatePothole(id: string, updates: Partial<Pick<Pothole, "latitude" | "longitude">>): Promise<Pothole | null> {
  // Note: Backend doesn't have UPDATE yet, skipping for now or implementing local fallback
  return null;
}

export async function deletePothole(id: string): Promise<boolean> {
  // Note: Backend doesn't have DELETE yet
  return false;
}

export async function clearAllPotholes(): Promise<void> {
  // Note: Backend doesn't have CLEAR yet
}
