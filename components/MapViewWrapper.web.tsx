import React, { forwardRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
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
  selectionMarker?: Coordinate | null;
  destinationMarker?: Coordinate | null;
}

export const MapViewWrapper = ({ initialRegion, showsUserLocation, markers, onMarkerPress, route, userLocation, selectionMarker, destinationMarker }: MapViewWrapperProps) => {
  const iframeRef = React.useRef<any>(null);

  // Generate a Leaflet HTML to show in an iframe
  const potholeMarkersJson = JSON.stringify(markers.map(m => [
    typeof m.latitude === 'string' ? parseFloat(m.latitude) : m.latitude,
    typeof m.longitude === 'string' ? parseFloat(m.longitude) : m.longitude,
    m.id
  ]));
  const routeJson = JSON.stringify(route ? route.map(r => [r.latitude, r.longitude]) : []);
  const userLocJson = JSON.stringify(userLocation ? [userLocation.latitude, userLocation.longitude] : null);
  const selectionLocJson = JSON.stringify(selectionMarker ? [selectionMarker.latitude, selectionMarker.longitude] : null);
  const destinationLocJson = JSON.stringify(destinationMarker ? [destinationMarker.latitude, destinationMarker.longitude] : null);

  const leafletHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { height: 100vh; width: 100vw; }
          .leaflet-marker-icon { filter: drop-shadow(0 4px 4px rgba(0,0,0,0.4)); }
          #map { perspective: 1000px; background: #f0f0f0; }
          .user-location-pulse {
              width: 14px;
              height: 14px;
              background: #007AFF;
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 4px 10px rgba(0, 122, 255, 0.6);
              position: relative;
              transform: translateY(-2px);
          }
          .user-location-pulse::after {
              content: '';
              position: absolute;
              top: -4px;
              left: -4px;
              right: -4px;
              bottom: -4px;
              border: 4px solid rgba(0, 122, 255, 0.3);
              border-radius: 50%;
              animation: pulse 2s infinite;
          }
          .selection-marker {
              width: 16px;
              height: 16px;
              background: #10B981;
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
          }
          @keyframes pulse {
              0% { transform: scale(1) translateY(0); opacity: 1; }
              100% { transform: scale(3) translateY(0); opacity: 0; }
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map').setView([${initialRegion.latitude}, ${initialRegion.longitude}], 15);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);

          let userMarker = null;
          let selectionMarker = null;
          let destMarker = null;
          const potholeMarkers = ${potholeMarkersJson};
          const routePoints = ${routeJson};

          function updateUserLocation(lat, lng) {
              if (userMarker) {
                  userMarker.setLatLng([lat, lng]);
              } else {
                  const icon = L.divIcon({
                      className: 'user-location-pulse-container',
                      html: '<div class="user-location-pulse"></div>',
                      iconSize: [20, 20],
                      iconAnchor: [10, 10]
                  });
                  userMarker = L.marker([lat, lng], { icon }).addTo(map);
              }
          }

          function updateSelection(lat, lng) {
              if (selectionMarker) {
                  if (lat === null) {
                      map.removeLayer(selectionMarker);
                      selectionMarker = null;
                  } else {
                      selectionMarker.setLatLng([lat, lng]);
                  }
              } else if (lat !== null) {
                  const icon = L.divIcon({
                      className: 'selection-marker-container',
                      html: '<div class="selection-marker"></div>',
                      iconSize: [20, 20],
                      iconAnchor: [10, 10]
                  });
                  selectionMarker = L.marker([lat, lng], { icon }).addTo(map);
              }
          }

          function updateDestination(lat, lng) {
              if (destMarker) {
                  if (lat === null) {
                      map.removeLayer(destMarker);
                      destMarker = null;
                  } else {
                      destMarker.setLatLng([lat, lng]);
                  }
              } else if (lat !== null) {
                  destMarker = L.marker([lat, lng]).addTo(map)
                      .bindPopup("Destination");
              }
          }

          if (${userLocJson}) {
              const u = ${userLocJson};
              updateUserLocation(u[0], u[1]);
          }

          if (${selectionLocJson}) {
              const s = ${selectionLocJson};
              updateSelection(s[0], s[1]);
          }

          if (${destinationLocJson}) {
              const d = ${destinationLocJson};
              updateDestination(d[0], d[1]);
          }

          potholeMarkers.forEach(m => {
            const potholeIcon = L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            });

            const marker = L.marker([m[0], m[1]], { icon: potholeIcon }).addTo(map);
            marker.on('click', () => {
              window.parent.postMessage({ type: 'marker_press', id: m[2] }, '*');
            });
          });

          if (routePoints.length > 0) {
            const polyline = L.polyline(routePoints, { color: '${Colors.accent}', weight: 6 }).addTo(map);
            map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
          }

          // Handle incoming messages
          window.addEventListener('message', (event) => {
              if (event.data.type === 'update_user_location') {
                  updateUserLocation(event.data.lat, event.data.lng);
                  if (event.data.follow) {
                      map.setView([event.data.lat, event.data.lng], 19, { animate: true });
                  }
              } else if (event.data.type === 'update_selection') {
                  updateSelection(event.data.lat, event.data.lng);
              } else if (event.data.type === 'update_destination') {
                  updateDestination(event.data.lat, event.data.lng);
              }
          });
        </script>
      </body>
      </html>
    `;

  // Send updates to iframe
  React.useEffect(() => {
    if (iframeRef.current && userLocation) {
      iframeRef.current.contentWindow.postMessage({
        type: 'update_user_location',
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        follow: !!route
      }, '*');
    }
  }, [userLocation, !!route]);

  React.useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow.postMessage({
        type: 'update_selection',
        lat: selectionMarker?.latitude ?? null,
        lng: selectionMarker?.longitude ?? null,
      }, '*');
    }
  }, [selectionMarker]);

  React.useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow.postMessage({
        type: 'update_destination',
        lat: destinationMarker?.latitude ?? null,
        lng: destinationMarker?.longitude ?? null,
      }, '*');
    }
  }, [destinationMarker]);

  // Handle marker press message from iframe
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'marker_press') {
        const marker = markers.find(m => m.id === event.data.id);
        if (marker) onMarkerPress(marker);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [markers, onMarkerPress]);

  return (
    <View style={styles.container}>
      <iframe
        ref={iframeRef}
        srcDoc={leafletHtml}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="OpenStreetMap"
      />
      {route && (
        <View style={styles.routeOverlay}>
          <Ionicons name="navigate-circle" size={18} color={Colors.primary} />
          <Text style={styles.routeOverlayText}>Navigating Path</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  routeOverlay: {
    position: 'absolute',
    top: 100,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeOverlayText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  }
});
