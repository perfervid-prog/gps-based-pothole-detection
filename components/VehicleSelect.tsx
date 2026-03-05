import React, { useState } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ScrollView,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import Colors from "@/constants/colors";
import { VehicleType } from "@/lib/onboarding";

interface VehicleOption {
    type: VehicleType;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    description: string;
}

const vehicles: VehicleOption[] = [
    {
        type: "car",
        label: "Car",
        icon: "car-outline",
        description: "Sedan, SUV, Hatchback",
    },
    {
        type: "motorcycle",
        label: "Motorcycle",
        icon: "bicycle-outline",
        description: "Bike, Scooter, Moped",
    },
    {
        type: "bicycle",
        label: "Bicycle",
        icon: "fitness-outline",
        description: "Pedal cycle, E-bike",
    },
    {
        type: "bus",
        label: "Bus",
        icon: "bus-outline",
        description: "Public transit, Minibus",
    },
    {
        type: "truck",
        label: "Truck",
        icon: "cube-outline",
        description: "Pickup, Lorry, Van",
    },
    {
        type: "walking",
        label: "Walking",
        icon: "walk-outline",
        description: "Pedestrian, Runner",
    },
];

interface VehicleSelectProps {
    onSelect: (type: VehicleType) => void;
}

export default function VehicleSelect({ onSelect }: VehicleSelectProps) {
    const [selected, setSelected] = useState<VehicleType | null>(null);

    const handleSelect = (type: VehicleType) => {
        if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        setSelected(type);
    };

    const handleContinue = () => {
        if (!selected) return;
        if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onSelect(selected);
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            <View style={styles.header}>
                <Text style={styles.emoji}>🚗</Text>
                <Text style={styles.title}>Choose Your Vehicle</Text>
                <Text style={styles.subtitle}>
                    Select how you usually travel. This helps us personalize pothole alerts for you.
                </Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator={false}
            >
                {vehicles.map((vehicle) => {
                    const isSelected = selected === vehicle.type;
                    return (
                        <Pressable
                            key={vehicle.type}
                            onPress={() => handleSelect(vehicle.type)}
                            style={({ pressed }) => [
                                styles.card,
                                isSelected && styles.cardSelected,
                                pressed && styles.cardPressed,
                            ]}
                        >
                            <View
                                style={[
                                    styles.iconContainer,
                                    isSelected && styles.iconContainerSelected,
                                ]}
                            >
                                <Ionicons
                                    name={vehicle.icon}
                                    size={28}
                                    color={isSelected ? Colors.textLight : Colors.primary}
                                />
                            </View>
                            <Text
                                style={[
                                    styles.cardLabel,
                                    isSelected && styles.cardLabelSelected,
                                ]}
                            >
                                {vehicle.label}
                            </Text>
                            <Text style={styles.cardDescription}>{vehicle.description}</Text>

                            {isSelected && (
                                <View style={styles.checkBadge}>
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={22}
                                        color={Colors.primary}
                                    />
                                </View>
                            )}
                        </Pressable>
                    );
                })}
            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    onPress={handleContinue}
                    disabled={!selected}
                    style={({ pressed }) => [
                        styles.continueButton,
                        !selected && styles.continueButtonDisabled,
                        pressed && selected && styles.continueButtonPressed,
                    ]}
                >
                    <Text
                        style={[
                            styles.continueButtonText,
                            !selected && styles.continueButtonTextDisabled,
                        ]}
                    >
                        Continue
                    </Text>
                    <Ionicons
                        name="arrow-forward"
                        size={18}
                        color={selected ? Colors.textLight : Colors.textSecondary}
                    />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        paddingTop: 80,
        paddingHorizontal: 24,
        paddingBottom: 20,
        alignItems: "center",
    },
    emoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    title: {
        fontSize: 26,
        fontWeight: "700" as const,
        color: Colors.textPrimary,
        textAlign: "center",
        marginBottom: 8,
        fontFamily: "Inter_700Bold",
    },
    subtitle: {
        fontSize: 15,
        fontWeight: "400" as const,
        color: Colors.textSecondary,
        textAlign: "center",
        lineHeight: 22,
        fontFamily: "Inter_400Regular",
    },
    scrollView: {
        flex: 1,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 16,
        gap: 12,
        justifyContent: "center",
        paddingBottom: 24,
    },
    card: {
        width: "45%",
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 20,
        alignItems: "center",
        borderWidth: 2,
        borderColor: "transparent",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        position: "relative",
    },
    cardSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.surfaceTint,
        shadowOpacity: 0.12,
        elevation: 4,
    },
    cardPressed: {
        opacity: 0.8,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.surfaceTint,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    iconContainerSelected: {
        backgroundColor: Colors.primary,
    },
    cardLabel: {
        fontSize: 16,
        fontWeight: "600" as const,
        color: Colors.textPrimary,
        marginBottom: 4,
        fontFamily: "Inter_600SemiBold",
    },
    cardLabelSelected: {
        color: Colors.primary,
    },
    cardDescription: {
        fontSize: 12,
        fontWeight: "400" as const,
        color: Colors.textSecondary,
        textAlign: "center",
        fontFamily: "Inter_400Regular",
    },
    checkBadge: {
        position: "absolute",
        top: 10,
        right: 10,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 50,
        paddingTop: 12,
    },
    continueButton: {
        backgroundColor: Colors.primary,
        borderRadius: 16,
        paddingVertical: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    continueButtonDisabled: {
        backgroundColor: Colors.inputBackground,
        shadowOpacity: 0,
        elevation: 0,
    },
    continueButtonPressed: {
        backgroundColor: Colors.primaryDark,
    },
    continueButtonText: {
        fontSize: 17,
        fontWeight: "700" as const,
        color: Colors.textLight,
        fontFamily: "Inter_700Bold",
    },
    continueButtonTextDisabled: {
        color: Colors.textSecondary,
    },
});
