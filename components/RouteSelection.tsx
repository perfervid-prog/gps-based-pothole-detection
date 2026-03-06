import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Pressable,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

interface RouteSelectionProps {
    onRouteSelect: (source: string, destination: string, fullAddress?: string) => void;
    onBack: () => void;
    isLoading?: boolean;
    history?: string[];
    onDeleteHistoryItem?: (item: string) => void;
    onPickFromMap?: () => void;
}

export default function RouteSelection({
    onRouteSelect,
    onBack,
    isLoading,
    history = [],
    onDeleteHistoryItem,
    onPickFromMap
}: RouteSelectionProps) {
    const [source, setSource] = useState("Current Location");
    const [destination, setDestination] = useState("");

    const handleConfirm = () => {
        if (!destination.trim() || isLoading) return;

        if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onRouteSelect(source, destination, destination);
    };

    const allSuggestions = [
        { id: "1", icon: "time-outline", title: "Ring Road", subtitle: "Lalitpur" },
        { id: "2", icon: "star-outline", title: "Thamel", subtitle: "Kathmandu" },
        { id: "3", icon: "location-outline", title: "Durbar Marg", subtitle: "Kathmandu" },
        { id: "4", icon: "trail-sign-outline", title: "Baneshwor", subtitle: "Kathmandu" },
        { id: "5", icon: "business-outline", title: "Patan Durbar Square", subtitle: "Lalitpur" },
    ];

    const query = destination.trim().toLowerCase();
    const filteredSuggestions = query
        ? allSuggestions.filter(s =>
            s.title.toLowerCase().includes(query) ||
            s.subtitle.toLowerCase().includes(query))
        : allSuggestions;

    const handleSuggestionPress = (title: string, subtitle?: string) => {
        if (isLoading) return;
        setDestination(title);

        if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        // Auto-confirm with full context
        const full = subtitle ? `${title}, ${subtitle}` : title;
        onRouteSelect(source, title, full);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={onBack}>
                    <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                </Pressable>
                <Text style={styles.headerTitle}>Plan your ride</Text>
            </View>

            <View style={styles.inputCard}>
                <View style={styles.inputsWrapper}>
                    <View style={styles.dotsColumn}>
                        <View style={[styles.dot, styles.sourceDot]} />
                        <View style={styles.line} />
                        <View style={[styles.dot, styles.destDot]} />
                    </View>

                    <View style={styles.inputsColumn}>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                value={source}
                                onChangeText={setSource}
                                placeholder="From..."
                                placeholderTextColor={Colors.textSecondary}
                            />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={[styles.input, styles.destInput]}
                                value={destination}
                                onChangeText={setDestination}
                                placeholder="Where to?"
                                placeholderTextColor={Colors.textSecondary}
                                autoFocus
                            />
                            <Pressable
                                onPress={onPickFromMap}
                                style={({ pressed }) => [styles.inlineMapPick, pressed && { opacity: 0.7 }]}
                            >
                                <Ionicons name="map-outline" size={20} color={Colors.primary} />
                            </Pressable>
                        </View>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.suggestions} contentContainerStyle={styles.suggestionsContent} keyboardShouldPersistTaps="handled">
                {history.length > 0 && !destination.trim() && (
                    <View style={styles.historySection}>
                        <Text style={styles.sectionTitle}>Recent Searches</Text>
                        {history.map((item, index) => (
                            <View key={`history-${index}`} style={styles.historyItem}>
                                <Pressable
                                    style={({ pressed }) => [styles.historyContent, pressed && styles.suggestionPressed]}
                                    onPress={() => handleSuggestionPress(item)}
                                >
                                    <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
                                    <View style={styles.historyTextWrapper}>
                                        <Text style={styles.historyTitle} numberOfLines={1}>{item}</Text>
                                    </View>
                                </Pressable>
                                <Pressable
                                    onPress={() => onDeleteHistoryItem?.(item)}
                                    style={({ pressed }) => [styles.removeButton, pressed && { opacity: 0.5 }]}
                                >
                                    <Ionicons name="close-circle-outline" size={20} color={Colors.textSecondary} />
                                </Pressable>
                            </View>
                        ))}
                    </View>
                )}

                <Text style={styles.sectionTitle}>
                    {destination.trim() ? "Search Results" : "Top Destinations"}
                </Text>
                {filteredSuggestions.map((item) => (
                    <Pressable
                        key={item.id}
                        style={({ pressed }) => [
                            styles.suggestionItem,
                            pressed && styles.suggestionPressed,
                        ]}
                        onPress={() => handleSuggestionPress(item.title, item.subtitle)}
                    >
                        <View style={styles.suggestionIcon}>
                            <Ionicons name={item.icon as any} size={20} color={Colors.textSecondary} />
                        </View>
                        <View style={styles.suggestionText}>
                            <Text style={styles.suggestionTitle}>{item.title}</Text>
                            <Text style={styles.suggestionSubtitle}>{item.subtitle}</Text>
                        </View>
                    </Pressable>
                ))}

                {query.length > 0 && (
                    <Pressable
                        style={({ pressed }) => [
                            styles.suggestionItem,
                            pressed && styles.suggestionPressed,
                        ]}
                        onPress={() => handleSuggestionPress(destination)}
                    >
                        <View style={[styles.suggestionIcon, { backgroundColor: Colors.primary + "20" }]}>
                            <Ionicons name="search" size={20} color={Colors.primary} />
                        </View>
                        <View style={styles.suggestionText}>
                            <Text style={[styles.suggestionTitle, { color: Colors.primary }]}>
                                Search for "{destination}"
                            </Text>
                            <Text style={styles.suggestionSubtitle}>Use this destination</Text>
                        </View>
                    </Pressable>
                )}
            </ScrollView>

            {isLoading && (
                <View style={styles.searchingOverlay}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.searchingText}>Finding the best road path...</Text>
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.footer}
            >
                <Pressable
                    onPress={handleConfirm}
                    disabled={!destination.trim() || isLoading}
                    style={({ pressed }) => [
                        styles.confirmButton,
                        (!destination.trim() || isLoading) && styles.confirmButtonDisabled,
                        pressed && destination.trim() && !isLoading && styles.confirmButtonPressed,
                    ]}
                >
                    <Text style={[
                        styles.confirmButtonText,
                        !destination.trim() && styles.confirmButtonTextDisabled
                    ]}>
                        {isLoading ? "Searching..." : "Find Path"}
                    </Text>
                    {!isLoading && <Ionicons name="search" size={18} color={destination.trim() ? Colors.textLight : Colors.textSecondary} />}
                    {isLoading && <ActivityIndicator size="small" color={Colors.textLight} />}
                </Pressable>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        flexDirection: "row",
        alignItems: "center",
    },
    backButton: {
        padding: 8,
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "700" as const,
        color: Colors.textPrimary,
        fontFamily: "Inter_700Bold",
    },
    inputCard: {
        backgroundColor: Colors.surface,
        marginHorizontal: 20,
        borderRadius: 20,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
    },
    inputsWrapper: {
        flexDirection: "row",
        alignItems: "stretch",
    },
    dotsColumn: {
        width: 20,
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 18,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    sourceDot: {
        backgroundColor: Colors.primary,
    },
    destDot: {
        backgroundColor: Colors.accent,
    },
    line: {
        flex: 1,
        width: 2,
        backgroundColor: Colors.divider,
        marginVertical: 4,
    },
    inputsColumn: {
        flex: 1,
        marginLeft: 12,
    },
    inputWrapper: {
        height: 44,
        justifyContent: "center",
    },
    input: {
        fontSize: 16,
        color: Colors.textPrimary,
        fontFamily: "Inter_500Medium",
    },
    destInput: {
        fontWeight: "700" as const,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.divider,
    },
    suggestions: {
        flex: 1,
        marginTop: 20,
    },
    suggestionsContent: {
        paddingHorizontal: 24,
        paddingBottom: 100,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "700" as const,
        color: Colors.textSecondary,
        textTransform: "uppercase",
        marginBottom: 16,
        letterSpacing: 1,
    },
    suggestionItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    suggestionPressed: {
        opacity: 0.6,
    },
    suggestionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.inputBackground,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
    },
    suggestionText: {
        flex: 1,
    },
    suggestionTitle: {
        fontSize: 16,
        fontWeight: "600" as const,
        color: Colors.textPrimary,
        fontFamily: "Inter_600SemiBold",
    },
    suggestionSubtitle: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 2,
        fontFamily: "Inter_400Regular",
    },
    footer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        backgroundColor: Colors.background,
    },
    disabledButton: {
        backgroundColor: Colors.textSecondary,
        opacity: 0.6,
    },
    searchingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(255,255,255,0.8)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
        gap: 12,
    },
    searchingText: {
        fontSize: 16,
        color: Colors.primary,
        fontWeight: "600",
    },
    confirmButton: {
        backgroundColor: Colors.primary,
        borderRadius: 16,
        paddingVertical: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    confirmButtonPressed: {
        backgroundColor: Colors.primaryDark,
        transform: [{ scale: 0.98 }],
    },
    confirmButtonDisabled: {
        backgroundColor: Colors.inputBackground,
        elevation: 0,
        shadowOpacity: 0,
    },
    confirmButtonText: {
        fontSize: 17,
        fontWeight: "700" as const,
        color: Colors.textLight,
        fontFamily: "Inter_700Bold",
    },
    confirmButtonTextDisabled: {
        color: Colors.textSecondary,
    },
    noResults: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: "center",
        marginTop: 20,
        fontFamily: "Inter_400Regular",
    },
    historySection: {
        marginBottom: 24,
    },
    historyItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    historyContent: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    historyTextWrapper: {
        flex: 1,
    },
    historyTitle: {
        fontSize: 16,
        color: Colors.textPrimary,
        fontWeight: "500",
    },
    removeButton: {
        padding: 8,
    },
    inputWrapper: {
        height: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: Colors.textPrimary,
        fontFamily: "Inter_500Medium",
    },
    inlineMapPick: {
        padding: 8,
        marginLeft: 8,
        backgroundColor: Colors.primary + "15",
        borderRadius: 10,
    },
});
