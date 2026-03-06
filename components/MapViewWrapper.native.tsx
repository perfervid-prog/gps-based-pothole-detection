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
  mapType?: "standard" | "satellite" | "hybrid" | "terrain";
}

export const MapViewWrapper = forwardRef<any, MapViewWrapperProps>(
  ({ initialRegion, showsUserLocation, userLocation, markers, onMarkerPress, onMapPress, route, isOffline, selectionMarker, mapType = "standard" }, ref) => {

    // NATIVE ANDROID FALLBACK: Bypass Google Maps SDK and fake API Key completely using Leaflet WebView
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
          mapType={mapType}
        />
      );
    }

    // IOS NATIVE MAPKIT (Uses Apple Maps natively, no API key needed, extremely fast)
    return (
      <MapView
        ref={ref}
        style={{ flex: 1, width: '100%', height: '100%' }}
        initialRegion={initialRegion}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        mapType={mapType}
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
