import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useGame } from "@/context/GameContext";

const C = Colors.dark;

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color?: string;
  icon: string;
}) {
  return (
    <View style={styles.statCard}>
      <View
        style={[
          styles.statIcon,
          { backgroundColor: (color ?? C.neonBlue) + "20" },
        ]}
      >
        <Feather name={icon as any} size={18} color={color ?? C.neonBlue} />
      </View>
      <Text style={[styles.statValue, color ? { color } : {}]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function XpBar({ xp, level }: { xp: number; level: number }) {
  const xpForNextLevel = level * 1000;
  const currentLevelXp = xp % 1000;
  const pct = Math.min(currentLevelXp / 1000, 1);

  return (
    <View style={styles.xpContainer}>
      <View style={styles.xpHeader}>
        <Text style={styles.xpLabel}>
          Level {level} · {currentLevelXp} / {xpForNextLevel} XP
        </Text>
        <Text style={styles.xpPct}>{Math.round(pct * 100)}%</Text>
      </View>
      <View style={styles.xpBarBg}>
        <View style={[styles.xpBarFill, { width: `${pct * 100}%` as any }]} />
      </View>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  color,
  right,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
  color?: string;
  right?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View
        style={[
          styles.menuIcon,
          { backgroundColor: (color ?? C.textMuted) + "20" },
        ]}
      >
        <Feather name={icon as any} size={18} color={color ?? C.textSecondary} />
      </View>
      <Text style={[styles.menuLabel, color ? { color } : {}]}>
        {label}
      </Text>
      {right ?? <Feather name="chevron-right" size={18} color={C.textMuted} />}
    </Pressable>
  );
}

function WinRateRing({ wins, total }: { wins: number; total: number }) {
  const pct = total === 0 ? 0 : wins / total;
  return (
    <View style={styles.ringContainer}>
      <Text style={styles.ringValue}>{Math.round(pct * 100)}%</Text>
      <Text style={styles.ringLabel}>Win Rate</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn, logout } = useGame();

  if (!isLoggedIn) {
    return (
      <View
        style={[
          styles.container,
          styles.centerContainer,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          },
        ]}
      >
        <View style={styles.guestIcon}>
          <Feather name="user" size={40} color={C.textMuted} />
        </View>
        <Text style={styles.guestTitle}>Not Signed In</Text>
        <Text style={styles.guestSubtitle}>
          Sign in to track your stats, see your rank, and compete on the
          leaderboard.
        </Text>
        <Pressable
          onPress={() => router.push("/auth")}
          style={({ pressed }) => [
            styles.signInBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.signInBtnText}>Sign In / Register</Text>
        </Pressable>
      </View>
    );
  }

  const totalGames = (user?.totalWins ?? 0) + (user?.totalLosses ?? 0);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          logout();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
            paddingBottom: Platform.OS === "web" ? 34 : 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>{user?.avatar}</Text>
            </View>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.username}>{user?.username}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.rankBadge}>
              <Feather name="zap" size={12} color={C.neonGold} />
              <Text style={styles.rankBadgeText}>Level {user?.level ?? 1}</Text>
            </View>
          </View>
          <WinRateRing
            wins={user?.totalWins ?? 0}
            total={totalGames}
          />
        </View>

        <XpBar xp={user?.xp ?? 0} level={user?.level ?? 1} />

        <View style={styles.balanceRow}>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceValue}>
              {(user?.balance ?? 0).toLocaleString()}
            </Text>
            <Text style={styles.balanceLabel}>Balance (pts)</Text>
          </View>
          <View style={styles.balanceBox}>
            <Text style={[styles.balanceValue, { color: C.neonGold }]}>
              #{user?.rank ?? "—"}
            </Text>
            <Text style={styles.balanceLabel}>Global Rank</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            label="Total Wins"
            value={user?.totalWins ?? 0}
            color={C.neonGreen}
            icon="check-circle"
          />
          <StatCard
            label="Total Losses"
            value={user?.totalLosses ?? 0}
            color={C.neonRed}
            icon="x-circle"
          />
          <StatCard
            label="Games Played"
            value={totalGames}
            icon="activity"
          />
          <StatCard
            label="Wagered"
            value={
              (user?.totalWagered ?? 0) >= 1000
                ? `${((user?.totalWagered ?? 0) / 1000).toFixed(1)}K`
                : user?.totalWagered ?? 0
            }
            color={C.neonBlue}
            icon="dollar-sign"
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>ACCOUNT</Text>
          <View style={styles.menuCard}>
            <MenuRow icon="user" label="Edit Profile" onPress={() => {}} />
            <View style={styles.menuDivider} />
            <MenuRow icon="bell" label="Notifications" onPress={() => {}} />
            <View style={styles.menuDivider} />
            <MenuRow icon="shield" label="Security" onPress={() => {}} />
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>SUPPORT</Text>
          <View style={styles.menuCard}>
            <MenuRow icon="help-circle" label="Help Center" onPress={() => {}} />
            <View style={styles.menuDivider} />
            <MenuRow
              icon="message-circle"
              label="Contact Us"
              onPress={() => {}}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <View style={styles.menuCard}>
            <MenuRow
              icon="log-out"
              label="Sign Out"
              color={C.neonRed}
              onPress={handleLogout}
              right={<></>}
            />
          </View>
        </View>

        <Text style={styles.version}>NeonBet v1.0.0 · © 2025</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  centerContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  content: {
    paddingHorizontal: 16,
  },
  guestIcon: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: C.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  guestTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: C.text,
    marginBottom: 10,
  },
  guestSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  signInBtn: {
    backgroundColor: C.neonBlue,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  signInBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#000",
  },
  heroSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 14,
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: C.neonBlue + "60",
    padding: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarEmoji: {
    fontSize: 32,
  },
  heroInfo: {
    flex: 1,
  },
  username: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: C.text,
    letterSpacing: -0.5,
  },
  email: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
  },
  rankBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.neonGold + "20",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  rankBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: C.neonGold,
  },
  ringContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: C.neonGreen + "60",
    backgroundColor: C.neonGreen + "10",
  },
  ringValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: C.neonGreen,
  },
  ringLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: C.textMuted,
    textAlign: "center",
  },
  xpContainer: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  xpHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  xpLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textSecondary,
  },
  xpPct: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: C.neonBlue,
  },
  xpBarBg: {
    height: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 4,
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    backgroundColor: C.neonBlue,
    borderRadius: 4,
  },
  balanceRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  balanceBox: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  balanceValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: C.text,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  balanceLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textMuted,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    gap: 8,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: C.text,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textMuted,
    textAlign: "center",
  },
  menuSection: {
    marginBottom: 12,
  },
  menuSectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: C.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: C.text,
    flex: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: C.surfaceBorder,
    marginLeft: 68,
  },
  version: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textMuted,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 8,
  },
});
