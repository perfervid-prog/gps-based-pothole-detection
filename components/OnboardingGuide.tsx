import React, { useState, useRef } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Dimensions,
    FlatList,
    Animated,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");

interface OnboardingSlide {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    color: string;
}

const slides: OnboardingSlide[] = [
    {
        id: "1",
        icon: "warning-outline",
        title: "Spot Potholes",
        description:
            "Report potholes you encounter on the road with just a single tap. Help make roads safer for everyone.",
        color: "#D4443B",
    },
    {
        id: "2",
        icon: "map-outline",
        title: "Live Map",
        description:
            "See all reported potholes on an interactive map. Plan your routes to avoid damaged roads.",
        color: "#1A6B7A",
    },
    {
        id: "3",
        icon: "people-outline",
        title: "Community Driven",
        description:
            "Join a community of road users working together to improve road safety in your area.",
        color: "#2A8D9E",
    },
];

interface OnboardingGuideProps {
    onComplete: () => void;
}

export default function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    const handleNext = () => {
        if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        if (currentIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
            setCurrentIndex(currentIndex + 1);
        } else {
            onComplete();
        }
    };

    const handleSkip = () => {
        if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onComplete();
    };

    const renderSlide = ({ item }: { item: OnboardingSlide }) => (
        <View style={[styles.slide, { width }]}>
            <View style={[styles.iconCircle, { backgroundColor: item.color + "15" }]}>
                <View style={[styles.iconInner, { backgroundColor: item.color + "25" }]}>
                    <Ionicons name={item.icon} size={64} color={item.color} />
                </View>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
        </View>
    );

    const onViewableItemsChanged = useRef(
        ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
            if (viewableItems[0]?.index != null) {
                setCurrentIndex(viewableItems[0].index);
            }
        }
    ).current;

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            <Pressable style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip</Text>
            </Pressable>

            <FlatList
                ref={flatListRef}
                data={slides}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
            />

            <View style={styles.footer}>
                <View style={styles.pagination}>
                    {slides.map((_, index) => {
                        const inputRange = [
                            (index - 1) * width,
                            index * width,
                            (index + 1) * width,
                        ];

                        const dotWidth = scrollX.interpolate({
                            inputRange,
                            outputRange: [8, 24, 8],
                            extrapolate: "clamp",
                        });

                        const dotOpacity = scrollX.interpolate({
                            inputRange,
                            outputRange: [0.3, 1, 0.3],
                            extrapolate: "clamp",
                        });

                        return (
                            <Animated.View
                                key={index}
                                style={[
                                    styles.dot,
                                    {
                                        width: dotWidth,
                                        opacity: dotOpacity,
                                        backgroundColor: Colors.primary,
                                    },
                                ]}
                            />
                        );
                    })}
                </View>

                <Pressable
                    onPress={handleNext}
                    style={({ pressed }) => [
                        styles.nextButton,
                        pressed && styles.nextButtonPressed,
                    ]}
                >
                    {currentIndex === slides.length - 1 ? (
                        <Text style={styles.nextButtonText}>Get Started</Text>
                    ) : (
                        <View style={styles.nextButtonContent}>
                            <Text style={styles.nextButtonText}>Next</Text>
                            <Ionicons name="arrow-forward" size={18} color={Colors.textLight} />
                        </View>
                    )}
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
    skipButton: {
        position: "absolute",
        top: 60,
        right: 24,
        zIndex: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    skipText: {
        fontSize: 16,
        fontWeight: "600" as const,
        color: Colors.textSecondary,
    },
    slide: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 40,
        paddingBottom: 120,
    },
    iconCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 40,
    },
    iconInner: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontSize: 28,
        fontWeight: "700" as const,
        color: Colors.textPrimary,
        textAlign: "center",
        marginBottom: 16,
        fontFamily: "Inter_700Bold",
    },
    description: {
        fontSize: 16,
        fontWeight: "400" as const,
        color: Colors.textSecondary,
        textAlign: "center",
        lineHeight: 24,
        fontFamily: "Inter_400Regular",
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 50,
        gap: 24,
    },
    pagination: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    nextButton: {
        backgroundColor: Colors.primary,
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    nextButtonPressed: {
        backgroundColor: Colors.primaryDark,
    },
    nextButtonText: {
        fontSize: 17,
        fontWeight: "700" as const,
        color: Colors.textLight,
        fontFamily: "Inter_700Bold",
    },
    nextButtonContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
});
