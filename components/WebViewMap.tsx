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
}

const mapHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        body { padding: 0; margin: 0; }
        html, body, #map { height: 100vh; width: 100vw; background: #e5e5e5; }
        .leaflet-control-zoom { display: none; }
        .leaflet-control-attribution { display: none; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        var map = L.map('map', { 
            zoomControl: false, 
            attributionControl: false 
        });
        
        var currentTileLayer = null;
        var markers = {};
        var userMarker = null;
        var selectionMarker = null;
        var routeLine = null;

        function updateMapType(type) {
            if (currentTileLayer) {
                map.removeLayer(currentTileLayer);
            }
            
            var url = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'; // default
            if (type === 'satellite' || type === 'hybrid') {
                url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
            }
            
            currentTileLayer = L.tileLayer(url, { maxZoom: 19 }).addTo(map);
        }

        function handleMessage(event) {
            try {
                var message = JSON.parse(event.data);
                
                if (message.type === 'init') {
                    var bounds = [
                        [message.region.latitude - message.region.latitudeDelta/2, message.region.longitude - message.region.longitudeDelta/2],
                        [message.region.latitude + message.region.latitudeDelta/2, message.region.longitude + message.region.longitudeDelta/2]
                    ];
                    map.fitBounds(bounds);
                    updateMapType(message.mapType);
                } 
                else if (message.type === 'updateMapType') {
                    updateMapType(message.mapType);
                }
                else if (message.type === 'updateMarkers') {
                    // Clear old markers
                    for (var id in markers) {
                        map.removeLayer(markers[id]);
                    }
                    markers = {};
                    
                    // Add new markers
                    var potholeIcon = L.divIcon({
                        className: 'custom-div-icon',
                        html: "<div style='background-color:#D4443B;width:12px;height:12px;border-radius:6px;border:2px solid white;'></div>",
                        iconSize: [12, 12],
                        iconAnchor: [6, 6]
                    });

                    message.markers.forEach(function(m) {
                        var marker = L.marker([m.latitude, m.longitude], {icon: potholeIcon}).addTo(map);
                        marker.on('click', function() {
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'onMarkerPress',
                                id: m.id,
                                latitude: m.latitude,
                                longitude: m.longitude
                            }));
                        });
                        markers[m.id] = marker;
                    });
                }
                else if (message.type === 'updateUserLocation') {
                    if (userMarker) map.removeLayer(userMarker);
                    if (message.location) {
                        var userIcon = L.divIcon({
                            className: 'custom-div-icon',
                            html: "<div style='background-color:#14A3B8;width:16px;height:16px;border-radius:8px;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3);'></div>",
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        });
                        userMarker = L.marker([message.location.latitude, message.location.longitude], {icon: userIcon, zIndexOffset: 1000}).addTo(map);
                    }
                }
                else if (message.type === 'updateSelection') {
                    if (selectionMarker) map.removeLayer(selectionMarker);
                    if (message.location) {
                        var selIcon = L.divIcon({
                            className: 'custom-div-icon',
                            html: "<div style='background-color:#F26B22;width:16px;height:16px;border-radius:8px;border:2px solid white;'></div>",
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        });
                        selectionMarker = L.marker([message.location.latitude, message.location.longitude], {icon: selIcon}).addTo(map);
                    }
                }
                else if (message.type === 'updateRoute') {
                    if (routeLine) map.removeLayer(routeLine);
                    if (message.route && message.route.length > 0) {
                        var latlngs = message.route.map(function(c) { return [c.latitude, c.longitude]; });
                        routeLine = L.polyline(latlngs, {color: '#F26B22', weight: 6, opacity: 0.8}).addTo(map);
                    }
                }
                else if (message.type === 'animateToRegion') {
                    var bounds = [
                        [message.region.latitude - message.region.latitudeDelta/2, message.region.longitude - message.region.longitudeDelta/2],
                        [message.region.latitude + message.region.latitudeDelta/2, message.region.longitude + message.region.longitudeDelta/2]
                    ];
                    map.flyToBounds(bounds, { duration: 1 });
                }
            } catch (e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.toString() }));
            }
        }

        document.addEventListener('message', handleMessage);
        window.addEventListener('message', handleMessage); // for iOS

        map.on('click', function(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'onMapPress',
                latitude: e.latlng.lat,
                longitude: e.latlng.lng
            }));
        });
        
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    </script>
</body>
</html>
`;

export const WebViewMap = forwardRef<any, WebViewMapProps>(
    ({ initialRegion, markers, onMarkerPress, onMapPress, route, userLocation, mapType = "standard", selectionMarker }, ref) => {
        const webViewRef = useRef<WebView>(null);
        const [isReady, setIsReady] = useState(false);

        useImperativeHandle(ref, () => ({
            animateToRegion: (region: any) => {
                if (!isReady || !webViewRef.current) return;
                webViewRef.current.injectJavaScript(`
                    handleMessage({ data: JSON.stringify({ type: 'animateToRegion', region: ${JSON.stringify(region)} }) });
                    true;
                `);
            }
        }));

        const handleMessage = (event: any) => {
            try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'ready') {
                    setIsReady(true);

                    // Initialize Map State
                    webViewRef.current?.injectJavaScript(`
                        handleMessage({ data: JSON.stringify({ 
                            type: 'init', 
                            region: ${JSON.stringify(initialRegion)},
                            mapType: '${mapType}'
                        }) });
                        true;
                    `);
                } else if (data.type === 'onMapPress' && onMapPress) {
                    onMapPress({ latitude: data.latitude, longitude: data.longitude });
                } else if (data.type === 'onMarkerPress' && onMarkerPress) {
                    onMarkerPress({ id: data.id, latitude: data.latitude, longitude: data.longitude });
                } else if (data.type === 'error') {
                    console.error("Leaflet Error:", data.message);
                }
            } catch (e) {
                // Parse error
            }
        };

        // Sync state to Webview
        useEffect(() => {
            if (!isReady || !webViewRef.current) return;
            webViewRef.current.injectJavaScript(`
                handleMessage({ data: JSON.stringify({ type: 'updateMarkers', markers: ${JSON.stringify(markers)} }) });
                true;
            `);
        }, [markers, isReady]);

        useEffect(() => {
            if (!isReady || !webViewRef.current) return;
            webViewRef.current.injectJavaScript(`
                handleMessage({ data: JSON.stringify({ type: 'updateUserLocation', location: ${JSON.stringify(userLocation)} }) });
                true;
            `);
        }, [userLocation, isReady]);

        useEffect(() => {
            if (!isReady || !webViewRef.current) return;
            webViewRef.current.injectJavaScript(`
                handleMessage({ data: JSON.stringify({ type: 'updateSelection', location: ${JSON.stringify(selectionMarker)} }) });
                true;
            `);
        }, [selectionMarker, isReady]);

        useEffect(() => {
            if (!isReady || !webViewRef.current) return;
            webViewRef.current.injectJavaScript(`
                handleMessage({ data: JSON.stringify({ type: 'updateRoute', route: ${JSON.stringify(route)} }) });
                true;
            `);
        }, [route, isReady]);

        useEffect(() => {
            if (!isReady || !webViewRef.current) return;
            webViewRef.current.injectJavaScript(`
                handleMessage({ data: JSON.stringify({ type: 'updateMapType', mapType: '${mapType}' }) });
                true;
            `);
        }, [mapType, isReady]);

        return (
            <View style={styles.container}>
                <WebView
                    ref={webViewRef}
                    source={{ html: mapHtml }}
                    onMessage={handleMessage}
                    style={styles.webview}
                    scrollEnabled={false}
                    bounces={false}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    startInLoadingState={true}
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
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#e5e5e5'
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent'
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e5e5e5',
        zIndex: 10
    }
});
