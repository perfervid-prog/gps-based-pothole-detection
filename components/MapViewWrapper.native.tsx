import React, { forwardRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
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
  route?: Coordinate[] | null;
}

export const MapViewWrapper = forwardRef<MapView, MapViewWrapperProps>(
  ({ initialRegion, showsUserLocation, userLocation, markers, onMarkerPress, route }, ref) => {
    return (
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
      >
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
              pinColor={Colors.accent}
            >
              <Ionicons name="location" size={32} color={Colors.accent} />
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
