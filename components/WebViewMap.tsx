import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import Colors from '@/constants/colors';

interface Coordinate {
    latitude: number;
    longitude: number;
}

interface WebMarker extends Coordinate {
    id: string;
}

interface WebViewMapProps {
    initialRegion: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    };
    markers: WebMarker[];
    onMarkerPress?: (marker: WebMarker) => void;
    onMapPress?: (coordinate: Coordinate) => void;
    route?: Coordinate[] | null;
    userLocation?: Coordinate | null;
    mapType?: "standard" | "satellite" | "hybrid" | "terrain";
    selectionMarker?: Coordinate | null;
    destinationMarker?: Coordinate | null;
    onMapTouchStart?: () => void;
    isAutoFollowing?: boolean;
}

/**
 * HIGH-PERFORMANCE 3D MAP ENGINE - VOYAGER 2.0
 * Restored: Standard User Dot (Blue with Pulse Glow).
 */
const mapHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <script src='https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js'></script>
    <link href='https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css' rel='stylesheet' />
    <style>
        body { padding: 0; margin: 0; background: #F8FAFC; touch-action: none; }
        html, body, #map { height: 100vh; width: 100vw; overflow: hidden; }
        .maplibregl-ctrl-logo, .maplibregl-ctrl-attrib { display: none !important; }

        @keyframes pulse-red {
            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .marker-red {
            width: 16px; height: 16px; border-radius: 8px;
            background: #EF4444; border: 2px solid #FFF;
            box-shadow: 0 2px 5px rgba(0,0,0,0.4);
            cursor: pointer;
            animation: pulse-red 2s infinite;
        }

        /* RESTORED: BLUE USER DOT */
        .marker-user {
            width: 22px; height: 22px; border-radius: 11px;
            background: #2563EB; border: 3px solid #FFF;
            box-shadow: 0 0 15px rgba(37,99,235,0.6);
        }
        
        .marker-destination {
            width: 32px; height: 32px;
            background-image: url('https://cdn-icons-png.flaticon.com/512/684/684908.png');
            background-size: cover;
            filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5));
        }
        .marker-selection {
            width: 24px; height: 24px; border-radius: 12px;
            background: rgba(16, 185, 129, 0.2); border: 2px solid #10B981;
        }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        let isFollowing = false;
        let userLocation = null;
        let activeRoute = null;

        const map = new maplibregl.Map({
            container: 'map',
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            center: [85.3240, 27.7172],
            zoom: 20.1,
            pitch: 75,
            bearing: 0,
            antialias: true,
            maxZoom: 22
        });

        let markers = {};
        let userMarker = null;
        let destMarker = null;
        let selectionMarker = null;

        map.on('load', () => {
             map.addSource('route', { 'type': 'geojson', 'data': { 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': [] } } });
             map.addLayer({ 
                'id': 'route-line', 
                'type': 'line', 
                'source': 'route', 
                'layout': { 'line-join': 'round', 'line-cap': 'round' },
                'paint': { 'line-color': '#2563EB', 'line-width': 10, 'line-opacity': 1.0 } 
             });

             map.addLayer({
                'id': '3d-buildings',
                'source': 'carto',
                'source-layer': 'building',
                'type': 'fill-extrusion',
                'minzoom': 15,
                'paint': {
                    'fill-extrusion-color': '#CBD5E1',
                    'fill-extrusion-height': ['get', 'render_height'],
                    'fill-extrusion-base': ['get', 'render_min_height'],
                    'fill-extrusion-opacity': 0.8
                }
            });
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
        });

        const notifyInteraction = () => {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'onMapTouchStart' }));
        };
        map.on('dragstart', notifyInteraction);
        map.on('zoomstart', notifyInteraction);
        map.on('pitchstart', notifyInteraction);
        
        map.on('click', (e) => {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'onMapPress', latitude: e.lngLat.lat, longitude: e.lngLat.lng }));
        });

        const getDistance = (c1, c2) => {
            const R = 6371e3;
            const f1 = c1.latitude * Math.PI/180;
            const f2 = c2.latitude * Math.PI/180;
            const df = (c2.latitude - c1.latitude) * Math.PI/180;
            const dl = (c2.longitude - c1.longitude) * Math.PI/180;
            const a = Math.sin(df/2) * Math.sin(df/2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2) * Math.sin(dl/2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        };

        const calculateBearing = (start, end) => {
            const startLat = start.latitude * Math.PI/180;
            const startLng = start.longitude * Math.PI/180;
            const endLat = end.latitude * Math.PI/180;
            const endLng = end.longitude * Math.PI/180;
            const dLng = endLng - startLng;
            const y = Math.sin(dLng) * Math.cos(endLat);
            const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
            return (Math.atan2(y, x) * 180/Math.PI + 360) % 360;
        };

        const getPointAtDistance = (start, distance, bearing) => {
            const R = 6371e3;
            const dist = distance / R;
            const brng = bearing * Math.PI/180;
            const lat1 = start.latitude * Math.PI/180;
            const lon1 = start.longitude * Math.PI/180;
            const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) + Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));
            const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) * Math.cos(lat1), Math.cos(dist) - Math.sin(lat1) * Math.sin(lat2));
            return { latitude: lat2 * 180/Math.PI, longitude: lon2 * 180/Math.PI };
        };

        let manualOverride = false;
        let overrideTimeout = null;

        function performSmoothFollow() {
            if (manualOverride || !isFollowing || !userLocation || !activeRoute || activeRoute.length < 2) return;
            
            let minDistance = Infinity;
            let nearestIndex = 0;
            for (let i = 0; i < activeRoute.length; i++) {
                const d = getDistance(userLocation, activeRoute[i]);
                if (d < minDistance) { minDistance = d; nearestIndex = i; }
            }

            const nextPoint = activeRoute[nearestIndex + 1] || activeRoute[nearestIndex];
            const heading = calculateBearing(activeRoute[nearestIndex], nextPoint);
            
            const cameraCenter = getPointAtDistance(userLocation, 5, heading);

            map.flyTo({
                center: [cameraCenter.longitude, cameraCenter.latitude],
                zoom: 22.0, // 🔍 MAX ZOOM
                pitch: 75,
                bearing: heading,
                duration: 1200,
                essential: true
            });
            
            if (nearestIndex > 0) {
                 const trimmed = activeRoute.slice(nearestIndex);
                 if (trimmed.length > 2) {
                     activeRoute = trimmed;
                     map.getSource('route').setData({ 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': activeRoute.map(c => [c.longitude, c.latitude]) } });
                 }
            }
        }

        const findNearestPointOnRoute = (point) => {
            if (!activeRoute || activeRoute.length < 2) return point;
            let minD = Infinity;
            let closer = point;
            
            for (let i = 0; i < activeRoute.length - 1; i++) {
                const segStart = activeRoute[i];
                const segEnd = activeRoute[i+1];
                
                // Simple linear approximation for snapping
                const t = 0.5; // Snap to segment midpoint or find actual projection
                // For a professional feel, we just find the closest vertex if distance < 25m
                const d = getDistance(point, segStart);
                if (d < minD) {
                    minD = d;
                    closer = segStart;
                }
            }
            return minD < 25 ? closer : point;
        };

        function handleMessage(event) {
            try {
                const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                
                if (message.type === 'init') {
                    const center = message.userLocation || { latitude: message.region.latitude, longitude: message.region.longitude };
                    if (center && center.latitude !== 0) {
                        map.jumpTo({ center: [center.longitude, center.latitude], zoom: 20.1, pitch: 75 });
                    }
                }
                else if (message.type === 'updateMarkers') {
                    Object.values(markers).forEach(m => m.remove());
                    markers = {};
                    (message.markers || []).forEach(m => {
                        const snapped = findNearestPointOnRoute({ latitude: m.latitude, longitude: m.longitude });
                        const el = document.createElement('div'); el.className = 'marker-red';
                        const marker = new maplibregl.Marker({ element: el })
                            .setLngLat([snapped.longitude, snapped.latitude])
                            .addTo(map);
                        el.onclick = () => window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'onMarkerPress', id: m.id }));
                        markers[m.id] = marker;
                    });
                }
                else if (message.type === 'updateUserLocation') {
                    userLocation = message.location;
                    if (userMarker) userMarker.remove();
                    if (userLocation) {
                        const el = document.createElement('div'); el.className = 'marker-user';
                        userMarker = new maplibregl.Marker({ element: el, zIndexOffset: 1000 })
                            .setLngLat([userLocation.longitude, userLocation.latitude])
                            .addTo(map);

                        if (message.isFirst) {
                            map.flyTo({ center: [userLocation.longitude, userLocation.latitude], zoom: 20.1, pitch: 75, duration: 1500 });
                        }
                    }
                    if (isFollowing) performSmoothFollow();
                }
                else if (message.type === 'animateCamera') {
                    map.flyTo({
                        center: [message.center.longitude, message.center.latitude],
                        zoom: message.zoom || 20.1,
                        pitch: message.pitch || 75,
                        bearing: message.heading || 0,
                        duration: message.duration || 1000,
                        essential: true
                    });
                }
                else if (message.type === 'updateFollowing') {
                    isFollowing = message.enabled;
                    if (isFollowing) performSmoothFollow();
                }
                else if (message.type === 'fitToCoordinates') {
                    if (!message.coordinates || message.coordinates.length < 2) return;
                    const bounds = new maplibregl.LngLatBounds();
                    message.coordinates.forEach(c => bounds.extend([c.longitude, c.latitude]));
                    map.fitBounds(bounds, { padding: 80, duration: 800, pitch: 15 });
                }
                else if (message.type === 'updateRoute') {
                    activeRoute = message.route;
                    if (map.getSource('route')) {
                        const coords = (activeRoute || []).map(c => [c.longitude, c.latitude]);
                        map.getSource('route').setData({ 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': coords } });
                    }
                }
                else if (message.type === 'updateDestination') {
                    if (destMarker) destMarker.remove();
                    if (message.location) {
                        const el = document.createElement('div'); el.className = 'marker-destination';
                        destMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                            .setLngLat([message.location.longitude, message.location.latitude])
                            .addTo(map);
                    }
                }
            } catch (e) {
                console.error("WebView Internal Error:", e);
            }
        }

        // --- DIRECT BRIDGE FUNCTIONS (Bypass Event Latency) ---
        window.snapToLocation = (lat, lng, zoom, pitch) => {
            if (!map) return;
            
            // 🔥 LOCK the camera so auto-follow doesn't fight us
            manualOverride = true;
            if (overrideTimeout) clearTimeout(overrideTimeout);
            overrideTimeout = setTimeout(() => { manualOverride = false; }, 3000);

            map.flyTo({
                center: [lng, lat],
                zoom: zoom || 20.1,
                pitch: pitch || 75,
                duration: 1000,
                essential: true
            });
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'location_reached' }));
        };

        window.updateMapFollow = (enabled) => {
            isFollowing = enabled;
            if (isFollowing) performSmoothFollow();
        };

        window.updateUserPos = (lat, lng, isFirst) => {
            userLocation = { latitude: lat, longitude: lng };
            if (userMarker) userMarker.remove();
            const el = document.createElement('div'); el.className = 'marker-user';
            userMarker = new maplibregl.Marker({ element: el, zIndexOffset: 1000 })
                .setLngLat([lng, lat])
                .addTo(map);

            if (isFirst) window.snapToLocation(lat, lng);
            if (isFollowing) performSmoothFollow();
        };

        document.addEventListener('message', handleMessage);
        window.addEventListener('message', handleMessage);
    </script>
</body>
</html>
`;

export const WebViewMap = forwardRef<any, WebViewMapProps>(
    ({ initialRegion, markers, onMarkerPress, onMapPress, route, userLocation, mapType = "standard", selectionMarker, destinationMarker, isAutoFollowing, onMapTouchStart }, ref) => {
        const webViewRef = useRef<WebView>(null);
        const [isReady, setIsReady] = useState(false);
        const hasFollowedFirstLocation = useRef(false);

        useImperativeHandle(ref, () => ({
            animateToRegion: (region: any) => {
                webViewRef.current?.injectJavaScript(`window.snapToLocation(${region.latitude}, ${region.longitude}, 18); true;`);
            },
            animateCamera: (camera: any, options?: any) => {
                webViewRef.current?.injectJavaScript(`window.snapToLocation(${camera.center.latitude}, ${camera.center.longitude}, ${camera.zoom || 20.1}, ${camera.pitch || 75}); true;`);
            },
            fitToCoordinates: (coordinates: any[], options?: any) => {
                webViewRef.current?.injectJavaScript(`handleMessage({ data: JSON.stringify({ type: 'fitToCoordinates', coordinates: ${JSON.stringify(coordinates)} }) }); true;`);
            }
        }));

        const handleMessage = (event: any) => {
            try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'ready') {
                    setIsReady(true);
                    webViewRef.current?.injectJavaScript(`handleMessage({ data: JSON.stringify({ type: 'init', region: ${JSON.stringify(initialRegion)}, userLocation: ${JSON.stringify(userLocation)} }) }); true;`);
                } else if (data.type === 'onMapTouchStart' && onMapTouchStart) {
                    onMapTouchStart();
                } else if (data.type === 'onMarkerPress' && onMarkerPress) {
                    const found = markers.find(m => m.id === data.id);
                    if (found) onMarkerPress(found);
                } else if (data.type === 'onMapPress' && onMapPress) {
                    onMapPress({ latitude: data.latitude, longitude: data.longitude });
                }
            } catch (e) {}
        };

        useEffect(() => {
            if (!isReady || !userLocation) return;
            const isFirst = !hasFollowedFirstLocation.current;
            if (isFirst) hasFollowedFirstLocation.current = true;
            webViewRef.current?.injectJavaScript(`window.updateUserPos(${userLocation.latitude}, ${userLocation.longitude}, ${isFirst}); true;`);
        }, [userLocation?.latitude, userLocation?.longitude, isReady]);

        useEffect(() => {
            if (!isReady) return;
            webViewRef.current?.injectJavaScript(`window.updateMapFollow(${isAutoFollowing}); true;`);
        }, [isAutoFollowing, isReady]);

        useEffect(() => {
            if (!isReady) return;
            webViewRef.current?.injectJavaScript(`handleMessage({ data: JSON.stringify({ type: 'updateMarkers', markers: ${JSON.stringify(markers)} }) }); true;`);
        }, [markers, isReady]);

        useEffect(() => {
            if (!isReady) return;
            webViewRef.current?.injectJavaScript(`handleMessage({ data: JSON.stringify({ type: 'updateRoute', route: ${JSON.stringify(route)} }) }); true;`);
        }, [route, isReady]);

        useEffect(() => {
            if (!isReady) return;
            webViewRef.current?.injectJavaScript(`handleMessage({ data: JSON.stringify({ type: 'updateSelection', location: ${JSON.stringify(selectionMarker)} }) }); true;`);
        }, [selectionMarker, isReady]);

        useEffect(() => {
            if (!isReady) return;
            webViewRef.current?.injectJavaScript(`handleMessage({ data: JSON.stringify({ type: 'updateDestination', location: ${JSON.stringify(destinationMarker)} }) }); true;`);
        }, [destinationMarker, isReady]);

        return (
            <View style={styles.container}>
                <WebView
                    ref={webViewRef}
                    source={{ html: mapHtml }}
                    onMessage={handleMessage}
                    style={styles.webview}
                    scrollEnabled={true}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    startInLoadingState={true}
                    originWhitelist={['*']}
                    scalesPageToFit={false}
                    renderLoading={() => (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                        </View>
                    )}
                />
            </View>
        );
    }
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    webview: { flex: 1, backgroundColor: 'transparent' },
    loadingContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }
});
