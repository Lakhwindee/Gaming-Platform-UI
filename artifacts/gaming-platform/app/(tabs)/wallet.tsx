import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import C from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { api, ApiTransaction } from "@/lib/api";

const COIN_PACKAGES = [
  { id: "coins_100", label: "₹100", coins: 100, bonus: 0, popular: false, color: C.primary },
  { id: "coins_500", label: "₹500", coins: 500, bonus: 50, popular: false, color: "#8B00CC" },
  { id: "coins_1000", label: "₹1,000", coins: 1000, bonus: 150, popular: true, color: "#CC6600" },
  { id: "coins_5000", label: "₹5,000", coins: 5000, bonus: 1000, popular: false, color: C.gold },
];

function txIcon(type: string) {
  if (type === "deposit") return { name: "arrow-down-circle" as const, color: C.green };
  if (type === "withdraw") return { name: "arrow-up-circle" as const, color: C.red };
  if (type === "win") return { name: "trophy" as const, color: C.gold };
  return { name: "remove-circle" as const, color: C.textMuted };
}

export default function WalletScreen() {
  const { state: authState, refreshBalance } = useAuth();
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [upiId, setUpiId] = useState("");
  const [tab, setTab] = useState<"deposit" | "withdraw" | "history">("deposit");
  const [loading, setLoading] = useState(false);

  const loadTx = useCallback(async () => {
    if (!authState.token) return;
    setTxLoading(true);
    try {
      const data = await api.getTransactions(authState.token);
      setTransactions(data);
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, [authState.token]);

  useEffect(() => {
    if (tab === "history") loadTx();
  }, [tab, loadTx]);

  async function handleDeposit(pkg: typeof COIN_PACKAGES[0]) {
    if (!authState.token) { Alert.alert("Sign In Required"); return; }
    setLoading(true);
    try {
      const result = await api.deposit(authState.token, pkg.coins + pkg.bonus, `pkg_${pkg.id}_${Date.now()}`);
      await refreshBalance();
      Alert.alert("Deposit Successful!", `₹${(pkg.coins + pkg.bonus).toLocaleString("en-IN")} added to your wallet.\nNew balance: ₹${result.balance.toLocaleString("en-IN")}`);
    } catch (e: unknown) {
      Alert.alert("Deposit Failed", e instanceof Error ? e.message : "Please try again");
    } finally {
      setLoading(false);
    }
  }

  async function handleCustomDeposit() {
    const amt = parseInt(depositAmt, 10);
    if (isNaN(amt) || amt < 100) { Alert.alert("Invalid", "Minimum deposit is ₹100"); return; }
    if (!authState.token) { Alert.alert("Sign In Required"); return; }
    setLoading(true);
    try {
      const result = await api.deposit(authState.token, amt, `custom_${Date.now()}`);
      await refreshBalance();
      Alert.alert("Success!", `₹${amt.toLocaleString("en-IN")} added.\nBalance: ₹${result.balance.toLocaleString("en-IN")}`);
      setDepositAmt("");
    } catch (e: unknown) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Try again");
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw() {
    const amt = parseInt(withdrawAmt, 10);
    if (isNaN(amt) || amt < 200) { Alert.alert("Invalid", "Minimum withdrawal is ₹200"); return; }
    if (!upiId.trim()) { Alert.alert("UPI ID Required", "Enter your UPI ID"); return; }
    if (!authState.token) { Alert.alert("Sign In Required"); return; }
    Alert.alert(
      "Confirm Withdrawal",
      `Withdraw ₹${amt.toLocaleString("en-IN")} to ${upiId}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setLoading(true);
            try {
              await api.withdraw(authState.token!, amt, upiId);
              await refreshBalance();
              Alert.alert("Withdrawal Requested", "Your withdrawal will be processed within 24 hours.");
              setWithdrawAmt(""); setUpiId("");
            } catch (e: unknown) {
              Alert.alert("Failed", e instanceof Error ? e.message : "Try again");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  const balance = authState.user?.balance ?? 0;

  return (
    <LinearGradient colors={[C.bgGrad1, C.bgGrad2, "#0A0018"]} style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          paddingBottom: insets.bottom + 90,
        }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.screenTitle}>Wallet</Text>

        {/* Balance Card */}
        <LinearGradient colors={["rgba(200,0,40,0.22)", "rgba(100,0,20,0.1)"]} style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLbl}>TOTAL BALANCE</Text>
              <Text style={styles.balanceAmt}>₹{balance.toLocaleString("en-IN")}</Text>
            </View>
            <View style={styles.walletIcon}>
              <Ionicons name="wallet" size={28} color={C.gold} />
            </View>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceStatsRow}>
            <View style={styles.balanceStat}>
              <Ionicons name="arrow-down-circle" size={14} color={C.green} />
              <Text style={styles.balanceStatText}>Deposits</Text>
            </View>
            <View style={styles.balanceStat}>
              <Ionicons name="arrow-up-circle" size={14} color={C.red} />
              <Text style={styles.balanceStatText}>Withdrawals</Text>
            </View>
            <View style={styles.balanceStat}>
              <Ionicons name="shield-checkmark" size={14} color={C.textMuted} />
              <Text style={styles.balanceStatText}>Secured</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(["deposit", "withdraw", "history"] as const).map(t => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "deposit" ? "Deposit" : t === "withdraw" ? "Withdraw" : "History"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* DEPOSIT */}
        {tab === "deposit" && (
          <View>
            <Text style={styles.sectionTitle}>QUICK DEPOSIT</Text>
            <View style={styles.packagesGrid}>
              {COIN_PACKAGES.map(pkg => (
                <TouchableOpacity key={pkg.id} onPress={() => handleDeposit(pkg)} disabled={loading || !authState.user} activeOpacity={0.8}>
                  <LinearGradient
                    colors={[pkg.color + "33", pkg.color + "11"]}
                    style={[styles.packageCard, { borderColor: pkg.color + "55" }, pkg.popular && { borderColor: pkg.color }]}
                  >
                    {pkg.popular && (
                      <View style={[styles.popularBadge, { backgroundColor: pkg.color }]}>
                        <Text style={styles.popularText}>POPULAR</Text>
                      </View>
                    )}
                    <Text style={[styles.pkgLabel, { color: pkg.color }]}>{pkg.label}</Text>
                    {pkg.bonus > 0 && (
                      <Text style={styles.pkgBonus}>+₹{pkg.bonus} bonus</Text>
                    )}
                    <Text style={styles.pkgTotal}>
                      ₹{(pkg.coins + pkg.bonus).toLocaleString("en-IN")} total
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>CUSTOM AMOUNT</Text>
            <View style={styles.customRow}>
              <View style={styles.customInput}>
                <Text style={styles.customPrefix}>₹</Text>
                <TextInput
                  style={styles.customInputField}
                  placeholder="Enter amount"
                  placeholderTextColor={C.textMuted}
                  value={depositAmt}
                  onChangeText={setDepositAmt}
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity onPress={handleCustomDeposit} disabled={loading || !authState.user} activeOpacity={0.85}>
                <LinearGradient colors={["#00C853", "#009C41"]} style={styles.customBtn}>
                  {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.customBtnText}>ADD</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <Text style={styles.minNote}>Minimum deposit: ₹100</Text>
          </View>
        )}

        {/* WITHDRAW */}
        {tab === "withdraw" && (
          <View>
            <Text style={styles.sectionTitle}>WITHDRAWAL DETAILS</Text>
            <View style={styles.fieldGroup}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>AMOUNT (₹)</Text>
                <View style={styles.fieldInput}>
                  <Text style={styles.customPrefix}>₹</Text>
                  <TextInput
                    style={styles.fieldInputText}
                    placeholder="Enter amount"
                    placeholderTextColor={C.textMuted}
                    value={withdrawAmt}
                    onChangeText={setWithdrawAmt}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>UPI ID</Text>
                <View style={styles.fieldInput}>
                  <Ionicons name="phone-portrait-outline" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.fieldInputText}
                    placeholder="yourname@upi"
                    placeholderTextColor={C.textMuted}
                    value={upiId}
                    onChangeText={setUpiId}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={handleWithdraw} disabled={loading || !authState.user} activeOpacity={0.85}>
              <LinearGradient colors={["#FF4060", "#CC0030"]} style={styles.withdrawBtn}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.withdrawBtnText}>REQUEST WITHDRAWAL</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.minNote}>Minimum: ₹200 · Processed within 24 hours</Text>
          </View>
        )}

        {/* HISTORY */}
        {tab === "history" && (
          <View>
            {txLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={C.red} size="large" />
              </View>
            ) : transactions.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="receipt-outline" size={44} color={C.textDim} />
                <Text style={styles.emptyText}>No transactions yet</Text>
              </View>
            ) : (
              transactions.map((tx, i) => {
                const icon = txIcon(tx.type);
                const isPositive = tx.type === "deposit" || tx.type === "win";
                return (
                  <View key={tx.id ?? i} style={styles.txRow}>
                    <View style={[styles.txIcon, { backgroundColor: icon.color + "22" }]}>
                      <Ionicons name={icon.name} size={20} color={icon.color} />
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txType}>{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</Text>
                      <Text style={styles.txNote}>{tx.note}</Text>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={[styles.txAmount, { color: isPositive ? C.green : C.red }]}>
                        {isPositive ? "+" : "-"}₹{Math.abs(tx.amount).toLocaleString("en-IN")}
                      </Text>
                      <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString("en-IN")}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  screenTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 20 },
  balanceCard: { borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 20, marginBottom: 20 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  balanceLbl: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 1.5, marginBottom: 6 },
  balanceAmt: { fontSize: 34, fontFamily: "Inter_700Bold", color: C.gold, letterSpacing: -1 },
  walletIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: "rgba(255,215,0,0.12)", alignItems: "center", justifyContent: "center" },
  balanceDivider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  balanceStatsRow: { flexDirection: "row", gap: 20 },
  balanceStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  balanceStatText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textMuted },
  tabs: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 14, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: C.primary },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textMuted },
  tabTextActive: { color: "#FFFFFF" },
  sectionTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 2, marginBottom: 12 },
  packagesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  packageCard: { width: (((320 - 32) / 2) - 5), borderRadius: 14, borderWidth: 1.5, padding: 14, minWidth: 130 },
  popularBadge: { position: "absolute", top: -1, right: -1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  popularText: { fontSize: 8, fontFamily: "Inter_700Bold", color: "#FFF", letterSpacing: 1 },
  pkgLabel: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 4 },
  pkgBonus: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.green, marginBottom: 2 },
  pkgTotal: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted },
  customRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  customInput: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 12 },
  customPrefix: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.gold, marginRight: 3 },
  customInputField: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: C.text },
  customBtn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, alignItems: "center" },
  customBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  minNote: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textDim, marginTop: 10, textAlign: "center" },
  fieldGroup: { gap: 12, marginBottom: 16 },
  field: {},
  fieldLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 1.5, marginBottom: 7 },
  fieldInput: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 13 },
  fieldInputText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: C.text },
  withdrawBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  withdrawBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1.5 },
  loadingBox: { height: 160, alignItems: "center", justifyContent: "center" },
  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textDim },
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txInfo: { flex: 1 },
  txType: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  txNote: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted, marginTop: 2 },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  txDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textDim, marginTop: 2 },
});
