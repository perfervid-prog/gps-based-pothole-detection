import React, { forwardRef } from "react";
import { StyleSheet, Platform, View } from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { WebViewMap } from "./WebViewMap";

interface PotholeMarker {
  id: string;
  latitude: string | number;
  longitude: string | number;
}

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface MapViewWrapperProps {
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  showsUserLocation: boolean;
  userLocation?: Coordinate | null;
  markers: PotholeMarker[];
  onMarkerPress: (marker: PotholeMarker) => void;
  onMapPress?: (coordinate: Coordinate) => void;
  route?: Coordinate[] | null;
  isOffline?: boolean;
  selectionMarker?: Coordinate | null;
  destinationMarker?: Coordinate | null;
  mapType?: "standard" | "satellite" | "hybrid" | "terrain";
  onMapTouchStart?: () => void;
  isAutoFollowing?: boolean;
}

export const MapViewWrapper = forwardRef<any, MapViewWrapperProps>(
  ({ initialRegion, showsUserLocation, userLocation, markers, onMarkerPress, onMapPress, route, isOffline, selectionMarker, destinationMarker, mapType = "standard", onMapTouchStart, isAutoFollowing }, ref) => {

    // PREFER 3D WEB ENGINE ON ANDROID (NO BILLING/NO API KEY REQUIRED)
    if (Platform.OS === "android") {
      return (
        <WebViewMap
          ref={ref}
          initialRegion={initialRegion}
          markers={markers.map(m => ({
            id: m.id,
            latitude: typeof m.latitude === 'string' ? parseFloat(m.latitude) : m.latitude,
            longitude: typeof m.longitude === 'string' ? parseFloat(m.longitude) : m.longitude
          }))}
          onMarkerPress={onMarkerPress}
          onMapPress={onMapPress}
          route={route}
          userLocation={userLocation}
          selectionMarker={selectionMarker}
          destinationMarker={destinationMarker}
          isAutoFollowing={isAutoFollowing}
          mapType={mapType}
          onMapTouchStart={onMapTouchStart}
        />
      );
    }

    // IOS NATIVE MAPKIT (Uses Apple Maps natively, no API key needed, extremely fast 3D)
    return (
      <MapView
        ref={ref}
        style={{ flex: 1, width: '100%', height: '100%' }}
        initialRegion={initialRegion}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        showsCompass={true}
        mapType={mapType}
        pitchEnabled={true}
        showsBuildings={true}
        mapPadding={{ top: 0, right: 0, bottom: isAutoFollowing ? 250 : 0, left: 0 }}
        onMapReady={() => {
          // Smooth Native 3D Swoop
          if (ref && 'current' in ref && ref.current) {
            ref.current.animateCamera({
              pitch: 65,
              center: {
                latitude: initialRegion.latitude,
                longitude: initialRegion.longitude,
              },
              zoom: 19.0
            }, { duration: 2500 });
          }
        }}
        onPress={(e) => {
          if (onMapPress) onMapPress(e.nativeEvent.coordinate);
        }}
      >
        {selectionMarker && (
          <Marker
            coordinate={selectionMarker}
            title="Selected Destination"
            pinColor={Colors.accent}
          >
            <View style={styles.selectionMarkerContainer}>
              <View style={styles.selectionMarkerPulse} />
              <Ionicons name="location" size={32} color={Colors.accent} />
            </View>
          </Marker>
        )}

        {route && route.length > 0 && (
          <>
            <Polyline
              coordinates={route}
              strokeColor={"#2563EB"}
              strokeWidth={6}
            />
            <Marker
              coordinate={route[route.length - 1]}
              title="Destination"
              pinColor={Colors.primary}
            >
              <Ionicons name="location" size={32} color={Colors.primary} />
            </Marker>
          </>
        )}

        {markers.map((pothole) => (
          <Marker
            key={pothole.id}
            coordinate={{
              latitude: typeof pothole.latitude === 'string' ? parseFloat(pothole.latitude) : pothole.latitude,
              longitude: typeof pothole.longitude === 'string' ? parseFloat(pothole.longitude) : pothole.longitude,
            }}
            onPress={() => onMarkerPress(pothole)}
            pinColor={Colors.mapMarker}
          />
        ))}
      </MapView>
    );
  }
);
const styles = StyleSheet.create({
  selectionMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionMarkerPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accent + '30',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
});
