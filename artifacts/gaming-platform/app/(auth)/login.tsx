import React, { useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import C from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function handleSubmit() {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }
    if (tab === "register" && !email.trim()) {
      Alert.alert("Error", "Please enter your email");
      return;
    }
    setLoading(true);
    try {
      if (tab === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), email.trim(), password);
      }
      router.replace("/(tabs)");
    } catch (e: unknown) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={[C.bgGrad1, C.bgGrad2, "#0A0018"]} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          
          {/* Logo */}
          <View style={styles.logoWrap}>
            <LinearGradient colors={["#FF1A3A", "#8B0000"]} style={styles.logoCircle}>
              <Ionicons name="rocket" size={44} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.logoTitle}>BLAZE</Text>
            <Text style={styles.logoSub}>by Star Games 🚀</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Tab switcher */}
            <View style={styles.tabs}>
              <TouchableOpacity style={[styles.tabBtn, tab === "login" && styles.tabActive]} onPress={() => setTab("login")}>
                <Text style={[styles.tabText, tab === "login" && styles.tabTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabBtn, tab === "register" && styles.tabActive]} onPress={() => setTab("register")}>
                <Text style={[styles.tabText, tab === "register" && styles.tabTextActive]}>Register</Text>
              </TouchableOpacity>
            </View>

            {tab === "register" && (
              <View style={styles.field}>
                <Text style={styles.label}>EMAIL</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="mail-outline" size={18} color={C.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor={C.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>USERNAME</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={18} color={C.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter username"
                  placeholderTextColor={C.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={C.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Enter password"
                  placeholderTextColor={C.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={C.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={loading ? ["#660011", "#440008"] : ["#FF1A3A", "#CC0022"]} style={styles.submitGrad}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitText}>{tab === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            {tab === "register" && (
              <Text style={styles.bonus}>
                New players get ₹10,000 welcome bonus!
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: "center", paddingHorizontal: 20 },
  logoWrap: { alignItems: "center", marginBottom: 36 },
  logoCircle: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", marginBottom: 12, shadowColor: "#FF1A3A", shadowRadius: 20, shadowOpacity: 0.6, shadowOffset: { width: 0, height: 0 } },
  logoTitle: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#FFFFFF", letterSpacing: 6 },
  logoSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textMuted, marginTop: 4 },
  card: { width: "100%", maxWidth: 400, backgroundColor: C.bgCard, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 24 },
  tabs: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, padding: 4, marginBottom: 24 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: C.primary },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.textMuted },
  tabTextActive: { color: "#FFFFFF" },
  field: { marginBottom: 16 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 14 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: C.text },
  submitBtn: { marginTop: 8, borderRadius: 14, overflow: "hidden", shadowColor: "#FF1A3A", shadowRadius: 12, shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 } },
  submitGrad: { paddingVertical: 16, alignItems: "center" },
  submitText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFFFFF", letterSpacing: 2 },
  bonus: { textAlign: "center", marginTop: 16, fontSize: 13, fontFamily: "Inter_400Regular", color: C.gold },
});
