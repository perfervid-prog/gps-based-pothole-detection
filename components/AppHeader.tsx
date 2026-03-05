import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";

interface AppHeaderProps {
  onMenuPress: () => void;
  title?: string;
}

export default function AppHeader({ onMenuPress, title = "Pothole Alert" }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <LinearGradient
      colors={[Colors.headerGradientStart, Colors.headerGradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.header,
        { paddingTop: (Platform.OS === "web" ? webTopInset : insets.top) + 8 },
      ]}
    >
      <Pressable
        onPress={onMenuPress}
        style={({ pressed }) => [
          styles.menuButton,
          pressed && styles.menuButtonPressed,
        ]}
        hitSlop={12}
      >
        <Ionicons name="menu" size={26} color={Colors.textLight} />
      </Pressable>

      <Text style={styles.title}>{title}</Text>

      <View style={styles.rightSpacer} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    zIndex: 100,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  menuButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.textLight,
    letterSpacing: 0.4,
  },
  rightSpacer: {
    width: 40,
  },
});
