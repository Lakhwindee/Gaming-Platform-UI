import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, AppState, AppStateStatus, Image,
  Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import C from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { api, ApiTransaction, UpiInitResult } from "@/lib/api";
const AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

type PayMethod = "gpay" | "phonepe" | "paytm" | "upi";
type PayState = "idle" | "initiating" | "waiting" | "confirming" | "success";

const PAY_METHODS: { id: PayMethod; label: string; color: string; bg: string }[] = [
  { id: "gpay",    label: "Google Pay", color: "#34A853", bg: "rgba(52,168,83,0.15)" },
  { id: "phonepe", label: "PhonePe",   color: "#6739B7", bg: "rgba(103,57,183,0.15)" },
  { id: "paytm",   label: "Paytm",     color: "#00BAF2", bg: "rgba(0,186,242,0.15)" },
  { id: "upi",     label: "Other UPI", color: "#FF6B00", bg: "rgba(255,107,0,0.15)" },
];

function buildUpiParams(amount: number, merchantUpi: string, txnRef: string): string {
  const name = encodeURIComponent("Blaze");
  const note = encodeURIComponent("Blaze Deposit " + txnRef);
  return "pa=" + merchantUpi + "&pn=" + name + "&am=" + amount + "&cu=INR&tn=" + note + "&tr=" + txnRef;
}

function buildUpiUrl(method: PayMethod, amount: number, merchantUpi: string, txnRef: string): string {
  const p = buildUpiParams(amount, merchantUpi, txnRef);
  if (method === "gpay")    return "tez://upi/pay?" + p;
  if (method === "phonepe") return "phonepe://pay?" + p;
  if (method === "paytm")   return "paytmmp://upi/pay?" + p;
  return "upi://pay?" + p;
}

function GPay({ size = 28 }: { size?: number }) {
  return (
    <Image
      source={require("@/assets/images/gpay-logo.png")}
      style={{ width: size, height: size, borderRadius: size * 0.2 }}
      resizeMode="contain"
    />
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
    <Image
      source={require("@/assets/images/paytm-logo.png")}
      style={{ width: size, height: size, borderRadius: size * 0.2 }}
      resizeMode="contain"
    />
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
  if (id === "gpay")    return <GPay size={size} />;
  if (id === "phonepe") return <PhonePeIcon size={size} />;
  if (id === "paytm")   return <PaytmIcon size={size} />;
  return <UpiIcon size={size} />;
}

function txIcon(type: string) {
  if (type === "deposit")  return { name: "arrow-down-circle" as const, color: C.green };
  if (type === "withdraw") return { name: "arrow-up-circle"   as const, color: C.red };
  if (type === "win")      return { name: "trophy"            as const, color: C.gold };
  return { name: "remove-circle" as const, color: C.textMuted };
}

export default function WalletScreen() {
  const { state: authState, refreshBalance } = useAuth();
  const insets = useSafeAreaInsets();

  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [txLoading,    setTxLoading]    = useState(false);
  const [tab,          setTab]          = useState<"deposit" | "withdraw" | "history">("deposit");
  const [loading,      setLoading]      = useState(false);

  const [selectedAmt,    setSelectedAmt]    = useState<number | null>(500);
  const [customAmt,      setCustomAmt]      = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PayMethod>("gpay");

  const [payState,    setPayState]    = useState<PayState>("idle");
  const [pendingTxn,  setPendingTxn]  = useState<UpiInitResult | null>(null);
  const [utrInput,    setUtrInput]    = useState("");
  const [confirming,  setConfirming]  = useState(false);

  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [upiId,       setUpiId]       = useState("");
  const [autoFailMsg,  setAutoFailMsg]  = useState("");
  const [noAppFound,   setNoAppFound]   = useState(false);

  const appStateRef    = useRef(AppState.currentState);
  const tokenRef       = useRef(authState.token);
  const pendingTxnRef  = useRef(pendingTxn);
  const upiAppOpenedRef = useRef(false);

  useEffect(() => { tokenRef.current      = authState.token; }, [authState.token]);
  useEffect(() => { pendingTxnRef.current = pendingTxn;      }, [pendingTxn]);

  const finalAmount = (() => {
    if (customAmt.trim()) {
      const v = parseInt(customAmt.replace(/[^0-9]/g, ""), 10);
      return isNaN(v) ? 0 : v;
    }
    return selectedAmt ?? 0;
  })();

  const bonus = finalAmount >= 1000 ? Math.floor(finalAmount * 0.1) : 0;

  useEffect(() => {
    if (payState !== "waiting") return;
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && next === "active") {
        if (upiAppOpenedRef.current) {
          // User returned from UPI app — ask if they actually paid (NO auto-credit)
          setPayState("confirming");
          setAutoFailMsg("");
        }
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [payState]);

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
    if (finalAmount < 100) { Alert.alert("Minimum ₹100", "Please enter at least ₹100"); return; }
    if (finalAmount > 100000) { Alert.alert("Too High", "Maximum deposit is ₹1,00,000"); return; }

    setLoading(true);
    setPayState("initiating");
    setNoAppFound(false);
    upiAppOpenedRef.current = false;

    try {
      const txn = await api.upiInitiate(authState.token, finalAmount, selectedMethod);
      setPendingTxn(txn);
      setUtrInput("");
      setAutoFailMsg("");
      setPayState("waiting");

      const specificUrl = buildUpiUrl(selectedMethod, finalAmount, txn.merchantUpi, txn.txnRef);
      const genericUrl  = "upi://pay?" + buildUpiParams(finalAmount, txn.merchantUpi, txn.txnRef);

      let opened = false;
      try {
        const canOpen = await Linking.canOpenURL(specificUrl);
        if (canOpen) {
          await Linking.openURL(specificUrl);
          opened = true;
        } else {
          // Specific app not installed — try generic UPI
          await Linking.openURL(genericUrl);
          opened = true;
        }
      } catch {
        try {
          await Linking.openURL(genericUrl);
          opened = true;
        } catch {
          setNoAppFound(true);
        }
      }
      upiAppOpenedRef.current = opened;
    } catch (e) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Please try again");
      setPayState("idle");
      upiAppOpenedRef.current = false;
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmPaid() {
    if (!authState.token || !pendingTxn) return;
    const utr = utrInput.trim();
    if (!utr) return;
    setConfirming(true);
    setAutoFailMsg("");
    try {
      await api.upiConfirm(authState.token, pendingTxn.txnRef, utr);
      await refreshBalance();
      upiAppOpenedRef.current = false;
      setPayState("success");
      setTimeout(() => {
        setPayState("idle");
        setPendingTxn(null);
        setUtrInput("");
        setCustomAmt("");
        setSelectedAmt(500);
        setAutoFailMsg("");
      }, 3000);
    } catch (e) {
      setAutoFailMsg(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setConfirming(false);
    }
  }

  function handleCancelPayment() {
    setPayState("idle");
    setPendingTxn(null);
    setUtrInput("");
    setAutoFailMsg("");
    setNoAppFound(false);
    upiAppOpenedRef.current = false;
  }

  async function handleWithdraw() {
    const amt = parseInt(withdrawAmt, 10);
    if (isNaN(amt) || amt < 200) { Alert.alert("Invalid", "Minimum withdrawal is ₹200"); return; }
    if (!upiId.trim()) { Alert.alert("UPI ID Required", "Enter your UPI ID or phone number"); return; }
    if (!authState.token) { Alert.alert("Sign In Required"); return; }
    Alert.alert(
      "Confirm Withdrawal",
      "Withdraw ₹" + amt.toLocaleString("en-IN") + " to:\n" + upiId + "\n\nProcessed within 24 hours.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setLoading(true);
            try {
              await api.withdraw(authState.token!, amt, upiId);
              await refreshBalance();
              Alert.alert("Requested!", "₹" + amt.toLocaleString("en-IN") + " withdrawal submitted.\nYou'll receive it within 24 hours.");
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
  const methodInfo = PAY_METHODS.find(m => m.id === selectedMethod)!;

  return (
    <LinearGradient colors={[C.bgGrad1, C.bgGrad2, "#0A0018"]} style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          paddingBottom: insets.bottom + 90,
        }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
            {/* Payment Waiting / Confirming overlay */}
            {(payState === "waiting" || payState === "confirming" || payState === "success") && pendingTxn && (
              <View style={styles.payPendingBox}>
                {payState === "success" ? (
                  <>
                    <View style={styles.successIcon}>
                      <Ionicons name="checkmark-circle" size={52} color={C.green} />
                    </View>
                    <Text style={styles.payPendingTitle}>Payment Confirmed!</Text>
                    <Text style={styles.payPendingSubtitle}>
                      ₹{pendingTxn.total.toLocaleString("en-IN")} added to your wallet
                    </Text>
                  </>
                ) : (
                  <>
                    <View style={styles.payPendingIconRow}>
                      <PayMethodIcon id={selectedMethod} size={40} />
                      <View style={styles.payPendingDots}>
                        {[0, 1, 2].map(i => (
                          <View key={i} style={[styles.dot, { opacity: 0.3 + i * 0.35 }]} />
                        ))}
                      </View>
                      <View style={styles.walletDot}>
                        <Ionicons name="wallet" size={22} color={C.gold} />
                      </View>
                    </View>

                    {/* Auto-verifying spinner */}
                    {confirming && (
                      <View style={styles.verifyingRow}>
                        <ActivityIndicator color={methodInfo.color} size="small" />
                        <Text style={[styles.verifyingText, { color: methodInfo.color }]}>
                          Verifying payment…
                        </Text>
                      </View>
                    )}

                    {!confirming && (
                      <Text style={styles.payPendingTitle}>
                        {payState === "confirming"
                          ? "Did you complete the payment?"
                          : "Complete Payment in " + methodInfo.label}
                      </Text>
                    )}

                    <Text style={styles.payPendingSubtitle}>
                      Pay ₹{pendingTxn.amount.toLocaleString("en-IN")} to{"\n"}
                      <Text style={{ color: C.gold, fontFamily: "Inter_700Bold" }}>{pendingTxn.merchantUpi}</Text>
                    </Text>
                    <Text style={styles.txnRefText}>Ref: {pendingTxn.txnRef}</Text>

                    {/* Failed verification — show manual retry */}
                    {payState === "confirming" && autoFailMsg && !confirming && (
                      <View style={styles.failBox}>
                        <Ionicons name="warning-outline" size={15} color={C.orange} />
                        <Text style={styles.failText}>{autoFailMsg}</Text>
                      </View>
                    )}

                    {payState === "confirming" && !confirming && (
                      <>
                        <View style={styles.utrHintBox}>
                          <Text style={styles.utrHintStep}>
                            <Text style={styles.utrHintBold}>Google Pay</Text> → Activity → Payment tap karo → copy{" "}
                            <Text style={styles.utrHintBold}>UPI Transaction ID</Text>
                          </Text>
                        </View>
                        <View style={styles.utrFieldWrap}>
                          <Text style={styles.utrFieldLabel}>TRANSACTION ID / UTR</Text>
                          <View style={[styles.utrFieldRow, utrInput.length > 0 && { borderColor: C.green }]}>
                            <TextInput
                              style={styles.utrFieldInput}
                              placeholder="Paste here from Google Pay"
                              placeholderTextColor={C.textDim}
                              value={utrInput}
                              onChangeText={v => { setUtrInput(v); setAutoFailMsg(""); }}
                              autoFocus
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                            {utrInput.length > 0 && (
                              <Ionicons name="checkmark-circle" size={20} color={C.green} />
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[styles.confirmUtrBtn, { opacity: utrInput.trim().length > 0 ? 1 : 0.4 }]}
                          onPress={handleConfirmPaid}
                          disabled={utrInput.trim().length === 0}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="checkmark-circle" size={18} color="#fff" />
                          <Text style={styles.confirmUtrText}>CONFIRM PAYMENT</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.didntPayBtn} onPress={handleCancelPayment} activeOpacity={0.7}>
                          <Text style={styles.didntPayText}>I didn't pay — Cancel</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {payState === "waiting" && !confirming && noAppFound && (
                      <View style={styles.manualUpiBox}>
                        <Text style={styles.manualUpiTitle}>No UPI app found — pay manually</Text>
                        <View style={styles.manualUpiRow}>
                          <Text style={styles.manualUpiLabel}>UPI ID</Text>
                          <Text style={styles.manualUpiValue}>{pendingTxn.merchantUpi}</Text>
                        </View>
                        <View style={styles.manualUpiRow}>
                          <Text style={styles.manualUpiLabel}>Amount</Text>
                          <Text style={[styles.manualUpiValue, { color: C.gold }]}>
                            ₹{pendingTxn.amount.toLocaleString("en-IN")}
                          </Text>
                        </View>
                        <View style={styles.manualUpiRow}>
                          <Text style={styles.manualUpiLabel}>Ref</Text>
                          <Text style={styles.manualUpiValue}>{pendingTxn.txnRef}</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.paidBtn, { backgroundColor: methodInfo.color, marginTop: 8 }]}
                          onPress={() => setPayState("confirming")}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.paidBtnText}>I'VE PAID</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {payState === "waiting" && !confirming && !noAppFound && (
                      <TouchableOpacity onPress={handleDeposit} style={styles.reopenBtn} activeOpacity={0.7}>
                        <Ionicons name="refresh" size={14} color={C.textMuted} />
                        <Text style={styles.reopenText}>Reopen {methodInfo.label}</Text>
                      </TouchableOpacity>
                    )}

                    {payState === "waiting" && !confirming && (
                      <TouchableOpacity onPress={handleCancelPayment} style={styles.cancelPayBtn} activeOpacity={0.7}>
                        <Text style={styles.cancelPayText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}

            {payState === "idle" && (
              <>
                <Text style={styles.sectionTitle}>SELECT AMOUNT</Text>
                <View style={styles.amtGrid}>
                  {AMOUNTS.map(a => (
                    <TouchableOpacity
                      key={a}
                      style={[styles.amtChip, selectedAmt === a && !customAmt && styles.amtChipActive]}
                      onPress={() => { setSelectedAmt(a); setCustomAmt(""); }}
                    >
                      <Text style={[styles.amtChipText, selectedAmt === a && !customAmt && styles.amtChipTextActive]}>
                        ₹{a >= 1000 ? a / 1000 + "K" : a}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom amount input */}
                <View style={styles.customAmtRow}>
                  <Text style={styles.customAmtPrefix}>₹</Text>
                  <TextInput
                    style={styles.customAmtInput}
                    placeholder="Enter custom amount"
                    placeholderTextColor={C.textDim}
                    value={customAmt}
                    onChangeText={v => {
                      const clean = v.replace(/[^0-9]/g, "");
                      setCustomAmt(clean);
                      if (clean) setSelectedAmt(null);
                    }}
                    keyboardType="numeric"
                    maxLength={7}
                  />
                  {customAmt.length > 0 && (
                    <TouchableOpacity onPress={() => { setCustomAmt(""); setSelectedAmt(500); }}>
                      <Ionicons name="close-circle" size={18} color={C.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>PAYMENT METHOD</Text>
                <View style={styles.methodGrid}>
                  {PAY_METHODS.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.methodCard, {
                        backgroundColor: m.bg,
                        borderColor: selectedMethod === m.id ? m.color : "rgba(255,255,255,0.08)",
                      }]}
                      onPress={() => setSelectedMethod(m.id)}
                    >
                      <PayMethodIcon id={m.id} size={34} />
                      <Text style={[styles.methodLabel, { color: selectedMethod === m.id ? m.color : C.textMuted }]}>
                        {m.label}
                      </Text>
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
                    <Text style={styles.paySummaryValue}>
                      {finalAmount > 0 ? "₹" + finalAmount.toLocaleString("en-IN") : "—"}
                    </Text>
                  </View>
                  {bonus > 0 && (
                    <View style={styles.paySummaryRow}>
                      <Text style={[styles.paySummaryLabel, { color: C.green }]}>Bonus (10%)</Text>
                      <Text style={[styles.paySummaryValue, { color: C.green }]}>+₹{bonus.toLocaleString("en-IN")}</Text>
                    </View>
                  )}
                  <View style={[styles.paySummaryRow, { marginTop: 4 }]}>
                    <Text style={[styles.paySummaryLabel, { color: C.text }]}>You get</Text>
                    <Text style={[styles.paySummaryValue, { color: C.gold, fontSize: 16 }]}>
                      {finalAmount > 0 ? "₹" + (finalAmount + bonus).toLocaleString("en-IN") : "—"}
                    </Text>
                  </View>
                </LinearGradient>

                <TouchableOpacity
                  onPress={handleDeposit}
                  disabled={loading || !authState.user || finalAmount < 100}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={authState.user && finalAmount >= 100 ? ["#00C853", "#009C41"] : ["rgba(0,60,30,0.3)", "rgba(0,40,20,0.2)"]}
                    style={styles.payBtn}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : (
                        <View style={styles.payBtnInner}>
                          <Ionicons name="lock-closed" size={16} color="#fff" style={{ marginRight: 8 }} />
                          <Text style={styles.payBtnText}>
                            {!authState.user
                              ? "SIGN IN TO DEPOSIT"
                              : finalAmount >= 100
                                ? "PAY ₹" + finalAmount.toLocaleString("en-IN") + " SECURELY"
                                : "ENTER AMOUNT (MIN ₹100)"}
                          </Text>
                        </View>
                      )
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.secureRow}>
                  <Ionicons name="shield-checkmark" size={13} color={C.green} />
                  <Text style={styles.secureText}>256-bit SSL encrypted · UPI Payments</Text>
                </View>
              </>
            )}
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
                    <Text style={styles.wdQuickText}>₹{a >= 1000 ? a / 1000 + "K" : a}</Text>
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
  customAmtRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)", paddingHorizontal: 14, paddingVertical: 12, marginTop: 12 },
  customAmtPrefix: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.gold, marginRight: 6 },
  customAmtInput: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular", color: C.text },
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
  payPendingBox: { backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 24, alignItems: "center", gap: 12, marginBottom: 16 },
  payPendingIconRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  payPendingDots: { flexDirection: "row", gap: 5, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  walletDot: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,215,0,0.15)", alignItems: "center", justifyContent: "center" },
  verifyingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  verifyingText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  failBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "rgba(255,107,0,0.1)", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "rgba(255,107,0,0.2)", width: "100%" },
  failText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: C.orange, lineHeight: 17 },
  payPendingTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text, textAlign: "center", marginTop: 4 },
  payPendingSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center", lineHeight: 20 },
  txnRefText: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textDim, letterSpacing: 0.5 },
  utrHintBox: { width: "100%", backgroundColor: "rgba(255,215,0,0.07)", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "rgba(255,215,0,0.18)" },
  utrHintStep: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted, lineHeight: 18, textAlign: "center" },
  utrHintBold: { fontFamily: "Inter_700Bold", color: C.gold },
  utrFieldWrap: { width: "100%", gap: 6 },
  utrFieldLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: C.textMuted, letterSpacing: 1.2 },
  utrFieldRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 10, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  utrFieldInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },
  confirmUtrBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.green, borderRadius: 14, paddingVertical: 14 },
  confirmUtrText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  didntPayBtn: { paddingVertical: 8 },
  didntPayText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.red, textAlign: "center" },
  paidBtn: { width: "100%", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  paidBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  reopenBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6 },
  reopenText: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted },
  cancelPayBtn: { paddingVertical: 6 },
  cancelPayText: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.red },
  successIcon: { marginBottom: 4 },
  manualUpiBox: { width: "100%", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 14, gap: 8 },
  manualUpiTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textMuted, textAlign: "center", marginBottom: 4 },
  manualUpiRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  manualUpiLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textDim },
  manualUpiValue: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.text },
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
