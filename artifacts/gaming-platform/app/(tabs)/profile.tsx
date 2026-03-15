import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import C from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { api, ApiGameHistory } from "@/lib/api";

const VIP_TIERS = [
  { label: "Bronze",   min: 0,       color: "#CD7F32", icon: "shield-outline" as const },
  { label: "Silver",   min: 50000,   color: "#C0C0C0", icon: "shield-half-outline" as const },
  { label: "Gold",     min: 200000,  color: C.gold,    icon: "shield" as const },
  { label: "Platinum", min: 500000,  color: "#00CFFF", icon: "diamond-outline" as const },
  { label: "Diamond",  min: 1000000, color: "#BF00FF", icon: "diamond" as const },
];

function getVip(wagered: number) {
  let tier = VIP_TIERS[0];
  for (const t of VIP_TIERS) if (wagered >= t.min) tier = t;
  const idx = VIP_TIERS.indexOf(tier);
  const next = VIP_TIERS[idx + 1];
  const pct = next ? Math.min((wagered - tier.min) / (next.min - tier.min), 1) : 1;
  return { tier, next, pct };
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function HistoryRow({ item }: { item: ApiGameHistory }) {
  const won = item.status === "cashedout" && item.payout != null && item.payout > 0;
  const mult = item.cashedOutAt ? parseFloat(item.cashedOutAt) : null;
  const crashMult = item.crashPoint ? parseFloat(item.crashPoint) : null;
  const profit = won ? (item.payout! - item.amount) : -item.amount;

  return (
    <View style={styles.histRow}>
      <View style={[styles.histDot, { backgroundColor: won ? C.green : C.red }]} />
      <View style={styles.histInfo}>
        <Text style={styles.histLabel}>
          {won ? `Cashed out @ ${mult?.toFixed(2)}×` : `Crashed @ ${crashMult?.toFixed(2) ?? "?"}×`}
        </Text>
        <Text style={styles.histTime}>{timeAgo(item.placedAt)}</Text>
      </View>
      <View style={styles.histRight}>
        <Text style={[styles.histBet, { color: won ? C.green : C.red }]}>
          {won ? "+" : "-"}{fmt(Math.abs(profit))}
        </Text>
        <Text style={styles.histStake}>{fmt(item.amount)}</Text>
      </View>
    </View>
  );
}

function ChangePasswordModal({ visible, token, onClose }: {
  visible: boolean; token: string; onClose: () => void;
}) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);

  function reset() { setCur(""); setNext(""); setConfirm(""); setErr(""); setLoading(false); }

  async function submit() {
    if (!cur || !next || !confirm) { setErr("All fields required"); return; }
    if (next !== confirm) { setErr("New passwords don't match"); return; }
    if (next.length < 6) { setErr("New password must be at least 6 characters"); return; }
    setLoading(true); setErr("");
    try {
      await api.changePassword(token, cur, next);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      onClose();
      Alert.alert("Success", "Password changed successfully!");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Change Password</Text>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
            <View style={styles.fieldRow}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter current password"
                placeholderTextColor={C.textDim}
                secureTextEntry={!showCur}
                value={cur}
                onChangeText={v => { setCur(v); setErr(""); }}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowCur(p => !p)}>
                <Ionicons name={showCur ? "eye-off-outline" : "eye-outline"} size={18} color={C.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
            <View style={styles.fieldRow}>
              <TextInput
                style={styles.fieldInput}
                placeholder="At least 6 characters"
                placeholderTextColor={C.textDim}
                secureTextEntry={!showNew}
                value={next}
                onChangeText={v => { setNext(v); setErr(""); }}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNew(p => !p)}>
                <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={18} color={C.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>CONFIRM NEW PASSWORD</Text>
            <View style={[styles.fieldRow, confirm.length > 0 && confirm !== next && { borderColor: C.red }]}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Re-enter new password"
                placeholderTextColor={C.textDim}
                secureTextEntry={!showNew}
                value={confirm}
                onChangeText={v => { setConfirm(v); setErr(""); }}
                autoCapitalize="none"
              />
              {confirm.length > 0 && (
                <Ionicons
                  name={confirm === next ? "checkmark-circle" : "close-circle"}
                  size={18}
                  color={confirm === next ? C.green : C.red}
                />
              )}
            </View>
          </View>

          {err ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle-outline" size={14} color={C.red} />
              <Text style={styles.errText}>{err}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, (loading || !cur || !next || !confirm) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={loading || !cur || !next || !confirm}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.submitBtnText}>CHANGE PASSWORD</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => { reset(); onClose(); }}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { state: authState, logout } = useAuth();
  const user = authState.user;

  const [history, setHistory]       = useState<ApiGameHistory[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!authState.token) return;
    try {
      setHistLoading(true);
      const h = await api.getGameHistory(authState.token);
      setHistory(h);
    } catch (_) {
      /* ignore */
    } finally {
      setHistLoading(false);
    }
  }, [authState.token]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, [loadHistory]);

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive",
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
        <View style={styles.guestBox}>
          <View style={styles.guestIcon}><Ionicons name="person-outline" size={44} color={C.textDim} /></View>
          <Text style={styles.guestTitle}>Not Signed In</Text>
          <Text style={styles.guestSub}>Sign in to track your stats and game history.</Text>
        </View>
      </LinearGradient>
    );
  }

  const totalGames = user.totalWins + user.totalLosses;
  const winRate = totalGames > 0 ? Math.round((user.totalWins / totalGames) * 100) : 0;
  const { tier, next: nextTier, pct: vipPct } = getVip(user.totalWagered);
  const initials = user.username.slice(0, 2).toUpperCase();

  const biggestWin = history.reduce<number>((acc, h) => {
    if (h.status === "cashedout" && h.payout != null) {
      const profit = h.payout - h.amount;
      return profit > acc ? profit : acc;
    }
    return acc;
  }, 0);

  const bestMult = history.reduce<number>((acc, h) => {
    if (h.cashedOutAt) {
      const m = parseFloat(h.cashedOutAt);
      return m > acc ? m : acc;
    }
    return acc;
  }, 0);

  const visibleHistory = showAllHistory ? history : history.slice(0, 8);

  return (
    <LinearGradient colors={[C.bgGrad1, C.bgGrad2, "#0A0018"]} style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          paddingBottom: insets.bottom + 100,
        }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.red} />}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <LinearGradient colors={[tier.color + "55", tier.color + "22"]} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <View style={styles.heroInfo}>
            <Text style={styles.username}>{user.username}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <View style={[styles.vipBadge, { backgroundColor: tier.color + "20", borderColor: tier.color + "50" }]}>
              <Ionicons name={tier.icon} size={11} color={tier.color} />
              <Text style={[styles.vipText, { color: tier.color }]}>{tier.label}</Text>
            </View>
          </View>
          <View style={styles.winRateCircle}>
            <Text style={styles.winRateVal}>{winRate}%</Text>
            <Text style={styles.winRateLbl}>WIN</Text>
          </View>
        </View>

        {/* ── Balance ── */}
        <LinearGradient
          colors={["rgba(255,215,0,0.12)", "rgba(255,215,0,0.04)"]}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLbl}>WALLET BALANCE</Text>
          <Text style={styles.balanceAmt}>₹{user.balance.toLocaleString("en-IN")}</Text>
          <Text style={styles.balanceSub}>Total wagered: {fmt(user.totalWagered)}</Text>
        </LinearGradient>

        {/* ── VIP Progress ── */}
        <View style={styles.vipCard}>
          <View style={styles.vipHeader}>
            <View style={styles.vipLeft}>
              <Ionicons name={tier.icon} size={16} color={tier.color} />
              <Text style={[styles.vipName, { color: tier.color }]}>{tier.label}</Text>
            </View>
            {nextTier && (
              <Text style={styles.vipNextLabel}>
                {fmt(nextTier.min - user.totalWagered)} to{" "}
                <Text style={{ color: nextTier.color }}>{nextTier.label}</Text>
              </Text>
            )}
          </View>
          <View style={styles.vipBarBg}>
            <LinearGradient
              colors={[tier.color, nextTier?.color ?? tier.color]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.vipBarFill, { width: `${Math.round(vipPct * 100)}%` as any }]}
            />
          </View>
          <Text style={styles.vipPct}>{Math.round(vipPct * 100)}% to next tier</Text>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsGrid}>
          <StatCard label="Total Games"  value={totalGames.toString()} color={C.primary} icon="game-controller-outline" />
          <StatCard label="Wins"         value={user.totalWins.toString()} color={C.green} icon="trending-up" />
          <StatCard label="Best Mult"    value={bestMult > 0 ? `${bestMult.toFixed(2)}×` : "—"} color={C.gold} icon="rocket-outline" />
          <StatCard label="Biggest Win"  value={biggestWin > 0 ? fmt(biggestWin) : "—"} color={C.orange} icon="trophy-outline" />
        </View>

        {/* ── Game History ── */}
        <Text style={styles.sectionTitle}>GAME HISTORY</Text>
        <View style={styles.historyCard}>
          {histLoading ? (
            <View style={styles.histLoading}>
              <ActivityIndicator color={C.red} size="small" />
              <Text style={styles.histLoadingText}>Loading history...</Text>
            </View>
          ) : history.length === 0 ? (
            <View style={styles.histEmpty}>
              <Ionicons name="game-controller-outline" size={32} color={C.textDim} />
              <Text style={styles.histEmptyText}>No games played yet</Text>
              <Text style={styles.histEmptySub}>Start playing to see your history here</Text>
            </View>
          ) : (
            <>
              {visibleHistory.map((item, i) => (
                <React.Fragment key={item.betId}>
                  {i > 0 && <View style={styles.histDivider} />}
                  <HistoryRow item={item} />
                </React.Fragment>
              ))}
              {history.length > 8 && (
                <TouchableOpacity
                  style={styles.showMoreBtn}
                  onPress={() => setShowAllHistory(p => !p)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.showMoreText}>
                    {showAllHistory ? "Show Less" : `Show All (${history.length})`}
                  </Text>
                  <Ionicons name={showAllHistory ? "chevron-up" : "chevron-down"} size={14} color={C.primary} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* ── Settings ── */}
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuRow} onPress={() => setShowPwModal(true)} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: C.primary + "20" }]}>
              <Ionicons name="lock-closed-outline" size={18} color={C.primary} />
            </View>
            <Text style={styles.menuLabel}>Change Password</Text>
            <Ionicons name="chevron-forward" size={16} color={C.textDim} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuRow} onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert("Support", "Contact us at support@blazeapp.in\nor WhatsApp: +91 99999 99999");
          }} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: C.green + "20" }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={C.green} />
            </View>
            <Text style={styles.menuLabel}>Support</Text>
            <Ionicons name="chevron-forward" size={16} color={C.textDim} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuRow} onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert("About", "Blaze v1.0.0\nPremium Crash Game by Star Games\n\n© 2025 Star Games");
          }} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: C.textDim + "20" }]}>
              <Ionicons name="information-circle-outline" size={18} color={C.textMuted} />
            </View>
            <Text style={styles.menuLabel}>About</Text>
            <Ionicons name="chevron-forward" size={16} color={C.textDim} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuRow} onPress={handleLogout} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: C.red + "20" }]}>
              <Ionicons name="log-out-outline" size={18} color={C.red} />
            </View>
            <Text style={[styles.menuLabel, { color: C.red }]}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={16} color={C.textDim} />
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>Blaze v1.0.0 by Star Games  ·  © 2025</Text>
      </ScrollView>

      <ChangePasswordModal
        visible={showPwModal}
        token={authState.token ?? ""}
        onClose={() => setShowPwModal(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },
  scroll: { paddingHorizontal: 16, gap: 0 },

  guestBox: { alignItems: "center", paddingHorizontal: 32 },
  guestIcon: { width: 100, height: 100, borderRadius: 30, backgroundColor: C.bgCard, alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderColor: C.border },
  guestTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 10 },
  guestSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center", lineHeight: 21 },

  hero: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  avatar: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#FFF" },
  heroInfo: { flex: 1 },
  username: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text },
  email: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted, marginTop: 1 },
  vipBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginTop: 6, borderWidth: 1 },
  vipText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  winRateCircle: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: C.green + "50", backgroundColor: C.green + "10", alignItems: "center", justifyContent: "center" },
  winRateVal: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.green },
  winRateLbl: { fontSize: 8, fontFamily: "Inter_400Regular", color: C.textMuted },

  balanceCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,215,0,0.2)", padding: 16, marginBottom: 12 },
  balanceLbl: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 2 },
  balanceAmt: { fontSize: 30, fontFamily: "Inter_700Bold", color: C.gold, marginTop: 4 },
  balanceSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textDim, marginTop: 3 },

  vipCard: { backgroundColor: C.bgCard, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  vipHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  vipLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  vipName: { fontSize: 13, fontFamily: "Inter_700Bold" },
  vipNextLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted },
  vipBarBg: { height: 7, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" },
  vipBarFill: { height: "100%", borderRadius: 4 },
  vipPct: { fontSize: 10, fontFamily: "Inter_400Regular", color: C.textDim, marginTop: 5, textAlign: "right" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: { width: "47%", backgroundColor: C.bgCard, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: C.border, gap: 4 },
  statIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: C.textDim },
  statLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted },

  sectionTitle: { fontSize: 10, fontFamily: "Inter_700Bold", color: C.textMuted, letterSpacing: 2, marginBottom: 10, marginLeft: 2 },

  historyCard: { backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border, marginBottom: 20, overflow: "hidden" },
  histLoading: { flexDirection: "row", alignItems: "center", gap: 10, padding: 20, justifyContent: "center" },
  histLoadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textMuted },
  histEmpty: { alignItems: "center", padding: 30, gap: 8 },
  histEmptyText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.textSoft },
  histEmptySub: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textDim, textAlign: "center" },
  histRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  histDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginLeft: 40 },
  histDot: { width: 8, height: 8, borderRadius: 4 },
  histInfo: { flex: 1 },
  histLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  histTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textDim, marginTop: 2 },
  histRight: { alignItems: "flex-end" },
  histBet: { fontSize: 14, fontFamily: "Inter_700Bold" },
  histStake: { fontSize: 10, fontFamily: "Inter_400Regular", color: C.textDim, marginTop: 1 },
  showMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.04)" },
  showMoreText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.primary },

  menuCard: { backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden", marginBottom: 20 },
  menuRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: C.text },
  menuDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginLeft: 62 },

  versionText: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textDim, textAlign: "center", marginTop: 4, marginBottom: 8 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#1A1025", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 14 },
  modalHandle: { width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text, textAlign: "center" },

  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: C.textMuted, letterSpacing: 1.2 },
  fieldRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 11, gap: 8 },
  fieldInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },

  errBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,50,80,0.1)", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "rgba(255,50,80,0.25)" },
  errText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: C.red },

  submitBtn: { backgroundColor: C.red, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  submitBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  cancelBtn: { paddingVertical: 8, alignItems: "center" },
  cancelBtnText: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textMuted },
});
