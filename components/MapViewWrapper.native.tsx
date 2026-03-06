import React, { forwardRef } from "react";
import { StyleSheet, Platform, View } from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

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
  mapType?: "standard" | "satellite" | "hybrid" | "terrain";
}

export const MapViewWrapper = forwardRef<MapView, MapViewWrapperProps>(
  ({ initialRegion, showsUserLocation, userLocation, markers, onMarkerPress, onMapPress, route, isOffline, selectionMarker, mapType = "standard" }, ref) => {
    return (
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        mapType={Platform.OS === "android" ? "none" : mapType}
        onPress={(e) => {
          if (onMapPress) onMapPress(e.nativeEvent.coordinate);
        }}
      >
        {/* Custom Tile Layer for Android (Bypasses Google Maps API Key requirement) or Offline Mode */}
        {(Platform.OS === "android" || isOffline) && (
          <UrlTile
            urlTemplate={
              mapType === "satellite" || mapType === "hybrid"
                ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                : "https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png"
            }
            maximumZ={19}
            flipY={false}
            shouldReplaceCustomLayer={true}
            tileSize={256}
          />
        )}

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
              strokeColor={Colors.accent}
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
