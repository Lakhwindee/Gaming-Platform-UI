import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Dimensions, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from "react-native-svg";
import C from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { WSC, wsSend } from "@/lib/wsClient";

const { width: SW } = Dimensions.get("window");
const CV_W = SW - 32;
const CV_H = 260;
const ORIG_X = CV_W * 0.09;
const ORIG_Y = CV_H * 0.88;

function calcMult(elapsed: number): number {
  return Math.floor(Math.pow(Math.E, 0.077 * elapsed) * 100) / 100;
}
function getPos(elapsed: number, mult: number): { x: number; y: number } {
  const tX = Math.min(elapsed / 22, 1);
  const x = ORIG_X + tX * CV_W * 0.82;
  const tY = Math.min(Math.log(Math.max(mult, 1)) / Math.log(28), 1);
  const y = ORIG_Y - tY * CV_H * 0.80;
  return { x, y };
}

const STARS = Array.from({ length: 80 }, (_, i) => ({
  x: (Math.sin(i * 137.5) * 0.5 + 0.5) * CV_W,
  y: (Math.cos(i * 239.3) * 0.5 + 0.5) * CV_H * 0.9,
  r: 0.5 + (i % 3) * 0.5,
}));

function RocketShape({ phase }: { phase: string }) {
  const SIZE = 22;
  return (
    <>
      {phase === "flying" && (
        <>
          <Path d={`M -6 ${SIZE * 0.4} L 0 ${SIZE * 1.6} L 6 ${SIZE * 0.4}`} fill="#FF6B00" opacity={0.8} />
          <Path d={`M -3 ${SIZE * 0.4} L 0 ${SIZE * 1.2} L 3 ${SIZE * 0.4}`} fill="#FFD700" opacity={0.9} />
        </>
      )}
      <Path d={`M 0 -${SIZE} C 6 -${SIZE * 0.6} 8 0 8 ${SIZE * 0.4} L -8 ${SIZE * 0.4} C -8 0 -6 -${SIZE * 0.6} 0 -${SIZE} Z`} fill="#ECECEC" />
      <Path d={`M -8 ${SIZE * 0.4} L -14 ${SIZE} L -8 ${SIZE * 0.8} Z`} fill="#C0C0C0" />
      <Path d={`M 8 ${SIZE * 0.4} L 14 ${SIZE} L 8 ${SIZE * 0.8} Z`} fill="#C0C0C0" />
      <Path d={`M -4 -${SIZE * 0.3} C -2 -${SIZE * 0.5} 2 -${SIZE * 0.5} 4 -${SIZE * 0.3} C 4 0 -4 0 -4 -${SIZE * 0.3} Z`} fill="#88CCFF" opacity={0.7} />
    </>
  );
}

function GameCanvas({ phase, mult, countdown, elapsed }: {
  phase: string; mult: number; countdown: number; elapsed: number;
}) {
  const pos = (phase === "flying" || phase === "crashed")
    ? getPos(elapsed, mult)
    : { x: ORIG_X + 10, y: ORIG_Y - 20 };

  let pathD = `M ${ORIG_X} ${ORIG_Y}`;
  if (phase === "flying" || phase === "crashed") {
    const steps = 40;
    for (let i = 1; i <= steps; i++) {
      const t = elapsed * (i / steps);
      const p = getPos(t, calcMult(t));
      pathD += ` L ${p.x} ${p.y}`;
    }
  }

  const dT = 0.3;
  const e0 = Math.max(elapsed - dT, 0.001);
  const e1 = elapsed + dT;
  const pA = getPos(e0, calcMult(e0));
  const pB = getPos(e1, calcMult(e1));
  const angle = Math.atan2(pB.y - pA.y, pB.x - pA.x);
  const angleDeg = (angle * 180) / Math.PI;

  const mColor = phase === "crashed" ? "#FF1A3A" : mult >= 10 ? "#FFD700" : mult >= 3 ? "#FF6B00" : "#FFFFFF";

  return (
    <View style={styles.canvas}>
      <Svg width={CV_W} height={CV_H}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={mColor} stopOpacity={0.15} />
            <Stop offset="100%" stopColor={mColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {STARS.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={0.4 + (i % 3) * 0.2} />
        ))}
        {(phase === "flying" || phase === "crashed") && (
          <>
            <Path d={pathD} stroke="rgba(255,107,0,0.25)" strokeWidth={8} fill="none" strokeLinecap="round" />
            <Path d={pathD} stroke="rgba(255,107,0,0.5)" strokeWidth={3} fill="none" strokeLinecap="round" />
            <Path d={pathD} stroke="#FFD700" strokeWidth={1.5} fill="none" strokeLinecap="round" />
            <Circle cx={pos.x} cy={pos.y} r={18} fill="url(#glow)" />
          </>
        )}
        <G x={pos.x} y={pos.y} rotation={angleDeg} originX={0} originY={0}>
          <RocketShape phase={phase} />
        </G>
      </Svg>

      {phase === "flying" && (
        <View style={[StyleSheet.absoluteFill, styles.multOverlay]} pointerEvents="none">
          <Text style={[styles.multText, { color: mColor, textShadowColor: mColor }]}>{mult.toFixed(2)}x</Text>
        </View>
      )}
      {phase === "waiting" && (
        <View style={[StyleSheet.absoluteFill, styles.multOverlay]} pointerEvents="none">
          <Text style={styles.countLabel}>NEXT ROUND IN</Text>
          <Text style={[styles.multText, { color: C.red }]}>{countdown}s</Text>
        </View>
      )}
      {phase === "crashed" && (
        <View style={[StyleSheet.absoluteFill, styles.multOverlay]} pointerEvents="none">
          <Text style={[styles.multText, { color: "#FF1A3A", textShadowColor: "#FF1A3A" }]}>{mult.toFixed(2)}x</Text>
          <Text style={styles.crashedLabel}>FLEW AWAY</Text>
        </View>
      )}
    </View>
  );
}

export default function GameScreen() {
  const { state: authState } = useAuth();
  const insets = useSafeAreaInsets();
  const [, setTick] = useState(0);
  const [betAmount, setBetAmount] = useState(100);
  const [betInput, setBetInput] = useState("100");
  const [hasActiveBet, setHasActiveBet] = useState(false);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [resultMsg, setResultMsg] = useState<{ text: string; win: boolean } | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const hasActiveRef = useRef(false);
  const cashedRef = useRef<number | null>(null);
  const betAmtRef = useRef(100);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wsListener = () => setTick(n => n + 1);
    WSC.listeners.add(wsListener);
    return () => { WSC.listeners.delete(wsListener); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (WSC.state.phase === "flying") {
        const elapsed = (Date.now() - WSC.state.startTime) / 1000;
        setElapsedSec(elapsed);
      } else if (WSC.state.phase === "waiting") {
        setElapsedSec(0);
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const msgHandler = (msg: Record<string, unknown>) => {
      if (msg.type === "cashout_ok") {
        const m = msg.mult as number;
        const payout = msg.payout as number;
        cashedRef.current = m;
        setCashedOutAt(m);
        hasActiveRef.current = false;
        setHasActiveBet(false);
        const profit = payout - betAmtRef.current;
        if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
        setResultMsg({ text: `+₹${profit.toLocaleString("en-IN")} at ${m.toFixed(2)}x`, win: true });
        resultTimerRef.current = setTimeout(() => setResultMsg(null), 5000);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (msg.type === "bet_crash") {
        const m = msg.mult as number;
        if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
        setResultMsg({ text: `-₹${betAmtRef.current.toLocaleString("en-IN")} at ${m.toFixed(2)}x`, win: false });
        resultTimerRef.current = setTimeout(() => setResultMsg(null), 5000);
        hasActiveRef.current = false;
        setHasActiveBet(false);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      if (msg.type === "bet_fail") {
        Alert.alert("Bet Failed", String(msg.error ?? "Please try again"));
        hasActiveRef.current = false;
        setHasActiveBet(false);
      }
      if (msg.type === "cashout_fail") {
        Alert.alert("Cashout Failed", String(msg.error ?? "Please try again"));
      }
      if (msg.type === "state" && (msg as { phase?: string }).phase === "waiting") {
        cashedRef.current = null;
        setCashedOutAt(null);
        if (!hasActiveRef.current) setHasActiveBet(false);
      }
    };
    WSC.msgListeners.add(msgHandler);
    return () => { WSC.msgListeners.delete(msgHandler); };
  }, []);

  const setBet = useCallback((v: number) => {
    const amt = Math.max(1, v);
    setBetAmount(amt);
    betAmtRef.current = amt;
    setBetInput(String(amt));
    if (Platform.OS !== "web") Haptics.selectionAsync();
  }, []);

  function placeBet() {
    if (!authState.user) { Alert.alert("Login Required", "Please login to place bets"); return; }
    if (WSC.state.phase !== "waiting") { Alert.alert("Wait", "Wait for the next round to begin"); return; }
    if (hasActiveRef.current) return;
    if (betAmtRef.current < 1) { Alert.alert("Invalid Amount", "Minimum bet is ₹1"); return; }
    hasActiveRef.current = true;
    setHasActiveBet(true);
    setResultMsg(null);
    wsSend({ type: "place_bet", amount: betAmtRef.current, autoCashout: 0 });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function cashOut() {
    if (!hasActiveRef.current || WSC.state.phase !== "flying" || cashedRef.current) return;
    wsSend({ type: "cashout" });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  const { phase, mult, countdown, history, bots, connected } = WSC.state;
  const displayHistory = history.length ? history.slice(0, 12) : [];
  const canBet = phase === "waiting" && !hasActiveBet && !!authState.user;
  const canCashout = phase === "flying" && hasActiveBet && !cashedOutAt && !!authState.user;
  const potentialWin = Math.floor(betAmtRef.current * mult);

  return (
    <LinearGradient colors={[C.bgGrad1, C.bgGrad2, "#0A0018"]} style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 8),
          paddingBottom: insets.bottom + 90,
        }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top row */}
        <View style={styles.topRow}>
          <View style={styles.balanceChip}>
            <Text style={styles.balanceLabel}>BALANCE</Text>
            <Text style={styles.balanceValue}>
              {authState.user ? `₹${authState.user.balance.toLocaleString("en-IN")}` : "—"}
            </Text>
          </View>
          <View style={styles.appLabel}>
            <Text style={styles.appLabelText}>AVIATOR</Text>
          </View>
          <View style={styles.connectionChip}>
            <View style={[styles.dot, { backgroundColor: connected ? C.green : C.red }]} />
            <Text style={styles.connectionText}>{connected ? "LIVE" : "..."}</Text>
          </View>
        </View>

        {/* History */}
        {displayHistory.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyRow} contentContainerStyle={{ paddingHorizontal: 4 }}>
            {displayHistory.map((v, i) => (
              <View key={i} style={[styles.histChip, {
                backgroundColor: v <= 1.5 ? "rgba(255,26,58,0.2)" : v >= 10 ? "rgba(255,215,0,0.18)" : "rgba(0,200,83,0.15)",
                borderColor: v <= 1.5 ? "rgba(255,26,58,0.3)" : v >= 10 ? "rgba(255,215,0,0.3)" : "transparent",
              }]}>
                <Text style={[styles.histText, { color: v <= 1.5 ? C.red : v >= 10 ? C.gold : C.green }]}>{v.toFixed(2)}x</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Canvas */}
        <GameCanvas phase={phase} mult={mult} countdown={countdown} elapsed={elapsedSec} />

        {/* Result message */}
        {resultMsg && (
          <LinearGradient
            colors={resultMsg.win ? ["rgba(0,200,83,0.22)", "rgba(0,200,83,0.06)"] : ["rgba(255,26,58,0.22)", "rgba(255,26,58,0.06)"]}
            style={styles.resultMsg}
          >
            <Text style={[styles.resultText, { color: resultMsg.win ? C.green : C.red }]}>{resultMsg.text}</Text>
          </LinearGradient>
        )}

        {/* Bet Controls */}
        <View style={styles.betPanel}>
          <View style={styles.betAmtRow}>
            <TouchableOpacity onPress={() => setBet(betAmount - 50)} disabled={!canBet} style={[styles.amtBtn, !canBet && styles.disabled]}>
              <Text style={styles.amtBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.betInputWrap}>
              <Text style={styles.betInputPrefix}>₹</Text>
              <TextInput
                style={styles.betInput}
                value={betInput}
                onChangeText={v => {
                  setBetInput(v);
                  const n = parseInt(v, 10);
                  if (!isNaN(n) && n > 0) { setBetAmount(n); betAmtRef.current = n; }
                }}
                keyboardType="numeric"
                editable={canBet}
                selectTextOnFocus
              />
            </View>
            <TouchableOpacity onPress={() => setBet(betAmount + 50)} disabled={!canBet} style={[styles.amtBtn, !canBet && styles.disabled]}>
              <Text style={styles.amtBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.presetRow}>
            {[100, 250, 500, 1000].map(v => (
              <TouchableOpacity key={v} onPress={() => setBet(v)} disabled={!canBet} style={[styles.presetBtn, betAmount === v && styles.presetBtnActive, !canBet && styles.disabled]}>
                <Text style={[styles.presetText, betAmount === v && styles.presetTextActive]}>₹{v >= 1000 ? "1K" : v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!hasActiveBet ? (
            <TouchableOpacity onPress={placeBet} disabled={!canBet} activeOpacity={0.85}>
              <LinearGradient
                colors={canBet ? ["#00C853", "#009C41"] : ["rgba(0,100,40,0.3)", "rgba(0,60,20,0.3)"]}
                style={styles.mainBtn}
              >
                <Text style={[styles.mainBtnText, !canBet && { color: "#556" }]}>
                  {!authState.user
                    ? "SIGN IN TO PLAY"
                    : phase === "waiting"
                    ? `PLACE BET  ₹${betAmount.toLocaleString("en-IN")}`
                    : phase === "flying"
                    ? "ROUND IN PROGRESS"
                    : "WAIT FOR NEXT ROUND"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={cashOut} disabled={!canCashout} activeOpacity={0.85}>
              <LinearGradient
                colors={canCashout ? ["#FF6B00", "#CC4400"] : ["rgba(80,30,0,0.3)", "rgba(40,15,0,0.3)"]}
                style={[styles.mainBtn, canCashout && styles.cashoutGlow]}
              >
                <Text style={[styles.mainBtnText, !canCashout && { color: "#665" }]}>
                  {cashedOutAt
                    ? `EXITED AT ${cashedOutAt.toFixed(2)}x ✓`
                    : canCashout
                    ? `CASHOUT  ₹${potentialWin.toLocaleString("en-IN")}`
                    : "WAITING FOR LAUNCH..."}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {canCashout && (
            <Text style={styles.multDisplay}>{mult.toFixed(2)}x</Text>
          )}
        </View>

        {/* Live Bets */}
        {(bots.length > 0 || hasActiveBet) && (
          <View style={styles.liveBets}>
            <Text style={styles.liveBetsTitle}>LIVE BETS</Text>
            {hasActiveBet && authState.user && (
              <View style={styles.betRow}>
                <View style={[styles.dot, { backgroundColor: cashedOutAt ? C.green : C.orange }]} />
                <Text style={[styles.betUser, { color: C.gold }]}>{authState.user.username}</Text>
                <Text style={styles.betAmt}>₹{betAmount.toLocaleString("en-IN")}</Text>
                {cashedOutAt
                  ? <Text style={[styles.betStatus, { color: C.green }]}>{cashedOutAt.toFixed(2)}x</Text>
                  : <Text style={[styles.betStatus, { color: C.orange }]}>Flying</Text>
                }
              </View>
            )}
            {bots.slice(0, 7).map((b, i) => (
              <View key={i} style={styles.betRow}>
                <View style={[styles.dot, { backgroundColor: b.status === "cashed" ? C.green : b.status === "crashed" ? C.red : C.orange }]} />
                <Text style={styles.betUser}>{b.user}</Text>
                <Text style={styles.betAmt}>₹{b.amount.toLocaleString("en-IN")}</Text>
                {b.status === "cashed" && <Text style={[styles.betStatus, { color: C.green }]}>{b.cashout?.toFixed(2)}x</Text>}
                {b.status === "crashed" && <Text style={[styles.betStatus, { color: C.red }]}>Lost</Text>}
                {b.status === "active" && <Text style={[styles.betStatus, { color: C.orange }]}>{mult.toFixed(2)}x</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  balanceChip: { backgroundColor: C.bgCard, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 7 },
  balanceLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 1.5 },
  balanceValue: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.gold },
  appLabel: {},
  appLabelText: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.red, letterSpacing: 4 },
  connectionChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.bgCard, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  connectionText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted },
  historyRow: { marginBottom: 10, marginHorizontal: -4 },
  histChip: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, marginRight: 5, borderWidth: 1 },
  histText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  canvas: { width: CV_W, height: CV_H, backgroundColor: "rgba(4,0,12,0.9)", borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden", marginBottom: 12 },
  multOverlay: { alignItems: "center", justifyContent: "center" },
  multText: { fontSize: 54, fontFamily: "Inter_700Bold", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 28 },
  countLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 2, marginBottom: 2 },
  crashedLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#FF1A3A", letterSpacing: 4, marginTop: 2 },
  resultMsg: { borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16, marginBottom: 12, alignItems: "center" },
  resultText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  betPanel: { backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12 },
  betAmtRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  amtBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,26,58,0.12)", borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  amtBtnText: { fontSize: 22, color: C.text, fontFamily: "Inter_700Bold", lineHeight: 26 },
  disabled: { opacity: 0.4 },
  betInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 9 },
  betInputPrefix: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.gold, marginRight: 3 },
  betInput: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  presetRow: { flexDirection: "row", gap: 7, marginBottom: 12 },
  presetBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: C.border, alignItems: "center" },
  presetBtnActive: { backgroundColor: "rgba(255,26,58,0.18)", borderColor: C.primaryBright },
  presetText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textMuted },
  presetTextActive: { color: C.red },
  mainBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  cashoutGlow: { shadowColor: "#FF6B00", shadowRadius: 18, shadowOpacity: 0.7, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  mainBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFFFFF", letterSpacing: 1.5 },
  multDisplay: { textAlign: "center", marginTop: 9, fontSize: 28, fontFamily: "Inter_700Bold", color: C.gold },
  liveBets: { backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  liveBetsTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 2, marginBottom: 10 },
  betRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  betUser: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: C.text },
  betAmt: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textMuted },
  betStatus: { fontSize: 12, fontFamily: "Inter_700Bold", minWidth: 46, textAlign: "right" },
});
