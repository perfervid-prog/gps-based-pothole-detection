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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePotholes } from "@/contexts/PotholeContext";
import { Pothole, PROJECT_ID, getSensorStatus, getSensorConfig, updateSensorConfig, SensorConfig, SensorStatus } from "@/lib/storage";
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

  // Sensor Calibration
  const [calib, setCalib] = useState<SensorConfig>({ dipThreshold: 150, impactThreshold: 800, potholeWindow: 300 });
  const [dipThresholdStr, setDipThresholdStr] = useState("150");
  const [impactThresholdStr, setImpactThresholdStr] = useState("800");
  const [potholeWindowStr, setPotholeWindowStr] = useState("300");
  const [isSavingCalib, setIsSavingCalib] = useState(false);
  const [sensorStatus, setSensorStatus] = useState<SensorStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [distanceInput, setDistanceInput] = useState("100");

  useEffect(() => {
    loadSettings();
    loadCalibration();
    loadSensorStatus();

    // Poll for status while settings are open
    const interval = setInterval(loadSensorStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadSensorStatus = async () => {
    const status = await getSensorStatus();
    setSensorStatus(status);
  };

  const loadCalibration = async () => {
    const config = await getSensorConfig();
    if (config) {
      setCalib(config);
      setDipThresholdStr(config.dipThreshold.toString());
      setImpactThresholdStr(config.impactThreshold.toString());
      setPotholeWindowStr(config.potholeWindow.toString());
    }
  };

  const handleUpdateCalibration = async () => {
    setIsSavingCalib(true);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const configToSave: SensorConfig = {
      dipThreshold: parseFloat(dipThresholdStr) || 150,
      impactThreshold: parseInt(impactThresholdStr) || 800,
      potholeWindow: parseInt(potholeWindowStr) || 300,
    };

    const success = await updateSensorConfig(configToSave);
    if (success) {
      setCalib(configToSave);
      Alert.alert("Success", "Sensor brain updated. Changes will take effect on next heartbeat (within 60s).");
    } else {
      Alert.alert("Error", "Failed to update cloud configuration.");
    }
    setIsSavingCalib(false);
  };

  const loadSettings = async () => {
    const settings = await getAlertSettings();
    setAlertSettings(settings);
    setDistanceInput(settings.distance?.toString() || "100");
  };

  const handleToggleAlert = async (key: keyof typeof alertSettings, value?: boolean | number) => {
    const newValue = value !== undefined ? value : !alertSettings[key];
    await setAlertSetting(key as any, newValue as any);
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
      } else if (Platform.OS === 'ios') {
        Alert.prompt(
          "Admin Password Required",
          "Enter admin password to clear all data.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Confirm",
              onPress: (pass?: string) => {
                if (loginAdmin(pass || "")) {
                  proceedToClear();
                } else {
                  Alert.alert("Access Denied", "Incorrect administrator password.");
                }
              },
            },
          ],
          "secure-text"
        );
      } else {
        Alert.alert(
          "Admin Required",
          "Please log in as admin first from the main menu (☰ → Admin Login), then return here to clear data.",
          [{ text: "OK" }]
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
              Alert.alert("Success", "Onboarding has been reset. Please close and reopen the app to see the changes.");
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
        {/* Sensor Calibration Section */}

        <Text style={styles.sectionTitle}>Sensor Calibration (Math Tuning)</Text>
        <View style={styles.section}>
          <View style={styles.hardwareCard}>
            {/* Live Sensor Status Header */}
            <View style={styles.statusHeader}>
              <View style={[styles.statusDot, { backgroundColor: sensorStatus?.status === 'online' ? Colors.success : Colors.error }]} />
              <View style={styles.statusContent}>
                <Text style={styles.statusText}>
                  {sensorStatus ? `PotholeBrain v${sensorStatus.firmware}` : "Detecting Sensor..."}
                </Text>
                <Text style={styles.statusSubtitle}>
                  {sensorStatus ? `Last Seen: ${new Date(sensorStatus.lastSeen).toLocaleTimeString()}` : "Hardware not detected via cloud"}
                </Text>
              </View>
              {isLoadingStatus ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.calibHeader}>
                <Text style={styles.inputLabel}>Dip Sensitivity (DIP_THRESHOLD)</Text>
                <Text style={styles.calibVal}>{dipThresholdStr || "50"}</Text>
              </View>
              <Text style={styles.helpText}>Lower = More sensitive to dips. (Typical: 30 - 80)</Text>
              <TextInput
                style={styles.input}
                value={dipThresholdStr}
                keyboardType="numeric"
                onChangeText={setDipThresholdStr}
              />

              <View style={[styles.calibHeader, { marginTop: 12 }]}>
                <Text style={styles.inputLabel}>Impact Force (IMPACT_THRESHOLD)</Text>
                <Text style={styles.calibVal}>{impactThresholdStr || "500"}</Text>
              </View>
              <Text style={styles.helpText}>Force needed to confirm road hit. (Range: 300 - 1500)</Text>
              <TextInput
                style={styles.input}
                value={impactThresholdStr}
                keyboardType="numeric"
                onChangeText={setImpactThresholdStr}
              />

              <View style={[styles.calibHeader, { marginTop: 12 }]}>
                <Text style={styles.inputLabel}>Pothole Window (ms)</Text>
                <Text style={styles.calibVal}>{potholeWindowStr || "300"}</Text>
              </View>
              <Text style={styles.helpText}>Time allowed between dip and impact. (Hardware default: 300ms)</Text>
              <TextInput
                style={styles.input}
                value={potholeWindowStr}
                keyboardType="numeric"
                onChangeText={setPotholeWindowStr}
              />
            </View>

            <Pressable
              onPress={handleUpdateCalibration}
              disabled={isSavingCalib}
              style={({ pressed }) => [
                styles.syncButton,
                { backgroundColor: Colors.accent },
                isSavingCalib && styles.syncButtonDisabled,
                pressed && { opacity: 0.8 }
              ]}
            >
              {isSavingCalib ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Feather name="cpu" size={20} color="#FFF" />
                  <Text style={styles.syncButtonText}>Update Sensor Brain (Cloud)</Text>
                </>
              )}
            </Pressable>
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

              <View style={styles.separator} />
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <MaterialIcons name="straighten" size={22} color={Colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Alert Proximity (meters)</Text>
                  <Text style={styles.settingSubtitle}>Warning distance (Range: 20m - 500m)</Text>
                </View>
                <TextInput
                  style={[styles.input, { width: 80, textAlign: 'center', height: 40 }]}
                  value={distanceInput}
                  keyboardType="numeric"
                  onChangeText={setDistanceInput}
                  onBlur={() => {
                    const num = parseInt(distanceInput) || 100;
                    if (num >= 20 && num <= 1000) {
                      handleToggleAlert("distance", num);
                    } else {
                      // Reset to current saved distance if invalid
                      setDistanceInput(alertSettings.distance?.toString() || "100");
                    }
                  }}
                  onSubmitEditing={() => {
                    const num = parseInt(distanceInput) || 100;
                    if (num >= 20 && num <= 1000) {
                      handleToggleAlert("distance", num);
                    }
                  }}
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
  statusContent: {
    flex: 1,
    gap: 2,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  statusSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  wifiEyeBtn: {
    padding: 10,
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
    fontSize: 11,
    color: Colors.textSecondary,
    fontStyle: "italic",
    marginBottom: 2,
  },
  calibHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calibVal: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.accent,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
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
