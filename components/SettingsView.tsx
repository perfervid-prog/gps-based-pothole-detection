import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePotholes } from "@/contexts/PotholeContext";
import { Pothole } from "@/lib/storage";
import { resetOnboarding, getAlertSettings, setAlertSetting } from "@/lib/onboarding";
import { DevSettings, Switch } from "react-native";
import { useEffect } from "react";

interface SettingsViewProps {
  onClose: () => void;
}

function SettingRow({
  icon,
  label,
  subtitle,
  onPress,
  destructive,
  showChevron,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.settingRow,
        pressed && onPress && styles.settingRowPressed,
      ]}
    >
      <View style={styles.settingIcon}>{icon}</View>
      <View style={styles.settingContent}>
        <Text
          style={[
            styles.settingLabel,
            destructive && { color: Colors.accent },
          ]}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {(onPress || showChevron) ? (
        <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
      ) : null}
    </Pressable>
  );
}

function PotholeListItem({
  pothole,
  index,
  isLast,
  onDelete,
}: {
  pothole: Pothole;
  index: number;
  isLast: boolean;
  onDelete: (id: string) => void;
}) {
  const handleDelete = () => {
    Alert.alert(
      "Delete Pothole",
      `Remove pothole at ${pothole.latitude.toFixed(5)}, ${pothole.longitude.toFixed(5)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            onDelete(pothole.id);
          },
        },
      ]
    );
  };

  return (
    <View>
      <View style={styles.potholeItem}>
        <View style={styles.potholeIndex}>
          <Text style={styles.potholeIndexText}>{index + 1}</Text>
        </View>
        <View style={styles.potholeCoords}>
          <View style={styles.coordRow}>
            <Text style={styles.coordLabel}>Lat</Text>
            <Text style={styles.coordValue}>{pothole.latitude.toFixed(6)}</Text>
          </View>
          <View style={styles.coordRow}>
            <Text style={styles.coordLabel}>Lng</Text>
            <Text style={styles.coordValue}>{pothole.longitude.toFixed(6)}</Text>
          </View>
        </View>
        <Pressable
          onPress={handleDelete}
          hitSlop={8}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="trash-outline" size={20} color={Colors.accent} />
        </Pressable>
      </View>
      {!isLast ? <View style={styles.potholeItemSeparator} /> : null}
    </View>
  );
}

export default function SettingsView({ onClose }: SettingsViewProps) {
  const insets = useSafeAreaInsets();
  const { potholes, clearAll, removePothole } = usePotholes();
  const webBottom = Platform.OS === "web" ? 34 : 0;
  const [showPotholeList, setShowPotholeList] = useState(false);
  const [alertSettings, setAlertSettings] = useState({ enabled: true, sound: true, flash: true });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const settings = await getAlertSettings();
    setAlertSettings(settings);
  };

  const handleToggleAlert = async (key: keyof typeof alertSettings) => {
    const newValue = !alertSettings[key];
    await setAlertSetting(key, newValue);
    setAlertSettings(prev => ({ ...prev, [key]: newValue }));

    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
  };

  const handleClearAll = () => {
    if (potholes.length === 0) {
      Alert.alert("No Data", "There are no potholes to delete.");
      return;
    }
    Alert.alert(
      "Clear All Potholes",
      `Are you sure you want to delete all ${potholes.length} pothole(s)? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            await clearAll();
            setShowPotholeList(false);
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
          },
        },
      ]
    );
  };

  const handleDeletePothole = async (id: string) => {
    await removePothole(id);
    if (potholes.length <= 1) {
      setShowPotholeList(false);
    }
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      "Reset Onboarding",
      "This will clear your vehicle preference and show the app guide again. The app will reload to apply changes.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset & Reload",
          style: "destructive",
          onPress: async () => {
            await resetOnboarding();
            if (Platform.OS === "web") {
              window.location.reload();
            } else {
              // DevSettings.reload() only works in development
              try {
                DevSettings.reload();
              } catch (e) {
                Alert.alert("Success", "Onboarding reset. Please restart the app manually.");
              }
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textLight} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + webBottom + 24 }}
      >
        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.section}>
          <SettingRow
            icon={<MaterialIcons name="pin-drop" size={22} color={Colors.primary} />}
            label="Total Potholes"
            subtitle={`${potholes.length} reported`}
            onPress={() => setShowPotholeList(!showPotholeList)}
            showChevron
          />

          {showPotholeList ? (
            <View style={styles.potholeListContainer}>
              {potholes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="location-outline" size={32} color={Colors.textSecondary} />
                  <Text style={styles.emptyText}>No potholes reported yet</Text>
                </View>
              ) : (
                potholes.map((p, i) => (
                  <PotholeListItem
                    key={p.id}
                    pothole={p}
                    index={i}
                    isLast={i === potholes.length - 1}
                    onDelete={handleDeletePothole}
                  />
                ))
              )}
            </View>
          ) : null}

          <View style={styles.separator} />
          <SettingRow
            icon={<Feather name="trash-2" size={22} color={Colors.accent} />}
            label="Clear All Data"
            subtitle="Remove all reported potholes"
            onPress={handleClearAll}
            destructive
          />
          <View style={styles.separator} />
          <SettingRow
            icon={<Ionicons name="refresh-circle-outline" size={22} color={Colors.accent} />}
            label="Reset Onboarding"
            subtitle="Show app guide & vehicle setup again"
            onPress={handleResetOnboarding}
            destructive
          />
        </View>

        <Text style={styles.sectionTitle}>Alerts</Text>
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Proximity Alerts</Text>
              <Text style={styles.settingSubtitle}>Warn when approaching a pothole</Text>
            </View>
            <Switch
              value={alertSettings.enabled}
              onValueChange={() => handleToggleAlert("enabled")}
              trackColor={{ false: "#D1D1D1", true: Colors.primary }}
              thumbColor={Platform.OS === "ios" ? undefined : "#FFFFFF"}
            />
          </View>

          {alertSettings.enabled && (
            <>
              <View style={styles.separator} />
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <Ionicons name="volume-medium-outline" size={22} color={Colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Sound Effects</Text>
                  <Text style={styles.settingSubtitle}>Play alert sound for warnings</Text>
                </View>
                <Switch
                  value={alertSettings.sound}
                  onValueChange={() => handleToggleAlert("sound")}
                  trackColor={{ false: "#D1D1D1", true: Colors.primary }}
                />
              </View>

              <View style={styles.separator} />
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <Ionicons name="flash-outline" size={22} color={Colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Visual Flash</Text>
                  <Text style={styles.settingSubtitle}>Flash screen for warnings</Text>
                </View>
                <Switch
                  value={alertSettings.flash}
                  onValueChange={() => handleToggleAlert("flash")}
                  trackColor={{ false: "#D1D1D1", true: Colors.primary }}
                />
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.section}>
          <SettingRow
            icon={<Ionicons name="information-circle-outline" size={22} color={Colors.primary} />}
            label="Version"
            subtitle="1.0.0"
          />
          <View style={styles.separator} />
          <SettingRow
            icon={<Ionicons name="shield-checkmark-outline" size={22} color={Colors.primary} />}
            label="Location Data"
            subtitle="Stored locally on device"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.textLight,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 16,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  settingRowPressed: {
    backgroundColor: Colors.surfaceTint,
  },
  settingIcon: {
    width: 32,
    alignItems: "center",
  },
  settingContent: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: Colors.textPrimary,
  },
  settingSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: 62,
  },
  potholeListContainer: {
    backgroundColor: Colors.background,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  potholeItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  potholeIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  potholeIndexText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.textLight,
  },
  potholeCoords: {
    flex: 1,
    gap: 2,
  },
  coordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  coordLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    width: 28,
  },
  coordValue: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.textPrimary,
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  potholeItemSeparator: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: 52,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
