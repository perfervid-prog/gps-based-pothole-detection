import React, { useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

interface AdminLoginModalProps {
    visible: boolean;
    onClose: () => void;
    onLogin: (password: string) => boolean;
}

export default function AdminLoginModal({
    visible,
    onClose,
    onLogin,
}: AdminLoginModalProps) {
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = () => {
        if (!password) return;

        const success = onLogin(password);
        if (success) {
            if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            setPassword("");
            onClose();
        } else {
            if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
            Alert.alert("Access Denied", "Incorrect administrator password.");
        }
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
                        <View style={styles.titleGroup}>
                            <Ionicons name="shield-lock" size={24} color={Colors.textLight} />
                            <Text style={styles.cardTitle}>Admin Login</Text>
                        </View>
                        <Pressable
                            onPress={onClose}
                            hitSlop={12}
                            style={({ pressed }) => [
                                styles.closeBtn,
                                pressed && { opacity: 0.6 },
                            ]}
                        >
                            <Ionicons name="close" size={24} color={Colors.textSecondary} />
                        </Pressable>
                    </View>

                    <Text style={styles.description}>
                        Enter the administrator password to enable manual pothole reporting and management.
                    </Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="••••••••"
                                placeholderTextColor={Colors.textSecondary}
                                secureTextEntry={!showPassword}
                                autoFocus
                                onSubmitEditing={handleLogin}
                            />
                            <Pressable 
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeBtn}
                                hitSlop={10}
                            >
                                <Ionicons 
                                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                                    size={20} 
                                    color="rgba(255, 255, 255, 0.7)"
                                />
                            </Pressable>
                        </View>
                    </View>

                    <Pressable
                        onPress={handleLogin}
                        style={({ pressed }) => [
                            styles.loginButton,
                            pressed && styles.loginButtonPressed,
                        ]}
                    >
                        <Text style={styles.loginButtonText}>Unlock Admin Features</Text>
                    </Pressable>
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
        borderRadius: 24,
        padding: 24,
        gap: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 15,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    titleGroup: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: "800" as const,
        color: Colors.textLight,
    },
    closeBtn: {
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
    },
    description: {
        fontSize: 14,
        color: "rgba(255,255,255,0.7)",
        lineHeight: 20,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 13,
        fontWeight: "700" as const,
        color: Colors.textLight,
        marginLeft: 4,
        textTransform: "uppercase" as const,
        letterSpacing: 1,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.15)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        paddingHorizontal: 16,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 16,
        color: Colors.textLight,
    },
    eyeBtn: {
        padding: 4,
        marginLeft: 8,
    },
    loginButton: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    loginButtonPressed: {
        backgroundColor: Colors.inputBackground,
        transform: [{ scale: 0.98 }],
    },
    loginButtonText: {
        fontSize: 16,
        fontWeight: "800" as const,
        color: Colors.primary,
    },
});
