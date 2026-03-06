import React, { useState, useRef, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  StyleSheet,
  Platform,
  Alert,
  Text,
  ActivityIndicator,
  Pressable,
  BackHandler,
  Modal,
} from "react-native";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import Colors from "@/constants/colors";
import AppHeader from "@/components/AppHeader";
import DrawerMenu from "@/components/DrawerMenu";
import FloatingActionButton from "@/components/FloatingActionButton";
import UpdateModal from "@/components/UpdateModal";
import SettingsView from "@/components/SettingsView";
import { MapViewWrapper } from "@/components/MapViewWrapper";
import OnboardingGuide from "@/components/OnboardingGuide";
import VehicleSelect from "@/components/VehicleSelect";
import RideStart from "@/components/RideStart";
import RouteSelection from "@/components/RouteSelection";
import AdminLoginModal from "@/components/AdminLoginModal";
import { usePotholes } from "@/contexts/PotholeContext";
import {
  isOnboardingComplete,
  setOnboardingComplete,
  getVehicleType,
  setVehicleType,
  getAlertSettings,
  VehicleType,
} from "@/lib/onboarding";
import * as Speech from "expo-speech";

const FIREBASE_REST_URL = "https://firestore.googleapis.com/v1/projects/pothole-alert-f0058/databases/(default)/documents/potholes";

// Global Map Configuration (Google Maps style)
const MAP_CONFIG = {
  PITCH: 65,
  ZOOM: 19.2,
  HOME_PITCH: 0,
  HOME_LAT_DELTA: 0.005,
  LOOKAHEAD_DISTANCE: 25, // meters
  ANIMATION_DURATION: 1200,
  OVERVIEW_PADDING: { top: 100, right: 80, bottom: 250, left: 80 },
};

type Screen = "home" | "settings" | "update";
type OnboardingStep = "loading" | "guide" | "vehicle" | "ride_start" | "route_selection" | "done";

interface Coordinate {
  latitude: number;
  longitude: number;
}

function calculateBearing(start: Coordinate, end: Coordinate) {
  const startLat = (start.latitude * Math.PI) / 180;
  const startLng = (start.longitude * Math.PI) / 180;
  const endLat = (end.latitude * Math.PI) / 180;
  const endLng = (end.longitude * Math.PI) / 180;

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

function getDistance(c1: Coordinate, c2: Coordinate) {
  const R = 6371e3; // metres
  const φ1 = (c1.latitude * Math.PI) / 180;
  const φ2 = (c2.latitude * Math.PI) / 180;
  const Δφ = ((c2.latitude - c1.latitude) * Math.PI) / 180;
  const Δλ = ((c2.longitude - c1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function getPointAtDistance(start: Coordinate, distance: number, bearing: number): Coordinate {
  const R = 6371e3;
  const dr = distance / R;
  const φ1 = (start.latitude * Math.PI) / 180;
  const λ1 = (start.longitude * Math.PI) / 180;
  const brng = (bearing * Math.PI) / 180;

  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(dr) +
    Math.cos(φ1) * Math.sin(dr) * Math.cos(brng));
  const λ2 = λ1 + Math.atan2(Math.sin(brng) * Math.sin(dr) * Math.cos(φ1),
    Math.cos(dr) - Math.sin(φ1) * Math.sin(φ2));

  return {
    latitude: (φ2 * 180) / Math.PI,
    longitude: (λ2 * 180) / Math.PI,
  };
}

function isPointNearPath(point: Coordinate, path: Coordinate[], thresholdMeters: number): boolean {
  if (!path || path.length < 2) return false;

  // Basic optimization: Check if point is near any individual segment
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];

    // Check distance to segment (simplified as distance to mid-point or both ends for efficiency)
    const d1 = getDistance(point, p1);
    const d2 = getDistance(point, p2);

    if (d1 < thresholdMeters || d2 < thresholdMeters) return true;

    // More accurate segment distance could be added here if needed, 
    // but given path density from OSRM, point-to-point is usually sufficient.
  }
  return false;
}

export default function HomeScreen() {
  const {
    potholes,
    isLoading,
    refresh,
    addPothole,
    updatePothole,
    removePothole,
    selectedPothole,
    setSelectedPothole,
    isAdmin,
    loginAdmin,
    logoutAdmin,
  } = usePotholes();

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("loading");
  const [vehicleType, setVehicleTypeState] = useState<VehicleType | null>(null);
  const [alertSettings, setAlertSettings] = useState({ enabled: true, sound: true, flash: true });
  const [isAlerting, setIsAlerting] = useState(false);
  const lastAlertTime = React.useRef(0);
  const [activeRoute, setActiveRoute] = useState<Coordinate[] | null>(null);
  const [mapMode, setMapMode] = useState<"standard" | "satellite" | "hybrid">("standard");
  const [riskScore, setRiskScore] = useState<"Low" | "Medium" | "High">("Low");

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isProcessingRoute, setIsProcessingRoute] = useState(false);
  const [destinationName, setDestinationName] = useState<string>("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isAutoFollowing, setIsAutoFollowing] = useState(false);
  const [navigationState, setNavigationState] = useState<"none" | "overview" | "following">("none");
  const [adminLoginVisible, setAdminLoginVisible] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isPickingFromMap, setIsPickingFromMap] = useState(false);
  const [mapSelectionPoint, setMapSelectionPoint] = useState<Coordinate | null>(null);
  const [nearestPathIndex, setNearestPathIndex] = useState(0);
  const mapRef = useRef<any>(null);

  const loadAlertSettings = async () => {
    const settings = await getAlertSettings();
    setAlertSettings(settings);
  };

  const speakAlert = (text: string) => {
    if (alertSettings.enabled && alertSettings.sound) {
      Speech.speak(text, {
        language: 'en',
        rate: 1.0,
        pitch: 1.0,
      });
    }
  };

  // Check onboarding status on mount
  useEffect(() => {
    const init = async () => {
      const type = await getVehicleType();
      setVehicleTypeState(type);

      const complete = await isOnboardingComplete();
      if (!complete) {
        setOnboardingStep("guide");
      } else {
        setOnboardingStep("done");
        requestLocation(); // Request location only if onboarding is complete
      }

      await loadAlertSettings();

      const history = await AsyncStorage.getItem("search_history");
      if (history) setSearchHistory(JSON.parse(history));
    };
    init();
  }, []);

  const handleGuideComplete = () => {
    setOnboardingStep("vehicle");
    requestLocation();
  };

  const handleVehicleSelect = async (type: VehicleType) => {
    setVehicleTypeState(type);
    await setVehicleType(type);
    setOnboardingStep("ride_start");
  };

  const handleRideStart = () => {
    setOnboardingStep("route_selection");
  };

  const handleRouteSelect = async (source: string, destination: string, fullAddress?: string, manualCoords?: Coordinate) => {
    setIsProcessingRoute(true);
    setActiveRoute(null);
    setIsAutoFollowing(false);
    setNavigationState("none");
    setDestinationName(destination);
    console.log("Starting route search for:", destination);

    try {
      const start = userLocation || { latitude: 27.7172, longitude: 85.3240 };
      let endCoords: Coordinate | null = manualCoords || null;

      // Robust coordinate detection for recent searches/pasted coords
      const coordRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
      const match = destination.match(coordRegex);
      if (!endCoords && match) {
        endCoords = { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]) };
        console.log("Detected coordinates from string:", endCoords);
      }

      if (!endCoords) {
        // 1. Geocoding: Try to find coordinates for the destination
        const searchQueries = [
          fullAddress?.replace(", undefined", "") || destination,
          `${destination}, Kathmandu`,
          `${destination}, Nepal`
        ];

        for (const query of searchQueries) {
          if (!query) continue;
          console.log("Trying geocode query:", query);
          const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&lat=${start.latitude}&lon=${start.longitude}&addressdetails=1`;

          const geoResponse = await fetch(geoUrl, { headers: { 'User-Agent': 'PotholeAlertApp/1.0' } });
          const geoData = await geoResponse.json();

          if (geoData && geoData.length > 0) {
            endCoords = {
              latitude: parseFloat(geoData[0].lat),
              longitude: parseFloat(geoData[0].lon),
            };
            console.log("Geocode success for:", query);
            break;
          }
        }
      }

      if (!endCoords) {
        throw new Error("Could not find this location. Try being more specific.");
      }

      // 2. Routing: Get road-snapped path from OSRM
      console.log("Fetching route from OSRM...");
      const routeResponse = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${endCoords.longitude},${endCoords.latitude}?overview=full&geometries=geojson`,
        { headers: { 'User-Agent': 'PotholeAlertApp/1.0' } }
      );
      const routeData = await routeResponse.json();

      if (routeData.routes && routeData.routes.length > 0) {
        const path: Coordinate[] = routeData.routes[0].geometry.coordinates.map(
          (coord: [number, number]) => ({
            latitude: coord[1],
            longitude: coord[0],
          })
        );
        setActiveRoute(path);

        // Add to history
        const newHistory = [destination, ...searchHistory.filter(s => s !== destination)].slice(0, 5);
        setSearchHistory(newHistory);
        await AsyncStorage.setItem("search_history", JSON.stringify(newHistory));

        // Transition only on success
        setOnboardingStep("done");
        await setOnboardingComplete();
        setNavigationState("overview");
        calculateRiskScore(path);
      } else {
        throw new Error("No road route found between these points.");
      }
    } catch (error: any) {
      console.error("Routing error:", error);
      Alert.alert("Navigation Error", error.message || "Failed to find a route.");
    } finally {
      setIsLoadingLocation(false);
      setIsProcessingRoute(false);
    }
  };

  const calculateRiskScore = (path: Coordinate[], startIndex: number = 0) => {
    let potholeCount = 0;
    // Only check from current position to end
    const remainingPath = path.slice(startIndex);

    remainingPath.forEach(coord => {
      potholes.forEach(p => {
        const dist = getDistance(coord, {
          latitude: typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude,
          longitude: typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude
        });
        if (dist < 50) potholeCount++;
      });
    });

    if (potholeCount > 10) setRiskScore("High");
    else if (potholeCount > 3) setRiskScore("Medium");
    else setRiskScore("Low");
  };

  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
      setIsOffline(false);
    } catch (error) {
      console.log("Refresh failed, going into offline mode");
      setIsOffline(true);
    }
  }, [refresh]);

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  // Periodic Hazards Sync & Dynamic Risk Score
  useEffect(() => {
    if (onboardingStep === "done" && navigationState !== "none") {
      const interval = setInterval(() => {
        console.log("Auto-sync: Refreshing hazards...");
        handleRefresh();
      }, 30000); // 30 second sync
      return () => clearInterval(interval);
    }
  }, [onboardingStep, navigationState, handleRefresh]);

  useEffect(() => {
    if (activeRoute && potholes.length >= 0) {
      calculateRiskScore(activeRoute, nearestPathIndex);
    }
  }, [potholes, nearestPathIndex, !!activeRoute]);

  const handleEditRoute = () => {
    setOnboardingStep("route_selection");
    setIsAutoFollowing(false);
    setNavigationState("none");
    setActiveRoute(null);
  };

  const handleDeleteHistoryItem = async (item: string) => {
    const newHistory = searchHistory.filter(s => s !== item);
    setSearchHistory(newHistory);
    await AsyncStorage.setItem("search_history", JSON.stringify(newHistory));
  };

  const handleChangeVehicle = () => {
    setOnboardingStep("vehicle");
    setActiveRoute(null);
  };

  const requestLocation = useCallback(async () => {
    if (!userLocation) {
      setIsLoadingLocation(true);
    }
    try {
      if (Platform.OS === "web") {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setUserLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
              setLocationPermission(true);
              setIsLoadingLocation(false);
            },
            (() => {
              setUserLocation({ latitude: 27.7172, longitude: 85.3240 });
              setLocationPermission(false);
              setIsLoadingLocation(false);
            }),
            { timeout: 10000, enableHighAccuracy: true }
          );
        } else {
          setUserLocation({ latitude: 27.7172, longitude: 85.3240 });
          setLocationPermission(false);
          setIsLoadingLocation(false);
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          setLocationPermission(true);
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        } else {
          setLocationPermission(false);
          setUserLocation({ latitude: 27.7172, longitude: 85.3240 });
        }
        setIsLoadingLocation(false);
      }
    } catch {
      setUserLocation({ latitude: 27.7172, longitude: 85.3240 });
      setLocationPermission(false);
      setIsLoadingLocation(false);
    }
  }, []);

  // Real-time location watcher
  useEffect(() => {
    let watchSubscription: any = null;

    const startWatching = async () => {
      if (Platform.OS === "web") {
        if ("geolocation" in navigator) {
          watchSubscription = navigator.geolocation.watchPosition(
            (position) => {
              setUserLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
            },
            (error) => console.error("Web location watch error:", error),
            { enableHighAccuracy: true, distanceFilter: 2 }
          );
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          watchSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: 2,
              timeInterval: 1000,
            },
            (location) => {
              setUserLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
            }
          );
        }
      }
    };

    startWatching();

    return () => {
      if (Platform.OS === "web") {
        if (watchSubscription !== null) navigator.geolocation.clearWatch(watchSubscription);
      } else {
        if (watchSubscription) watchSubscription.remove();
      }
    };
  }, []);

  // Initial Route Zoom Effect: Fit to whole path when route is first loaded
  useEffect(() => {
    if (onboardingStep === "done" && activeRoute && mapRef.current && navigationState === "overview" && Platform.OS !== "web") {
      console.log("Nav: Overview Zoom - Fitting to whole route");

      mapRef.current.fitToCoordinates(activeRoute, {
        edgePadding: MAP_CONFIG.OVERVIEW_PADDING,
        animated: true,
      });

      // Stay in overview for 3 seconds, then switch to following
      const timer = setTimeout(() => {
        setNavigationState("following");
        setIsAutoFollowing(true);
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, [onboardingStep, !!activeRoute, navigationState]);

  // Smoothed Follow Effect (Google Maps style)
  useEffect(() => {
    if (navigationState === "following" && activeRoute && userLocation && mapRef.current && Platform.OS !== "web") {
      // 1. Find the nearest point on the path
      let minDistance = Infinity;
      let nearestIndex = 0;

      for (let i = 0; i < activeRoute.length; i++) {
        const dist = getDistance(userLocation, activeRoute[i]);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIndex = i;
        }
      }
      setNearestPathIndex(nearestIndex);

      // 2. Lookahead logic: Find a point ~35m ahead for more stable predictive bearing
      let lookaheadDistance = 0;
      let lookaheadIndex = nearestIndex;
      const TARGET_LOOKAHEAD = 35; // Increased for stability

      for (let i = nearestIndex; i < activeRoute.length - 1; i++) {
        lookaheadDistance += getDistance(activeRoute[i], activeRoute[i + 1]);
        lookaheadIndex = i + 1;
        if (lookaheadDistance >= TARGET_LOOKAHEAD) break;
      }

      const targetPoint = activeRoute[lookaheadIndex];
      const heading = calculateBearing(userLocation, targetPoint);

      // 3. Professional Camera Animation (Heading-Up with Offset)
      // Center the camera on a point 40m ahead of the user to keep the user in lower 1/3
      const cameraCenter = getPointAtDistance(userLocation, 40, heading);

      mapRef.current.animateCamera({
        center: cameraCenter,
        heading: heading,
        pitch: MAP_CONFIG.PITCH,
        zoom: MAP_CONFIG.ZOOM,
      }, { duration: 1000 });
    }
  }, [userLocation, navigationState, !!activeRoute]);

  // Proximity Warning Logic
  useEffect(() => {
    // Only alert if:
    // 1. Alerts are enabled
    // 2. We have location and potholes
    // 3. User is NOT in setup/search (onboardingStep === 'done')
    // 4. User is actively navigating (navigationState !== 'none' and has route)
    if (!alertSettings.enabled || !userLocation || potholes.length === 0 ||
      onboardingStep !== "done" || navigationState === "none" || !activeRoute) {
      return;
    }

    // Threshold: 100m for motor vehicles, 10m for walking
    const threshold = vehicleType === "walking" ? 10 : 100;

    // Find nearby potholes that are ALSO on the path
    const nearby = potholes.filter(p => {
      const potholeCoord = {
        latitude: typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude,
        longitude: typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude
      };

      const distToUser = getDistance(userLocation, potholeCoord);
      if (distToUser > threshold) return false;

      // New Path Constraint: Only alert if it's on our active route (within 15m of the line)
      if (activeRoute) {
        return isPointNearPath(potholeCoord, activeRoute, 15);
      }

      return true; // If no route, alert based on radius only
    });

    if (nearby.length > 0) {
      const now = Date.now();
      // Cooldown to avoid constant alerting (5 seconds)
      if (now - lastAlertTime.current > 5000) {
        lastAlertTime.current = now;

        if (alertSettings.flash) {
          setIsAlerting(true);
          setTimeout(() => setIsAlerting(false), 2000);
        }

        if (alertSettings.sound && Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          speakAlert(nearby.length > 1 ? "Multiple potholes ahead" : "Pothole ahead");
        }
      }
    }
  }, [userLocation, potholes, alertSettings, vehicleType, onboardingStep, navigationState, !!activeRoute]);

  const handleAddPothole = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    let lat: number;
    let lng: number;

    try {
      if (Platform.OS === "web") {
        if (!userLocation) {
          Alert.alert("Location unavailable", "Cannot determine your current location.");
          return;
        }
        lat = userLocation.latitude;
        lng = userLocation.longitude;
      } else {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Please allow location access to report potholes.");
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        setUserLocation({ latitude: lat, longitude: lng });
      }
    } catch {
      if (userLocation) {
        lat = userLocation.latitude;
        lng = userLocation.longitude;
      } else {
        Alert.alert("Location unavailable", "Cannot determine your current location.");
        return;
      }
    }

    await addPothole(lat, lng);
    Alert.alert("Pothole Reported", `Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);

    if (mapRef.current && Platform.OS !== "web") {
      mapRef.current.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500
      );
    }
  };

  const handleNavigate = (screen: Screen) => {
    if (screen === "settings") {
      setSettingsVisible(true);
    } else if (screen === "update") {
      setUpdateModalVisible(true);
    }
  };

  const handleCloseSettings = async () => {
    setSettingsVisible(false);
    await loadAlertSettings();
  };

  const handleExit = () => {
    Alert.alert("Exit", "Are you sure you want to exit?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Exit",
        style: "destructive",
        onPress: () => {
          if (Platform.OS !== "web") {
            BackHandler.exitApp();
          }
        },
      },
    ]);
  };

  const handleUpdatePothole = async (lat: number, lng: number) => {
    if (selectedPothole) {
      await updatePothole(selectedPothole.id, lat, lng);
      setSelectedPothole(null);
    } else {
      await addPothole(lat, lng);
    }

    if (mapRef.current && Platform.OS !== "web") {
      mapRef.current.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500
      );
    }
  };

  const handleMarkerPress = (pothole: typeof potholes[number]) => {
    setSelectedPothole(pothole);
    setUpdateModalVisible(true);
  };

  const handleDeletePothole = async (id: string) => {
    await removePothole(id);
    setSelectedPothole(null);
  };

  const handleMyLocation = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (userLocation && mapRef.current && Platform.OS !== "web") {
      let heading = 0;

      // If we are currently navigating, calculate alignment for the focus button too
      if (navigationState === "following" && activeRoute) {
        let minDistance = Infinity;
        let nearestIndex = 0;
        for (let i = 0; i < activeRoute.length; i++) {
          const dist = getDistance(userLocation, activeRoute[i]);
          if (dist < minDistance) {
            minDistance = dist;
            nearestIndex = i;
          }
        }

        let lookaheadDistance = 0;
        let lookaheadIndex = nearestIndex;
        for (let i = nearestIndex; i < activeRoute.length - 1; i++) {
          lookaheadDistance += getDistance(activeRoute[i], activeRoute[i + 1]);
          lookaheadIndex = i + 1;
          if (lookaheadDistance >= MAP_CONFIG.LOOKAHEAD_DISTANCE) break;
        }
        heading = calculateBearing(userLocation, activeRoute[lookaheadIndex]);
      }

      mapRef.current.animateCamera({
        center: userLocation,
        heading: heading,
        pitch: navigationState === "following" ? MAP_CONFIG.PITCH : MAP_CONFIG.HOME_PITCH,
        zoom: navigationState === "following" ? MAP_CONFIG.ZOOM : 16,
      }, { duration: 800 });

      setIsAutoFollowing(true);
    }
  };

  // Onboarding screens
  if (onboardingStep === "loading") {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (onboardingStep === "guide") {
    return <OnboardingGuide onComplete={handleGuideComplete} />;
  }

  if (onboardingStep === "vehicle") {
    return <VehicleSelect onSelect={handleVehicleSelect} />;
  }

  if (onboardingStep === "ride_start") {
    return (
      <RideStart
        onStart={handleRideStart}
        onBack={() => setOnboardingStep("vehicle")}
        vehicleType={vehicleType || "car"}
      />
    );
  }

  const handleDeleteHistoryItem = async (item: string) => {
    const newHistory = searchHistory.filter(h => h !== item);
    setSearchHistory(newHistory);
    try {
      await AsyncStorage.setItem("search_history", JSON.stringify(newHistory));
    } catch (e) {
      console.log("Failed to save history after delete", e);
    }
  };

  const handlePickFromMap = () => {
    setIsPickingFromMap(true);
    setOnboardingStep("done"); // Slide back to map
    setActiveRoute(null);
    setMapSelectionPoint(null);

    // Zoom in with navigation settings for a "Pro" feel
    if (userLocation && mapRef.current && Platform.OS !== "web") {
      mapRef.current.animateCamera({
        center: userLocation,
        pitch: MAP_CONFIG.PITCH,
        zoom: MAP_CONFIG.ZOOM,
        heading: 0,
      }, { duration: 1000 });
    }
  };

  const handleCancelMapPick = () => {
    setIsPickingFromMap(false);
    setMapSelectionPoint(null);
    setOnboardingStep("route_selection");
  };

  const handleConfirmMapPick = async () => {
    if (!mapSelectionPoint) return;

    setIsProcessingRoute(true);
    // Default fallback name
    let name = `${mapSelectionPoint.latitude.toFixed(4)}, ${mapSelectionPoint.longitude.toFixed(4)}`;

    try {
      // 1. Try to reverse geocode to get a readable name
      const addressResults = await Location.reverseGeocodeAsync({
        latitude: mapSelectionPoint.latitude,
        longitude: mapSelectionPoint.longitude,
      });

      if (addressResults && addressResults.length > 0) {
        const address = addressResults[0];
        const label = address.name || address.street || "Selected point";
        name = `${label} (${mapSelectionPoint.latitude.toFixed(4)}, ${mapSelectionPoint.longitude.toFixed(4)})`;
      }
    } catch (error) {
      console.log("Geocoding failed, using coordinates fallback", error);
    }

    try {
      // 2. Trigger routing (independent of geocoding success)
      await handleRouteSelect("Current Location", name, name, mapSelectionPoint);
      setIsPickingFromMap(false);
      setMapSelectionPoint(null);
    } catch (error) {
      // Error already alerted in handleRouteSelect
    } finally {
      setIsProcessingRoute(false);
    }
  };

  // Main app screens
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Global Onboarding & Search Overlays (Preserves Map State) */}
      {onboardingStep === "route_selection" && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
          <RouteSelection
            onRouteSelect={handleRouteSelect}
            onBack={() => setOnboardingStep("ride_start")}
            isLoading={isProcessingRoute}
            history={searchHistory}
            onDeleteHistoryItem={handleDeleteHistoryItem}
            onPickFromMap={handlePickFromMap}
          />
        </View>
      )}

      <AppHeader onMenuPress={() => setDrawerVisible(true)} />

      {isLoadingLocation && !userLocation ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      ) : (
        <View style={styles.mapContainer}>
          <MapViewWrapper
            ref={mapRef}
            userLocation={userLocation}
            initialRegion={{
              latitude: userLocation?.latitude ?? 27.7172,
              longitude: userLocation?.longitude ?? 85.3240,
              latitudeDelta: MAP_CONFIG.HOME_LAT_DELTA,
              longitudeDelta: MAP_CONFIG.HOME_LAT_DELTA,
            }}
            showsUserLocation={locationPermission === true}
            markers={potholes}
            onMarkerPress={handleMarkerPress}
            onMapPress={(coord) => {
              console.log("Map Pressed at:", coord, "isPickingFromMap:", isPickingFromMap);
              if (isPickingFromMap) {
                setMapSelectionPoint(coord);
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                return;
              }
              if (isAdmin) {
                Alert.alert(
                  "Report Pothole",
                  "Report a pothole at this exact location?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Report",
                      onPress: () => addPothole(coord.latitude, coord.longitude)
                    }
                  ]
                );
              }
            }}
            route={activeRoute}
            isOffline={isOffline}
            selectionMarker={mapSelectionPoint}
            mapType={mapMode}
          />

          {isPickingFromMap && (
            <View style={styles.mapPickOverlay}>
              <View style={styles.mapPickTopBar}>
                <Ionicons name="map" size={20} color={Colors.primary} />
                <Text style={styles.mapPickTopText}>
                  {mapSelectionPoint ? "Destination Selected" : "Tap map to set destination"}
                </Text>
              </View>

              <View style={styles.mapPickActionRow}>
                <Pressable
                  style={[styles.mapPickBtn, styles.mapPickCancelBtn]}
                  onPress={handleCancelMapPick}
                >
                  <Text style={styles.mapPickCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.mapPickBtn,
                    styles.mapPickConfirmBtn,
                    !mapSelectionPoint && { opacity: 0.5 }
                  ]}
                  onPress={handleConfirmMapPick}
                  disabled={!mapSelectionPoint}
                >
                  <Text style={styles.mapPickConfirmText}>Navigate Here</Text>
                  <Ionicons name="arrow-forward" size={18} color={Colors.textLight} />
                </Pressable>
              </View>
            </View>
          )}

          {isOffline && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline" size={16} color={Colors.textLight} />
              <Text style={styles.offlineBannerText}>Offline Mode</Text>
            </View>
          )}

          {isProcessingRoute && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.processingText}>Calculating road path...</Text>
            </View>
          )}

          {Platform.OS !== "web" ? (
            <View style={styles.mapSideButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.mapSideBtn,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  const modes: ("standard" | "satellite" | "hybrid")[] = ["standard", "satellite", "hybrid"];
                  const next = modes[(modes.indexOf(mapMode) + 1) % modes.length];
                  setMapMode(next);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons name="layers" size={22} color={Colors.primary} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.mapSideBtn,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={handleMyLocation}
              >
                <Ionicons name="locate" size={22} color={Colors.primary} />
              </Pressable>
            </View>
          ) : null}

          {onboardingStep === "done" && !isPickingFromMap && (
            <View style={styles.routeHeaderOverlay}>
              <View style={styles.routeInfo}>
                <View style={styles.routeCol}>
                  <View style={styles.riskRow}>
                    <Text style={styles.routeLabel}>
                      {activeRoute ? "Destination" : "Ready for a ride?"}
                    </Text>
                    {activeRoute && (
                      <View style={[styles.riskBadge, { backgroundColor: riskScore === "High" ? Colors.error : riskScore === "Medium" ? Colors.warning : Colors.success }]}>
                        <Text style={styles.riskText}>{riskScore} Risk</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.routeVal} numberOfLines={1}>
                    {activeRoute ? (destinationName || "Active Path") : "Search destination"}
                  </Text>
                </View>
                <Pressable onPress={handleEditRoute} style={styles.routeBtn}>
                  <Ionicons name={activeRoute ? "map-outline" : "search"} size={18} color={Colors.primary} />
                  <Text style={styles.routeBtnText}>{activeRoute ? "Edit Route" : "Search"}</Text>
                </Pressable>
              </View>
              <Pressable onPress={handleChangeVehicle} style={styles.vehicleChip}>
                <Ionicons name="car-outline" size={18} color={Colors.textLight} />
                <Text style={styles.vehicleChipText}>{vehicleType || "Car"}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {isAdmin && <FloatingActionButton onPress={handleAddPothole} />}

      <DrawerMenu
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onNavigate={handleNavigate}
        onExit={handleExit}
        onNavigateToAdminLogin={() => {
          setDrawerVisible(false);
          setAdminLoginVisible(true);
        }}
      />

      <AdminLoginModal
        visible={adminLoginVisible}
        onClose={() => setAdminLoginVisible(false)}
        onLogin={loginAdmin}
      />

      <UpdateModal
        visible={updateModalVisible}
        onClose={() => {
          setUpdateModalVisible(false);
          setSelectedPothole(null);
        }}
        onUpdate={handleUpdatePothole}
        onDelete={handleDeletePothole}
        pothole={selectedPothole}
        isAdmin={isAdmin}
      />

      <Modal
        visible={settingsVisible}
        animationType="slide"
        onRequestClose={handleCloseSettings}
      >
        <SettingsView onClose={handleCloseSettings} />
      </Modal>

      {isAlerting && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(212, 68, 59, 0.3)', zIndex: 999 }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  mapContainer: {
    flex: 1,
  },
  routeHeaderOverlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    gap: 12,
  },
  routeCol: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  routeVal: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  routeBtnText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  vehicleChip: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  vehicleChipText: {
    color: Colors.textLight,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  mapSideButtons: {
    position: "absolute",
    right: 16,
    bottom: 100,
    gap: 12,
  },
  mapSideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  riskText: {
    fontSize: 9,
    color: Colors.textLight,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  myLocationButton: {
    position: "absolute",
    left: 16,
    bottom: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  offlineBanner: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    backgroundColor: 'rgba(212, 68, 59, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1000,
  },
  offlineBannerText: {
    color: Colors.textLight,
    fontSize: 12,
    fontWeight: '700',
  },
  mapPickOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    gap: 16,
  },
  mapPickTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mapPickTopText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  mapPickActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mapPickBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  mapPickCancelBtn: {
    backgroundColor: Colors.inputBackground,
  },
  mapPickConfirmBtn: {
    backgroundColor: Colors.primary,
  },
  mapPickCancelText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  mapPickConfirmText: {
    color: Colors.textLight,
    fontWeight: '700',
  },
});
