import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Ellipse, Path, Rect, Defs, LinearGradient as SvgGrad, Stop, G } from "react-native-svg";
import * as WebBrowser from "expo-web-browser";
import C from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { api, ApiTransaction } from "@/lib/api";

const AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

type PayMethod = "gpay" | "phonepe" | "paytm" | "upi";

const PAY_METHODS: { id: PayMethod; label: string; color: string; bg: string }[] = [
  { id: "gpay", label: "Google Pay", color: "#34A853", bg: "rgba(52,168,83,0.15)" },
  { id: "phonepe", label: "PhonePe", color: "#6739B7", bg: "rgba(103,57,183,0.15)" },
  { id: "paytm", label: "Paytm", color: "#00BAF2", bg: "rgba(0,186,242,0.15)" },
  { id: "upi", label: "Other UPI", color: "#FF6B00", bg: "rgba(255,107,0,0.15)" },
];

function GPay({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="#34A853" />
      <Path d="M7.5 12.5v-1h2v1h-2zm7-1h-2v1h2v-1z" fill="white" />
      <Path d="M5 11.5h14v1H5v-1z" fill="white" opacity="0.8" />
      <Path d="M12 8l3 3.5L12 15l-3-3.5z" fill="white" />
    </Svg>
  );
}

function PhonePeIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect width="24" height="24" rx="6" fill="#6739B7" />
      <Path d="M12 4C8.686 4 6 6.686 6 10v4c0 3.314 2.686 6 6 6s6-2.686 6-6v-4c0-3.314-2.686-6-6-6z" fill="white" opacity="0.3" />
      <Circle cx="12" cy="10" r="3" fill="white" />
      <Rect x="10" y="13" width="4" height="5" rx="2" fill="white" />
    </Svg>
  );
}

function PaytmIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect width="24" height="24" rx="6" fill="#00BAF2" />
      <Path d="M5 12h14M12 5v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

function UpiIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect width="24" height="24" rx="6" fill="#FF6B00" />
      <Path d="M7 17l5-10 5 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M8.5 14h7" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function PayMethodIcon({ id, size = 28 }: { id: PayMethod; size?: number }) {
  if (id === "gpay") return <GPay size={size} />;
  if (id === "phonepe") return <PhonePeIcon size={size} />;
  if (id === "paytm") return <PaytmIcon size={size} />;
  return <UpiIcon size={size} />;
}

function txIcon(type: string) {
  if (type === "deposit") return { name: "arrow-down-circle" as const, color: C.green };
  if (type === "withdraw") return { name: "arrow-up-circle" as const, color: C.red };
  if (type === "win") return { name: "trophy" as const, color: C.gold };
  return { name: "remove-circle" as const, color: C.textMuted };
}

declare const window: Window & {
  Razorpay?: new (opts: Record<string, unknown>) => { open(): void };
};

async function loadRazorpayScript(): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") { resolve(false); return; }
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function WalletScreen() {
  const { state: authState, refreshBalance } = useAuth();
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [upiId, setUpiId] = useState("");
  const [tab, setTab] = useState<"deposit" | "withdraw" | "history">("deposit");
  const [loading, setLoading] = useState(false);
  const [selectedAmt, setSelectedAmt] = useState<number>(500);
  const [selectedMethod, setSelectedMethod] = useState<PayMethod>("gpay");
  const [rzpConfig, setRzpConfig] = useState<{ keyId: string | null; enabled: boolean } | null>(null);

  useEffect(() => {
    api.getPaymentConfig(authState.token ?? undefined).then(setRzpConfig).catch(() => { });
  }, [authState.token]);

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

  async function handleDeposit() {
    if (!authState.token || !authState.user) { Alert.alert("Sign In Required"); return; }
    if (!rzpConfig?.enabled || !rzpConfig.keyId) {
      Alert.alert("Payment Unavailable", "Payment gateway is not configured yet. Please contact support.");
      return;
    }
    setLoading(true);
    try {
      const order = await api.createPaymentOrder(authState.token, selectedAmt);
      if (Platform.OS === "web") {
        const loaded = await loadRazorpayScript();
        if (!loaded || !window.Razorpay) {
          Alert.alert("Error", "Could not load payment gateway. Please try again.");
          setLoading(false);
          return;
        }
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: "Aviator",
          description: `Add ₹${selectedAmt} to wallet`,
          image: "",
          theme: { color: "#CC0022" },
          modal: { backdropclose: false },
          config: {
            display: {
              blocks: {
                upi_block: {
                  name: "Pay via UPI",
                  instruments: [
                    { method: "upi", flows: ["collect", "intent"], apps: ["google_pay", "phonepe", "paytm", "bhim"] },
                  ],
                },
              },
              sequence: ["block.upi_block"],
              preferences: { show_default_blocks: true },
            },
          },
          prefill: { name: authState.user.username },
          handler: async (resp: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              const result = await api.verifyPayment(authState.token!, {
                paymentId: resp.razorpay_payment_id,
                orderId: resp.razorpay_order_id,
                signature: resp.razorpay_signature,
                amount: order.amount,
              });
              await refreshBalance();
              Alert.alert("Payment Successful! 🎉", `₹${result.amount} added to your wallet.\nNew Balance: ₹${result.balance.toLocaleString("en-IN")}`);
            } catch (e) {
              Alert.alert("Verification Failed", e instanceof Error ? e.message : "Contact support with payment ID: " + resp.razorpay_payment_id);
            }
            setLoading(false);
          },
        });
        rzp.open();
        setLoading(false);
      } else {
        const payUrl = `https://checkout.razorpay.com/v1/payment-button?key=${order.keyId}&order_id=${order.orderId}`;
        await WebBrowser.openBrowserAsync(payUrl);
        setLoading(false);
        Alert.alert("Check your balance", "If payment was successful, your balance will update shortly.");
        await refreshBalance();
      }
    } catch (e) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Please try again");
      setLoading(false);
    }
  }

  async function handleWithdraw() {
    const amt = parseInt(withdrawAmt, 10);
    if (isNaN(amt) || amt < 200) { Alert.alert("Invalid", "Minimum withdrawal is ₹200"); return; }
    if (!upiId.trim()) { Alert.alert("UPI ID Required", "Enter your UPI ID or phone number"); return; }
    if (!authState.token) { Alert.alert("Sign In Required"); return; }
    Alert.alert(
      "Confirm Withdrawal",
      `Withdraw ₹${amt.toLocaleString("en-IN")} to:\n${upiId}\n\nProcessed within 24 hours.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setLoading(true);
            try {
              await api.withdraw(authState.token!, amt, upiId);
              await refreshBalance();
              Alert.alert("Requested!", `₹${amt.toLocaleString("en-IN")} withdrawal submitted.\nYou'll receive it within 24 hours.`);
              setWithdrawAmt(""); setUpiId("");
            } catch (e) {
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
        <Text style={styles.screenTitle}>Wallet</Text>

        {/* Balance Card */}
        <LinearGradient colors={["rgba(200,0,40,0.25)", "rgba(60,0,15,0.15)"]} style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLbl}>TOTAL BALANCE</Text>
              <Text style={styles.balanceAmt}>₹{balance.toLocaleString("en-IN")}</Text>
            </View>
            <View style={styles.walletIconBox}>
              <Ionicons name="wallet" size={30} color={C.gold} />
            </View>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => setTab("deposit")}>
              <Ionicons name="add-circle" size={16} color={C.green} />
              <Text style={[styles.quickBtnText, { color: C.green }]}>Add Money</Text>
            </TouchableOpacity>
            <View style={styles.quickDivider} />
            <TouchableOpacity style={styles.quickBtn} onPress={() => setTab("withdraw")}>
              <Ionicons name="arrow-up-circle" size={16} color={C.red} />
              <Text style={[styles.quickBtnText, { color: C.red }]}>Withdraw</Text>
            </TouchableOpacity>
            <View style={styles.quickDivider} />
            <TouchableOpacity style={styles.quickBtn} onPress={() => setTab("history")}>
              <Ionicons name="receipt" size={16} color={C.textMuted} />
              <Text style={[styles.quickBtnText, { color: C.textMuted }]}>History</Text>
            </TouchableOpacity>
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
            <Text style={styles.sectionTitle}>SELECT AMOUNT</Text>
            <View style={styles.amtGrid}>
              {AMOUNTS.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.amtChip, selectedAmt === a && styles.amtChipActive]}
                  onPress={() => setSelectedAmt(a)}
                >
                  <Text style={[styles.amtChipText, selectedAmt === a && styles.amtChipTextActive]}>
                    ₹{a >= 1000 ? `${a / 1000}K` : a}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>PAYMENT METHOD</Text>
            <View style={styles.methodGrid}>
              {PAY_METHODS.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.methodCard, { backgroundColor: m.bg, borderColor: selectedMethod === m.id ? m.color : "rgba(255,255,255,0.08)" }]}
                  onPress={() => setSelectedMethod(m.id)}
                >
                  <PayMethodIcon id={m.id} size={32} />
                  <Text style={[styles.methodLabel, { color: selectedMethod === m.id ? m.color : C.textMuted }]}>{m.label}</Text>
                  {selectedMethod === m.id && (
                    <View style={[styles.methodCheck, { backgroundColor: m.color }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Pay Summary */}
            <LinearGradient colors={["rgba(0,200,83,0.1)", "rgba(0,100,40,0.05)"]} style={styles.paySummary}>
              <View style={styles.paySummaryRow}>
                <Text style={styles.paySummaryLabel}>Amount</Text>
                <Text style={styles.paySummaryValue}>₹{selectedAmt.toLocaleString("en-IN")}</Text>
              </View>
              {selectedAmt >= 1000 && (
                <View style={styles.paySummaryRow}>
                  <Text style={[styles.paySummaryLabel, { color: C.green }]}>Bonus</Text>
                  <Text style={[styles.paySummaryValue, { color: C.green }]}>+₹{Math.floor(selectedAmt * 0.1).toLocaleString("en-IN")}</Text>
                </View>
              )}
              <View style={[styles.paySummaryRow, { marginTop: 4 }]}>
                <Text style={[styles.paySummaryLabel, { color: C.text }]}>You get</Text>
                <Text style={[styles.paySummaryValue, { color: C.gold, fontSize: 16 }]}>
                  ₹{(selectedAmt >= 1000 ? Math.floor(selectedAmt * 1.1) : selectedAmt).toLocaleString("en-IN")}
                </Text>
              </View>
            </LinearGradient>

            <TouchableOpacity onPress={handleDeposit} disabled={loading || !authState.user} activeOpacity={0.85}>
              <LinearGradient
                colors={authState.user ? ["#00C853", "#009C41"] : ["rgba(0,60,30,0.3)", "rgba(0,40,20,0.2)"]}
                style={styles.payBtn}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : (
                    <View style={styles.payBtnInner}>
                      <Ionicons name="lock-closed" size={16} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.payBtnText}>
                        {authState.user ? `PAY ₹${selectedAmt.toLocaleString("en-IN")} SECURELY` : "SIGN IN TO DEPOSIT"}
                      </Text>
                    </View>
                  )
                }
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.secureRow}>
              <Ionicons name="shield-checkmark" size={13} color={C.green} />
              <Text style={styles.secureText}>256-bit SSL encrypted · Powered by Razorpay</Text>
            </View>
          </View>
        )}

        {/* WITHDRAW */}
        {tab === "withdraw" && (
          <View>
            <View style={styles.withdrawCard}>
              <Text style={styles.sectionTitle}>WITHDRAWAL AMOUNT</Text>
              <View style={styles.fieldInput}>
                <Text style={styles.fieldPrefix}>₹</Text>
                <TextInput
                  style={styles.fieldInputText}
                  placeholder="Enter amount (min ₹200)"
                  placeholderTextColor={C.textMuted}
                  value={withdrawAmt}
                  onChangeText={setWithdrawAmt}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.wdQuickRow}>
                {[200, 500, 1000, 2000].map(a => (
                  <TouchableOpacity key={a} style={styles.wdQuickChip} onPress={() => setWithdrawAmt(String(a))}>
                    <Text style={styles.wdQuickText}>₹{a >= 1000 ? `${a / 1000}K` : a}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>UPI DETAILS</Text>
              <View style={styles.fieldInput}>
                <Ionicons name="phone-portrait-outline" size={18} color={C.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.fieldInputText}
                  placeholder="UPI ID (eg: name@upi) or Phone No."
                  placeholderTextColor={C.textMuted}
                  value={upiId}
                  onChangeText={setUpiId}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={15} color={C.orange} />
                <Text style={styles.infoText}>Withdrawals are processed manually within 24 hours. Balance is deducted instantly.</Text>
              </View>

              <TouchableOpacity onPress={handleWithdraw} disabled={loading || !authState.user} activeOpacity={0.85}>
                <LinearGradient colors={["#FF4060", "#CC0030"]} style={styles.withdrawBtn}>
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.withdrawBtnText}>REQUEST WITHDRAWAL</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* HISTORY */}
        {tab === "history" && (
          <View>
            {txLoading ? (
              <View style={styles.loadingBox}><ActivityIndicator color={C.red} size="large" /></View>
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
                      <Text style={[styles.txStatus, { color: tx.status === "completed" ? C.green : tx.status === "pending" ? C.orange : C.red }]}>
                        {tx.status}
                      </Text>
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
  screenTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 18 },
  balanceCard: { borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 18, marginBottom: 18 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  balanceLbl: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 1.5, marginBottom: 4 },
  balanceAmt: { fontSize: 34, fontFamily: "Inter_700Bold", color: C.gold, letterSpacing: -1 },
  walletIconBox: { width: 54, height: 54, borderRadius: 16, backgroundColor: "rgba(255,215,0,0.12)", alignItems: "center", justifyContent: "center" },
  balanceDivider: { height: 1, backgroundColor: C.border, marginBottom: 14 },
  quickRow: { flexDirection: "row", alignItems: "center" },
  quickBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 4 },
  quickDivider: { width: 1, height: 20, backgroundColor: C.border },
  quickBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tabs: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 14, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: C.primary },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textMuted },
  tabTextActive: { color: "#FFFFFF" },
  sectionTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 2, marginBottom: 12 },
  amtGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  amtChip: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.35)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)" },
  amtChipActive: { backgroundColor: "rgba(200,0,34,0.25)", borderColor: C.primaryBright },
  amtChipText: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.textMuted },
  amtChipTextActive: { color: "#FFFFFF" },
  methodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  methodCard: { width: "47%", borderRadius: 14, borderWidth: 1.5, padding: 14, alignItems: "center", gap: 8, position: "relative" },
  methodLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  methodCheck: { position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  paySummary: { borderRadius: 14, padding: 14, marginTop: 18, marginBottom: 16, borderWidth: 1, borderColor: "rgba(0,200,83,0.15)" },
  paySummaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  paySummaryLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textMuted },
  paySummaryValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text },
  payBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  payBtnInner: { flexDirection: "row", alignItems: "center" },
  payBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 10 },
  secureText: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textDim },
  withdrawCard: { gap: 0 },
  fieldInput: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10 },
  fieldPrefix: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.gold, marginRight: 6 },
  fieldInputText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: C.text },
  wdQuickRow: { flexDirection: "row", gap: 8, marginBottom: 0 },
  wdQuickChip: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: C.border, alignItems: "center" },
  wdQuickText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textMuted },
  infoBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "rgba(255,107,0,0.08)", borderRadius: 10, padding: 12, marginTop: 10, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,107,0,0.2)" },
  infoText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted, lineHeight: 16 },
  withdrawBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  withdrawBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1.5 },
  loadingBox: { height: 160, alignItems: "center", justifyContent: "center" },
  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textDim },
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txInfo: { flex: 1 },
  txType: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  txNote: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted, marginTop: 1 },
  txStatus: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  txDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textDim, marginTop: 2 },
});
