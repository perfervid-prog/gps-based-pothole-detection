import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { Pothole } from "@/lib/storage";

interface UpdateModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate: (latitude: number, longitude: number) => void;
  onDelete?: (id: string) => void;
  pothole?: Pothole | null;
}

export default function UpdateModal({
  visible,
  onClose,
  onUpdate,
  onDelete,
  pothole,
}: UpdateModalProps) {
  const insets = useSafeAreaInsets();
  const [longitude, setLongitude] = useState("");
  const [latitude, setLatitude] = useState("");

  useEffect(() => {
    if (pothole) {
      setLongitude(pothole.longitude.toString());
      setLatitude(pothole.latitude.toString());
    } else {
      setLongitude("");
      setLatitude("");
    }
  }, [pothole, visible]);

  const handleUpdate = () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert("Invalid Input", "Please enter valid numeric coordinates.");
      return;
    }

    if (lat < -90 || lat > 90) {
      Alert.alert("Invalid Latitude", "Latitude must be between -90 and 90.");
      return;
    }

    if (lng < -180 || lng > 180) {
      Alert.alert("Invalid Longitude", "Longitude must be between -180 and 180.");
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    onUpdate(lat, lng);
    onClose();
  };

  const handleDelete = () => {
    if (!pothole || !onDelete) return;

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    Alert.alert(
      "Delete Pothole",
      "Are you sure you want to remove this pothole report?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDelete(pothole.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {pothole ? "Update Location" : "Add Pothole"}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Longitude</Text>
            <TextInput
              style={styles.input}
              value={longitude}
              onChangeText={setLongitude}
              placeholder="e.g. 19.9370"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numeric"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Latitude</Text>
            <TextInput
              style={styles.input}
              value={latitude}
              onChangeText={setLatitude}
              placeholder="e.g. 50.0614"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={handleUpdate}
            />
          </View>

          <Pressable
            onPress={handleUpdate}
            style={({ pressed }) => [
              styles.updateButton,
              pressed && styles.updateButtonPressed,
            ]}
          >
            <Text style={styles.updateButtonText}>
              {pothole ? "Update" : "Add"}
            </Text>
          </Pressable>

          {pothole && onDelete && (
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.deleteButtonPressed,
              ]}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.textLight} style={{ marginRight: 6 }} />
              <Text style={styles.deleteButtonText}>Delete Pothole</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.textLight,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.7)",
    marginLeft: 4,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: "500" as const,
  },
  updateButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  updateButtonPressed: {
    backgroundColor: Colors.inputBackground,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  deleteButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row" as const,
    justifyContent: "center" as const,
  },
  deleteButtonPressed: {
    backgroundColor: Colors.accentDark,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.textLight,
  },
});
