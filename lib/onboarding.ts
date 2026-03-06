import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "pothole_alert_onboarding_complete";
const VEHICLE_KEY = "pothole_alert_vehicle_type";
const ALERTS_ENABLED_KEY = "pothole_alert_proximity_enabled";
const ALERT_SOUND_KEY = "pothole_alert_sound_enabled";
const ALERT_FLASH_KEY = "pothole_alert_flash_enabled";

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
    await AsyncStorage.multiRemove([ONBOARDING_KEY, VEHICLE_KEY, ALERTS_ENABLED_KEY, ALERT_SOUND_KEY, ALERT_FLASH_KEY]);
}

export async function getAlertSettings() {
    const enabled = await AsyncStorage.getItem(ALERTS_ENABLED_KEY);
    const sound = await AsyncStorage.getItem(ALERT_SOUND_KEY);
    const flash = await AsyncStorage.getItem(ALERT_FLASH_KEY);

    return {
        enabled: enabled === null ? true : enabled === "true",
        sound: sound === null ? true : sound === "true",
        flash: flash === null ? true : flash === "true",
    };
}

export async function setAlertSetting(key: "enabled" | "sound" | "flash", value: boolean) {
    const storageKey = key === "enabled" ? ALERTS_ENABLED_KEY : key === "sound" ? ALERT_SOUND_KEY : ALERT_FLASH_KEY;
    await AsyncStorage.setItem(storageKey, value.toString());
}
