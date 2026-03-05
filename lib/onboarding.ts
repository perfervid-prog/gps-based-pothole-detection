import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "pothole_alert_onboarding_complete";
const VEHICLE_KEY = "pothole_alert_vehicle_type";

export type VehicleType = "car" | "motorcycle" | "bicycle" | "bus" | "truck" | "walking";

export async function isOnboardingComplete(): Promise<boolean> {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === "true";
}

export async function setOnboardingComplete(): Promise<void> {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}

export async function getVehicleType(): Promise<VehicleType | null> {
    const value = await AsyncStorage.getItem(VEHICLE_KEY);
    return value as VehicleType | null;
}

export async function setVehicleType(type: VehicleType): Promise<void> {
    await AsyncStorage.setItem(VEHICLE_KEY, type);
}

export async function resetOnboarding(): Promise<void> {
    await AsyncStorage.multiRemove([ONBOARDING_KEY, VEHICLE_KEY]);
}
