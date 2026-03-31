import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  TextInput,
  ActivityIndicator,
  Switch,
  DevSettings
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePotholes } from "@/contexts/PotholeContext";
import { Pothole, PROJECT_ID, getSensorStatus } from "@/lib/storage";
import { resetOnboarding, getAlertSettings, setAlertSetting } from "@/lib/onboarding";

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
      `Remove pothole at ${parseFloat(pothole.latitude).toFixed(5)}, ${parseFloat(pothole.longitude).toFixed(5)}?`,
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
            <Text style={styles.coordValue}>{parseFloat(pothole.latitude).toFixed(6)}</Text>
          </View>
          <View style={styles.coordRow}>
            <Text style={styles.coordLabel}>Lng</Text>
            <Text style={styles.coordValue}>{parseFloat(pothole.longitude).toFixed(6)}</Text>
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
  const { potholes, clearAll, removePothole, isAdmin, loginAdmin } = usePotholes();
  const [showPotholeList, setShowPotholeList] = useState(false);
  const [alertSettings, setAlertSettings] = useState({ enabled: true, sound: true, flash: true });
  
  // Hardware Sync State
  const [hardwareStatus, setHardwareStatus] = useState<"searching" | "found" | "error" | "synced" | "online">("searching");
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [ssid, setSsid] = useState("HAWA 4.0");
  const [password, setPassword] = useState("10000011");
  const [isSyncing, setIsSyncing] = useState(false);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSettings();
    startPolling();
    return () => stopPolling();
  }, []);

  const startPolling = () => {
    if (pollInterval.current) return;
    
    // Initial check
    checkCloudHeartbeat();
    
    pollInterval.current = setInterval(async () => {
      // 1. Try Local Hub (Setup Mode)
      try {
        const response = await fetch("http://192.168.4.1/handshake", { method: "GET" });
        if (response.ok) {
          const data = await response.json();
          if (data.device === "pothole-sensor") {
            setHardwareStatus("found");
            return;
          }
        }
      } catch (e) {
        // Fallback to Cloud Heartbeat
        checkCloudHeartbeat();
      }
    }, 30000); // 30s poll
  };

  const checkCloudHeartbeat = async () => {
    const status = await getSensorStatus();
    if (status && status.lastSeen) {
      const lastSeenDate = new Date(status.lastSeen).getTime();
      const now = new Date().getTime();
      // If seen in the last 3 minutes
      if (now - lastSeenDate < 180000) {
        setHardwareStatus("online");
        setLastSeen(status.lastSeen);
      }
    }
  };

  const stopPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  };

  const handleSyncHardware = async () => {
    setIsSyncing(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await fetch("http://192.168.4.1/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ssid: ssid,
          pass: password,
          fb: `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/potholes`
        })
      });

      if (response.ok) {
        setHardwareStatus("synced");
        Alert.alert("Sync Successful", "Sensor updated. It will now reboot and connect to WiFi.");
      } else {
        throw new Error("Sync failed");
      }
    } catch (error) {
      Alert.alert("Sync Failed", "Make sure you are connected to the 'Pothole-Sensor' WiFi hotspot.");
    } finally {
      setIsSyncing(false);
    }
  };

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

  const proceedToClear = () => {
    Alert.alert(
      "Confirm Bulk Delete",
      `Are you sure? This will delete all ${potholes.length} potholes from BOTH your device and the server.`,
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

  const handleClearAll = () => {
    if (potholes.length === 0) {
      Alert.alert("No Data", "There are no potholes to delete.");
      return;
    }

    if (!isAdmin) {
      if (Platform.OS === 'web') {
          const pass = window.prompt("Admin Password Required:");
          if (loginAdmin(pass || "")) {
            proceedToClear();
          } else if (pass !== null) {
            alert("Incorrect password.");
          }
      } else {
          Alert.alert(
            "Admin Login Required",
            "Please authenticate as an admin first to use this feature.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "How to Login?", onPress: () => Alert.alert("Admin Login", "For Android, please use the iOS version or contact support to manage bulk data.") }
            ]
          );
      }
    } else {
      proceedToClear();
    }
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <Text style={styles.sectionTitle}>Hardware Optimization</Text>
        <View style={styles.section}>
          <View style={styles.hardwareCard}>
            <View style={styles.statusHeader}>
              <View style={[styles.statusDot, { backgroundColor: (hardwareStatus === "found" || hardwareStatus === "synced" || hardwareStatus === "online") ? "#10B981" : "#F59E0B" }]} />
              <View style={styles.statusContent}>
                <Text style={styles.statusText}>
                  {hardwareStatus === "searching" && "Searching for Pothole Sensor..."}
                  {hardwareStatus === "found" && "Sensor Hub Found! Connect to WiFi"}
                  {hardwareStatus === "synced" && "Hardware Synced & Connected"}
                  {hardwareStatus === "online" && "Sensor Online (Cloud)"}
                </Text>
                {hardwareStatus === "online" && lastSeen && (
                  <Text style={styles.statusSubtitle}>Last Seen: {new Date(lastSeen).toLocaleTimeString()}</Text>
                )}
              </View>
              {hardwareStatus === "searching" && <ActivityIndicator size="small" color={Colors.textSecondary} />}
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Local WiFi Network</Text>
              <TextInput
                style={styles.input}
                value={ssid}
                onChangeText={setSsid}
                placeholder="WiFi Name"
                placeholderTextColor={Colors.textSecondary}
              />
              <Text style={styles.inputLabel}>WiFi Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="WiFi Password"
                secureTextEntry
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <Pressable
              onPress={handleSyncHardware}
              disabled={hardwareStatus !== "found" || isSyncing}
              style={({ pressed }) => [
                styles.syncButton,
                (hardwareStatus !== "found" || isSyncing) && styles.syncButtonDisabled,
                pressed && { opacity: 0.8 }
              ]}
            >
              {isSyncing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="sync" size={20} color="#FFF" />
                  <Text style={styles.syncButtonText}>Sync Config to Sensor</Text>
                </>
              )}
            </Pressable>
            
            {hardwareStatus === "searching" && (
              <Text style={styles.helpText}>Connect your phone to the 'Pothole-Sensor-XXXX' WiFi network to begin syncing.</Text>
            )}
          </View>
        </View>

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
    fontWeight: "700",
    color: Colors.textLight,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 16,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
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
    fontWeight: "500",
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
  hardwareCard: {
    padding: 16,
    gap: 16,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
    flex: 1,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  syncButton: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  syncButtonDisabled: {
    backgroundColor: Colors.textSecondary,
    opacity: 0.5,
  },
  syncButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  helpText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 18,
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
    fontWeight: "700",
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
    fontWeight: "600",
    color: Colors.textSecondary,
    width: 28,
  },
  coordValue: {
    fontSize: 14,
    fontWeight: "500",
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
