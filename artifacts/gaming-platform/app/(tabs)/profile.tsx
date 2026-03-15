import React from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import C from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

function StatCard({ label, value, color, iconName }: { label: string; value: string | number; color?: string; iconName: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: (color ?? C.primary) + "22" }]}>
        <Ionicons name={iconName} size={18} color={color ?? C.primary} />
      </View>
      <Text style={[styles.statValue, { color: color ?? C.text }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function XpBar({ xp, level }: { xp: number; level: number }) {
  const xpForNext = level * 1000;
  const cur = xp % 1000;
  const pct = Math.min(cur / 1000, 1);
  return (
    <View style={styles.xpWrap}>
      <View style={styles.xpHeader}>
        <Text style={styles.xpLabel}>Level {level}  ·  {cur} / {xpForNext} XP</Text>
        <Text style={styles.xpPct}>{Math.round(pct * 100)}%</Text>
      </View>
      <View style={styles.xpBarBg}>
        <LinearGradient colors={["#FF1A3A", "#FF6B00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.xpBarFill, { width: `${pct * 100}%` as any }]} />
      </View>
    </View>
  );
}

function MenuRow({ iconName, label, onPress, color }: {
  iconName: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void; color?: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.menuRow} activeOpacity={0.7}>
      <View style={[styles.menuIcon, { backgroundColor: (color ?? C.textMuted) + "22" }]}>
        <Ionicons name={iconName} size={18} color={color ?? C.textSoft} />
      </View>
      <Text style={[styles.menuLabel, color ? { color } : {}]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={C.textDim} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { state: authState, logout } = useAuth();
  const user = authState.user;

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          logout();
        },
      },
    ]);
  }

  if (!user) {
    return (
      <LinearGradient colors={[C.bgGrad1, C.bgGrad2, "#0A0018"]} style={[styles.root, styles.center]}>
        <View style={{ alignItems: "center", paddingHorizontal: 32 }}>
          <View style={styles.guestIcon}>
            <Ionicons name="person-outline" size={44} color={C.textDim} />
          </View>
          <Text style={styles.guestTitle}>Not Signed In</Text>
          <Text style={styles.guestSub}>Sign in to see your stats and compete with others.</Text>
        </View>
      </LinearGradient>
    );
  }

  const totalGames = user.totalWins + user.totalLosses;
  const winRate = totalGames > 0 ? Math.round((user.totalWins / totalGames) * 100) : 0;
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <LinearGradient colors={[C.bgGrad1, C.bgGrad2, "#0A0018"]} style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          paddingBottom: insets.bottom + 90,
        }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <LinearGradient colors={["#FF1A3A", "#8B0000"]} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <View style={styles.heroInfo}>
            <Text style={styles.username}>{user.username}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <View style={styles.vipBadge}>
              <Ionicons name="diamond" size={10} color={C.gold} />
              <Text style={styles.vipText}>{user.vipLevel}</Text>
            </View>
          </View>
          <View style={styles.winRateCircle}>
            <Text style={styles.winRateValue}>{winRate}%</Text>
            <Text style={styles.winRateLabel}>Win Rate</Text>
          </View>
        </View>

        {/* Balance */}
        <LinearGradient colors={["rgba(200,0,40,0.2)", "rgba(100,0,20,0.08)"]} style={styles.balanceCard}>
          <Text style={styles.balanceLbl}>WALLET BALANCE</Text>
          <Text style={styles.balanceAmt}>₹{user.balance.toLocaleString("en-IN")}</Text>
        </LinearGradient>

        {/* XP */}
        <XpBar xp={user.xp} level={user.level} />

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard label="Wins" value={user.totalWins} color={C.green} iconName="checkmark-circle" />
          <StatCard label="Losses" value={user.totalLosses} color={C.red} iconName="close-circle" />
          <StatCard label="Games" value={totalGames} iconName="game-controller" />
          <StatCard
            label="Wagered"
            value={user.totalWagered >= 1000 ? `${(user.totalWagered / 1000).toFixed(1)}K` : user.totalWagered}
            color={C.gold}
            iconName="cash"
          />
        </View>

        {/* Menu */}
        <Text style={styles.menuSectionTitle}>ACCOUNT</Text>
        <View style={styles.menuCard}>
          <MenuRow iconName="notifications-outline" label="Notifications" onPress={() => {}} />
          <View style={styles.menuDivider} />
          <MenuRow iconName="shield-checkmark-outline" label="Security" onPress={() => {}} />
          <View style={styles.menuDivider} />
          <MenuRow iconName="help-circle-outline" label="Help Center" onPress={() => {}} />
          <View style={styles.menuDivider} />
          <MenuRow iconName="chatbubble-ellipses-outline" label="Contact Support" onPress={() => {}} />
        </View>

        <View style={[styles.menuCard, { marginTop: 12 }]}>
          <MenuRow iconName="log-out-outline" label="Sign Out" color={C.red} onPress={handleLogout} />
        </View>

        <Text style={styles.versionText}>Udaan v1.0.0  ·  NeonBet ©</Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },
  scroll: { paddingHorizontal: 16 },
  guestIcon: { width: 100, height: 100, borderRadius: 30, backgroundColor: C.bgCard, alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderColor: C.border },
  guestTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 10 },
  guestSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center", lineHeight: 21 },
  hero: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  avatar: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#FFF" },
  heroInfo: { flex: 1 },
  username: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text },
  email: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted, marginTop: 2 },
  vipBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,215,0,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginTop: 6 },
  vipText: { fontSize: 11, fontFamily: "Inter_700Bold", color: C.gold },
  winRateCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, borderColor: C.green + "50", backgroundColor: C.green + "10", alignItems: "center", justifyContent: "center" },
  winRateValue: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.green },
  winRateLabel: { fontSize: 8, fontFamily: "Inter_400Regular", color: C.textMuted, marginTop: 1 },
  balanceCard: { borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 14 },
  balanceLbl: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 2 },
  balanceAmt: { fontSize: 30, fontFamily: "Inter_700Bold", color: C.gold, letterSpacing: -1, marginTop: 4 },
  xpWrap: { backgroundColor: C.bgCard, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  xpHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 9 },
  xpLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSoft },
  xpPct: { fontSize: 12, fontFamily: "Inter_700Bold", color: C.red },
  xpBarBg: { height: 7, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" },
  xpBarFill: { height: "100%", borderRadius: 4 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: { width: "47%", backgroundColor: C.bgCard, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: C.border, gap: 6 },
  statIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted },
  menuSectionTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 2, marginBottom: 8, marginLeft: 4 },
  menuCard: { backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: C.text },
  menuDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginLeft: 62 },
  versionText: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textDim, textAlign: "center", marginTop: 20 },
});
