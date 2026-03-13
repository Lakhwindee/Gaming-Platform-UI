import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useGame } from "@/context/GameContext";

const C = Colors.dark;

type Mode = "login" | "register";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useGame();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const switchMode = (newMode: Mode) => {
    if (newMode === mode) return;
    Animated.spring(slideAnim, {
      toValue: newMode === "register" ? 1 : 0,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();
    setMode(newMode);
    setError("");
  };

  const handleSubmit = async () => {
    setError("");
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    if (mode === "register" && !email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password.trim()) {
      setError("Password is required");
      return;
    }
    setLoading(true);
    try {
      let success = false;
      if (mode === "login") {
        success = await login(username.trim(), password);
      } else {
        success = await register(username.trim(), email.trim(), password);
      }
      if (success) {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        router.replace("/(tabs)");
      } else {
        setError("Invalid credentials. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
        },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color={C.textSecondary} />
          </Pressable>

          <View style={styles.logoArea}>
            <View style={styles.logoIcon}>
              <Feather name="zap" size={36} color={C.neonBlue} />
            </View>
            <Text style={styles.logoTitle}>NeonBet</Text>
            <Text style={styles.logoSubtitle}>
              {mode === "login"
                ? "Welcome back, player"
                : "Create your account"}
            </Text>
          </View>

          <View style={styles.modeSwitcher}>
            <Pressable
              onPress={() => switchMode("login")}
              style={[
                styles.modeTab,
                mode === "login" && styles.modeTabActive,
              ]}
            >
              <Text
                style={[
                  styles.modeTabText,
                  mode === "login" && styles.modeTabTextActive,
                ]}
              >
                Sign In
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchMode("register")}
              style={[
                styles.modeTab,
                mode === "register" && styles.modeTabActive,
              ]}
            >
              <Text
                style={[
                  styles.modeTabText,
                  mode === "register" && styles.modeTabTextActive,
                ]}
              >
                Register
              </Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>USERNAME</Text>
              <View style={styles.inputContainer}>
                <Feather
                  name="user"
                  size={18}
                  color={C.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter username"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {mode === "register" && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EMAIL</Text>
                <View style={styles.inputContainer}>
                  <Feather
                    name="mail"
                    size={18}
                    color={C.textMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter email address"
                    placeholderTextColor={C.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <View style={styles.inputContainer}>
                <Feather
                  name="lock"
                  size={18}
                  color={C.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={C.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={18}
                    color={C.textMuted}
                  />
                </Pressable>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color={C.neonRed} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && { opacity: 0.85 },
                loading && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.submitBtnText}>
                {loading
                  ? "Loading..."
                  : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
              </Text>
              {!loading && (
                <Feather name="arrow-right" size={20} color="#000" />
              )}
            </Pressable>

            <Text style={styles.disclaimer}>
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 36,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.neonBlue + "20",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.neonBlue + "40",
  },
  logoTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: C.text,
    letterSpacing: -1,
    marginBottom: 8,
  },
  logoSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: C.textSecondary,
  },
  modeSwitcher: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 11,
    alignItems: "center",
  },
  modeTabActive: {
    backgroundColor: C.neonBlue,
  },
  modeTabText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.textMuted,
  },
  modeTabTextActive: {
    color: "#000",
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: C.textMuted,
    letterSpacing: 1.5,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    paddingHorizontal: 14,
    height: 54,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: C.text,
  },
  eyeBtn: {
    padding: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.neonRed + "15",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.neonRed + "30",
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.neonRed,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: C.neonBlue,
    borderRadius: 14,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  submitBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#000",
  },
  disclaimer: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
});
