import React from "react";
import { View, Text, StyleSheet, Pressable, Platform, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");

interface RideStartProps {
    onStart: () => void;
    onBack: () => void;
    vehicleType: string;
}

export default function RideStart({ onStart, onBack, vehicleType }: RideStartProps) {
    const handleStart = () => {
        if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onStart();
    };

    const getVehicleLabel = (type: string) => {
        const labels: Record<string, string> = {
            car: "Car",
            motorcycle: "Motorcycle",
            bicycle: "Bicycle",
            bus: "Bus",
            truck: "Truck",
            walking: "Walking",
        };
        return labels[type] || "Vehicle";
    };

    const getVehicleEmoji = (type: string) => {
        const emojis: Record<string, string> = {
            car: "🚗",
            motorcycle: "🏍️",
            bicycle: "🚲",
            bus: "🚌",
            truck: "🚛",
            walking: "🚶",
        };
        return emojis[type] || "🚀";
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            <Pressable style={styles.backButton} onPress={onBack}>
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </Pressable>

            <View style={styles.content}>
                <View style={styles.illustrationContainer}>
                    <Text style={styles.emoji}>{getVehicleEmoji(vehicleType)}</Text>
                    <View style={styles.pulseContainer}>
                        <View style={styles.pulse} />
                    </View>
                </View>

                <Text style={styles.title}>Ready for your ride?</Text>
                <Text style={styles.subtitle}>
                    You've selected <Text style={styles.bold}>{getVehicleLabel(vehicleType)}</Text> as your transport. Let's find a safe path for you.
                </Text>

                <Pressable
                    onPress={handleStart}
                    style={({ pressed }) => [
                        styles.rideButton,
                        pressed && styles.rideButtonPressed,
                    ]}
                >
                    <Text style={styles.rideButtonText}>Take a ride</Text>
                    <Ionicons name="navigate" size={20} color={Colors.textLight} />
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
    backButton: {
        position: "absolute",
        top: 60,
        left: 24,
        zIndex: 10,
        padding: 8,
    },
    content: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 40,
    },
    illustrationContainer: {
        width: 200,
        height: 200,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 40,
        position: "relative",
    },
    emoji: {
        fontSize: 80,
        zIndex: 2,
    },
    pulseContainer: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
    },
    pulse: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: Colors.primary + "20",
        borderWidth: 2,
        borderColor: Colors.primary + "40",
    },
    title: {
        fontSize: 28,
        fontWeight: "700" as const,
        color: Colors.textPrimary,
        textAlign: "center",
        marginBottom: 16,
        fontFamily: "Inter_700Bold",
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        textAlign: "center",
        lineHeight: 24,
        marginBottom: 48,
        fontFamily: "Inter_400Regular",
    },
    bold: {
        fontWeight: "700" as const,
        color: Colors.primary,
    },
    rideButton: {
        width: "100%",
        backgroundColor: Colors.primary,
        borderRadius: 16,
        paddingVertical: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    rideButtonPressed: {
        backgroundColor: Colors.primaryDark,
        transform: [{ scale: 0.98 }],
    },
    rideButtonText: {
        fontSize: 18,
        fontWeight: "700" as const,
        color: Colors.textLight,
        fontFamily: "Inter_700Bold",
    },
});
