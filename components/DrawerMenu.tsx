import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
  BackHandler,
} from "react-native";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useEffect } from "react";
import Colors from "@/constants/colors";
import { usePotholes } from "@/contexts/PotholeContext";

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: "home" | "settings" | "update") => void;
  onExit: () => void;
  onNavigateToAdminLogin: () => void;
}

interface MenuItem {
  key: "home" | "settings" | "update" | "exit";
  label: string;
  icon: React.ReactNode;
}

const menuItems: MenuItem[] = [
  {
    key: "home",
    label: "Home",
    icon: <Ionicons name="home-outline" size={22} color={Colors.textPrimary} />,
  },
  {
    key: "settings",
    label: "Setting",
    icon: <Ionicons name="settings-outline" size={22} color={Colors.textPrimary} />,
  },
  {
    key: "update",
    label: "Update",
    icon: <MaterialIcons name="update" size={22} color={Colors.textPrimary} />,
  },
  {
    key: "exit",
    label: "Exit",
    icon: <Feather name="log-out" size={22} color={Colors.accent} />,
  },
];

function DrawerMenuItem({
  item,
  onPress,
}: {
  item: MenuItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.menuItemPressed,
      ]}
    >
      <View style={styles.menuItemIcon}>{item.icon}</View>
      <Text
        style={[
          styles.menuItemText,
          item.key === "exit" && { color: Colors.accent },
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

export default function DrawerMenu({
  visible,
  onClose,
  onNavigate,
  onExit,
  onNavigateToAdminLogin,
}: DrawerMenuProps) {
  const { isAdmin, logoutAdmin } = usePotholes();
  const insets = useSafeAreaInsets();
  const slideAnim = useSharedValue(-300);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      slideAnim.value = withTiming(0, { duration: 280 });
      overlayOpacity.value = withTiming(1, { duration: 280 });
    } else {
      slideAnim.value = withTiming(-300, { duration: 220 });
      overlayOpacity.value = withTiming(0, { duration: 220 });
    }
  }, [visible]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideAnim.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const handlePress = (key: MenuItem["key"]) => {
    onClose();
    if (key === "exit") {
      onExit();
    } else {
      onNavigate(key);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            drawerStyle,
            { paddingTop: insets.top },
          ]}
        >
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Pothole Alert</Text>
          </View>

          <View style={styles.divider} />

          {menuItems.map((item) => (
            <DrawerMenuItem
              key={item.key}
              item={item}
              onPress={() => handlePress(item.key)}
            />
          ))}

          <View style={styles.adminSection}>
            <View style={styles.divider} />
            {isAdmin ? (
              <Pressable
                onPress={() => {
                  logoutAdmin();
                  onClose();
                }}
                style={styles.adminToggle}
              >
                <View style={styles.menuItemIcon}>
                  <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
                </View>
                <Text style={[styles.menuItemText, { fontSize: 14, color: Colors.primary }]}>
                  Logout Admin
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onNavigateToAdminLogin}
                style={styles.adminToggle}
              >
                <View style={styles.menuItemIcon}>
                  <Ionicons name="shield-outline" size={20} color={Colors.textSecondary} />
                </View>
                <Text style={[styles.menuItemText, { fontSize: 14 }]}>
                  Admin Login
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  drawer: {
    width: 280,
    backgroundColor: Colors.surface,
    height: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
  },
  drawerHeader: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: Colors.primary,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.textLight,
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  menuItemPressed: {
    backgroundColor: Colors.surfaceTint,
  },
  menuItemIcon: {
    width: 28,
    alignItems: "center",
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: Colors.textPrimary,
  },
  adminSection: {
    marginTop: 'auto',
    marginBottom: 20,
  },
  adminToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 16,
    opacity: 0.8,
  }
});
