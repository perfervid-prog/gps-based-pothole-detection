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
import { usePotholes } from "@/contexts/PotholeContext";
import {
  isOnboardingComplete,
  setOnboardingComplete,
  getVehicleType,
  setVehicleType,
  VehicleType,
} from "@/lib/onboarding";

type Screen = "home" | "settings" | "update";
type OnboardingStep = "loading" | "guide" | "vehicle" | "ride_start" | "route_selection" | "done";

interface Coordinate {
  latitude: number;
  longitude: number;
}

export default function HomeScreen() {
  const {
    potholes,
    addPothole,
    editPothole,
    removePothole,
    selectedPothole,
    setSelectedPothole,
  } = usePotholes();

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("loading");
  const [vehicleType, setVehicleTypeState] = useState<VehicleType | null>(null);
  const [activeRoute, setActiveRoute] = useState<Coordinate[] | null>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isProcessingRoute, setIsProcessingRoute] = useState(false);
  const [destinationName, setDestinationName] = useState<string>("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isAutoFollowing, setIsAutoFollowing] = useState(false);
  const mapRef = useRef<any>(null);

  // Check onboarding status on mount
  useEffect(() => {
    (async () => {
      const completed = await isOnboardingComplete();
      const savedVehicle = await getVehicleType();

      if (completed && savedVehicle) {
        setVehicleTypeState(savedVehicle);
        setOnboardingStep("done");
        requestLocation();

        const history = await AsyncStorage.getItem("search_history");
        if (history) setSearchHistory(JSON.parse(history));
      } else {
        setOnboardingStep("guide");
      }
    })();
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

  const handleRouteSelect = async (source: string, destination: string, fullAddress?: string) => {
    setIsProcessingRoute(true);
    setActiveRoute(null);
    setDestinationName(destination);
    console.log("Starting route search for:", destination);

    try {
      const start = userLocation || { latitude: 27.7172, longitude: 85.3240 };
      let endCoords: Coordinate | null = null;

      // 1. Geocoding: Try to find coordinates for the destination
      // We try two steps: first a precise search, then a broader one if needed
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

      if (!endCoords) {
        throw new Error("Could not find this location. Try being more specific.");
      }

      // 2. Routing: Get road-snapped path from OSRM
      console.log("Fetching route from OSRM...");
      const routeResponse = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${endCoords.longitude},${endCoords.latitude}?overview=full&geometries=geojson`
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

        if (mapRef.current && Platform.OS !== "web") {
          setIsAutoFollowing(false);
          setTimeout(() => {
            mapRef.current.fitToCoordinates(path, {
              edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
              animated: true,
            });
          }, 800);

          // Switch to follow mode after overview
          setTimeout(() => setIsAutoFollowing(true), 5000);
        }
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

  const handleEditRoute = () => {
    setOnboardingStep("route_selection");
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
              distanceInterval: 5,
              timeInterval: 2000,
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

  // Auto-follow effect: Smoothly re-center if navigating
  useEffect(() => {
    if (activeRoute && userLocation && mapRef.current && isAutoFollowing && Platform.OS !== "web") {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.003,
        longitudeDelta: 0.003,
      }, 1000);
    }
  }, [userLocation, !!activeRoute, isAutoFollowing]);

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
    setCurrentScreen(screen);
    if (screen === "update") {
      setUpdateModalVisible(true);
      setCurrentScreen("home");
    }
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
      await editPothole(selectedPothole.id, lat, lng);
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
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
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

  if (onboardingStep === "route_selection") {
    return (
      <RouteSelection
        onRouteSelect={handleRouteSelect}
        onBack={() => setOnboardingStep("ride_start")}
        isLoading={isProcessingRoute}
        history={searchHistory}
        onDeleteHistoryItem={handleDeleteHistoryItem}
      />
    );
  }

  // Main app screens
  if (currentScreen === "settings") {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <AppHeader
          onMenuPress={() => setDrawerVisible(true)}
          title="Settings"
        />
        <SettingsView onClose={() => setCurrentScreen("home")} />
        <DrawerMenu
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          onNavigate={handleNavigate}
          onExit={handleExit}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

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
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsUserLocation={locationPermission === true}
            markers={potholes}
            onMarkerPress={handleMarkerPress}
            route={activeRoute}
          />

          {Platform.OS !== "web" ? (
            <Pressable
              style={({ pressed }) => [
                styles.myLocationButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleMyLocation}
            >
              <Ionicons name="locate" size={22} color={Colors.primary} />
            </Pressable>
          ) : null}

          <View style={styles.routeHeaderOverlay}>
            <View style={styles.routeInfo}>
              <View style={styles.routeCol}>
                <Text style={styles.routeLabel}>Destination</Text>
                <Text style={styles.routeVal} numberOfLines={1}>{destinationName || "Active Path"}</Text>
              </View>
              <Pressable onPress={handleEditRoute} style={styles.routeBtn}>
                <Ionicons name="map-outline" size={16} color={Colors.primary} />
                <Text style={styles.routeBtnText}>Edit Route</Text>
              </Pressable>
            </View>
            <Pressable onPress={handleChangeVehicle} style={styles.vehicleChip}>
              <Ionicons name="car-outline" size={16} color={Colors.textLight} />
              <Text style={styles.vehicleChipText}>{vehicleType || "Car"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <FloatingActionButton onPress={handleAddPothole} />

      <DrawerMenu
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onNavigate={handleNavigate}
        onExit={handleExit}
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
      />
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
});
