import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Animated, Dimensions, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadSounds, startAmbient, stopAmbient, playBlast, playCashout,
  setSoundEnabled,
} from "@/lib/soundEngine";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgLinearGrad, Path, Rect, RadialGradient, Stop } from "react-native-svg";
import C from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { WSC, wsSend } from "@/lib/wsClient";

const { width: SW } = Dimensions.get("window");
const IS_DESKTOP_WEB = Platform.OS === "web" && SW > 700;
// On desktop web: canvas fills ~68% of a max-1280 container; on mobile: full width minus padding
const DESKTOP_CONTENT_W = Math.min(SW, 1280);
const DESKTOP_CANVAS_W  = Math.floor(DESKTOP_CONTENT_W * 0.68) - 16;
const CV_W = IS_DESKTOP_WEB ? DESKTOP_CANVAS_W : SW - 32;
const CV_H = IS_DESKTOP_WEB ? 310 : 260;
const ORIG_X = CV_W * 0.09;
const ORIG_Y = CV_H * 0.88;

const AVATAR_COLORS = ["#E53935","#8E24AA","#1E88E5","#00897B","#F4511E","#6D4C41","#546E7A","#43A047"];
const AVATAR_EMOJI  = ["🦅","🚀","🎯","💰","🔥","⚡","🌙","🎲"];
function multColor(m: number): string {
  if (m >= 10) return "#FF4DFF";
  if (m >= 2)  return "#4DA6FF";
  return "#FF3A3A";
}

function calcMult(elapsed: number): number {
  return Math.floor(Math.pow(Math.E, 0.077 * elapsed) * 100) / 100;
}
function getPos(elapsed: number): { x: number; y: number } {
  const MAX_T = 40;
  const t = Math.min(elapsed / MAX_T, 1);
  const x = ORIG_X + t * t * (CV_W * 0.88 - ORIG_X);
  const y = ORIG_Y - Math.sqrt(t) * (CV_H * 0.76);
  return { x, y: Math.max(y, 22) };
}

const STARS = Array.from({ length: 80 }, (_, i) => ({
  x: (Math.sin(i * 137.5) * 0.5 + 0.5) * CV_W,
  y: (Math.cos(i * 239.3) * 0.5 + 0.5) * CV_H * 0.9,
  r: 0.5 + (i % 3) * 0.5,
}));

function BlastShape() {
  return (
    <>
      {/* Outer glow rings */}
      <Circle cx={0} cy={0} r={38} fill="rgba(255,80,0,0.10)" />
      <Circle cx={0} cy={0} r={26} fill="rgba(255,120,0,0.18)" />
      <Circle cx={0} cy={0} r={17} fill="rgba(255,200,0,0.28)" />
      {/* Core blast */}
      <Circle cx={0} cy={0} r={10} fill="#FF6B00" />
      <Circle cx={0} cy={0} r={5} fill="#FFD700" />
      <Circle cx={0} cy={0} r={2} fill="#FFFFFF" />
      {/* Debris rays */}
      {[0,45,90,135,180,225,270,315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const r1 = 13, r2 = 30 + (i % 3) * 8;
        return (
          <Path
            key={deg}
            d={`M ${Math.cos(rad)*r1} ${Math.sin(rad)*r1} L ${Math.cos(rad)*r2} ${Math.sin(rad)*r2}`}
            stroke={i % 2 === 0 ? "#FF6B00" : "#FFD700"}
            strokeWidth={i % 2 === 0 ? 2.5 : 1.5}
            strokeLinecap="round"
            opacity={0.85}
          />
        );
      })}
      {/* Diagonal sparks */}
      {[22,67,112,157,202,247,292,337].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const r1 = 10, r2 = 18 + (i % 2) * 6;
        return (
          <Circle
            key={deg}
            cx={Math.cos(rad) * r2}
            cy={Math.sin(rad) * r2}
            r={1.5 + (i % 3) * 0.8}
            fill={i % 3 === 0 ? "#FFFFFF" : i % 3 === 1 ? "#FFD700" : "#FF4500"}
            opacity={0.9}
          />
        );
      })}
    </>
  );
}

function RocketShape({ phase, flicker = 0, flicker2 = 0 }: { phase: string; flicker?: number; flicker2?: number }) {
  const S = 26;
  const isFlying = phase === "flying";
  const isWaiting = phase === "waiting";
  if (phase === "crashed") return <BlastShape />;
  return (
    <>
      {isFlying && (
        <>
          <Ellipse cx={0} cy={S * 0.85} rx={8} ry={S * 0.62} fill="url(#flameOuter)" />
          <Ellipse cx={0} cy={S * 0.70} rx={4.5} ry={S * 0.38} fill="url(#flameMid)" />
          <Ellipse cx={0} cy={S * 0.56} rx={2} ry={S * 0.20} fill="url(#flameCore)" />
        </>
      )}
      {isWaiting && (
        <>
          {/* Ground steam / smoke rings */}
          <Ellipse cx={-9} cy={S * 1.05 + flicker * S * 0.35} rx={4 + flicker2 * 2} ry={2.5 + flicker * 1.5} fill="#FF6B00" opacity={0.18 + flicker2 * 0.14} />
          <Ellipse cx={9} cy={S * 1.05 + flicker2 * S * 0.3} rx={4 + flicker * 2} ry={2 + flicker2 * 1.5} fill="#FFD700" opacity={0.15 + flicker * 0.12} />
          {/* Main pre-launch flame — flickers in height */}
          <Ellipse cx={0} cy={S * 0.78 + flicker * S * 0.18} rx={6.5 + flicker2 * 2.5} ry={S * 0.32 + flicker * S * 0.18} fill="url(#flameOuter)" opacity={0.55 + flicker * 0.35} />
          <Ellipse cx={0} cy={S * 0.64 + flicker2 * S * 0.10} rx={3.5 + flicker * 1.5} ry={S * 0.18 + flicker2 * S * 0.10} fill="url(#flameMid)" opacity={0.65 + flicker2 * 0.25} />
          <Ellipse cx={0} cy={S * 0.52} rx={2 + flicker * 1} ry={S * 0.09 + flicker * S * 0.05} fill="url(#flameCore)" opacity={0.8 + flicker2 * 0.2} />
          {/* Floating sparks */}
          <Circle cx={-7 + flicker2 * 5} cy={S * 1.0 + flicker * S * 0.25} r={1.4} fill="#FFD700" opacity={flicker2 * 0.85} />
          <Circle cx={8 - flicker * 4} cy={S * 1.15 + flicker2 * S * 0.2} r={1.1} fill="#FF6B00" opacity={flicker * 0.7} />
          <Circle cx={-3} cy={S * 0.88 + flicker2 * S * 0.3} r={1.0} fill="#FFFFFF" opacity={flicker2 * 0.6} />
          <Circle cx={4} cy={S * 0.92 + flicker * S * 0.22} r={1.2} fill="#FFD700" opacity={flicker * 0.65} />
          <Circle cx={-10 + flicker * 3} cy={S * 1.25 + flicker2 * S * 0.15} r={0.9} fill="#FF4500" opacity={flicker2 * 0.5} />
          <Circle cx={10 - flicker2 * 3} cy={S * 1.3 + flicker * S * 0.1} r={0.8} fill="#FFD700" opacity={flicker * 0.55} />
        </>
      )}
      <Path d={`M -8 ${S * 0.2} L -17 ${S * 0.55} L -8 ${S * 0.42} Z`} fill="#D43050" />
      <Path d={`M 8 ${S * 0.2} L 17 ${S * 0.55} L 8 ${S * 0.42} Z`} fill="#D43050" />
      <Rect x={-8} y={-S * 0.46} width={16} height={S * 0.92} rx={4} ry={4} fill="url(#rocketBody)" />
      <Path d={`M 0 ${-S} L 8 ${-S * 0.46} L -8 ${-S * 0.46} Z`} fill="url(#rocketNose)" />
      <Rect x={-3.5} y={-S * 0.44} width={7} height={S * 0.26} rx={2} fill="#EE1133" opacity={0.9} />
      <Circle cx={0} cy={-S * 0.10} r={5} fill="rgba(80,160,255,0.22)" stroke="#88CCFF" strokeWidth={1.2} />
      <Circle cx={-1.5} cy={-S * 0.10 - 1.5} r={1.8} fill="rgba(255,255,255,0.55)" />
      <Rect x={-5} y={-S * 0.43} width={2.5} height={S * 0.82} rx={1.2} fill="rgba(255,255,255,0.18)" />
      <Rect x={-6.5} y={S * 0.44} width={13} height={5.5} rx={2} fill="#484E60" />
    </>
  );
}

function GameCanvas({ phase, mult, countdown, elapsed, synced }: {
  phase: string; mult: number; countdown: number; elapsed: number; synced: boolean;
}) {
  const pos = (phase === "flying" || phase === "crashed")
    ? getPos(elapsed)
    : { x: ORIG_X + 10, y: ORIG_Y - 20 };

  let pathD = `M ${ORIG_X} ${ORIG_Y}`;
  if (phase === "flying" || phase === "crashed") {
    const steps = 40;
    for (let i = 1; i <= steps; i++) {
      const t = elapsed * (i / steps);
      const p = getPos(t);
      pathD += ` L ${p.x} ${p.y}`;
    }
  }

  const dT = 0.3;
  const e0 = Math.max(elapsed - dT, 0.001);
  const e1 = elapsed + dT;
  const pA = getPos(e0);
  const pB = getPos(e1);
  const angle = Math.atan2(pB.y - pA.y, pB.x - pA.x);
  const angleDeg = (angle * 180) / Math.PI + 90;

  const mColor = phase === "crashed" ? "#FF1A3A" : mult >= 10 ? "#FFD700" : mult >= 3 ? "#FF6B00" : "#FFFFFF";

  return (
    <View style={[styles.canvas, IS_DESKTOP_WEB && { width: "100%" }]}>
      <Svg width={IS_DESKTOP_WEB ? "100%" : CV_W} height={CV_H} viewBox={`0 0 ${CV_W} ${CV_H}`}>
        <Defs>
          <SvgLinearGrad id="canvasBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#0A0120" />
            <Stop offset="100%" stopColor="#04000C" />
          </SvgLinearGrad>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={mColor} stopOpacity={0.15} />
            <Stop offset="100%" stopColor={mColor} stopOpacity={0} />
          </RadialGradient>
          <SvgLinearGrad id="rocketBody" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#C8CED8" />
            <Stop offset="45%" stopColor="#F0F2F8" />
            <Stop offset="100%" stopColor="#9098A8" />
          </SvgLinearGrad>
          <SvgLinearGrad id="rocketNose" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#B8C0D0" />
          </SvgLinearGrad>
          <SvgLinearGrad id="flameOuter" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFD700" stopOpacity="0.9" />
            <Stop offset="45%" stopColor="#FF6B00" stopOpacity="0.7" />
            <Stop offset="100%" stopColor="#FF1A3A" stopOpacity="0" />
          </SvgLinearGrad>
          <SvgLinearGrad id="flameMid" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <Stop offset="50%" stopColor="#FFD700" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#FF6B00" stopOpacity="0" />
          </SvgLinearGrad>
          <SvgLinearGrad id="flameCore" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLinearGrad>
        </Defs>
        {/* Canvas background gradient — matches website exactly */}
        <Rect x={0} y={0} width={CV_W} height={CV_H} fill="url(#canvasBg)" />
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
          <RocketShape
            phase={phase}
            flicker={(Math.sin(Date.now() / 80) + 1) / 2}
            flicker2={(Math.sin(Date.now() / 55 + 2.1) + 1) / 2}
          />
        </G>
      </Svg>

      {phase === "flying" && (
        <View style={[StyleSheet.absoluteFill, styles.multOverlay]} pointerEvents="none">
          <Text style={[styles.multText, { color: mColor, textShadowColor: "transparent" }]}>
            {mult.toFixed(2)}x
          </Text>
        </View>
      )}
      {phase === "waiting" && (
        <View style={[StyleSheet.absoluteFill, styles.multOverlay]} pointerEvents="none">
          <Text style={styles.countLabel}>NEXT ROUND IN</Text>
          <Text style={[styles.multText, { color: C.textMuted, textShadowColor: "transparent", fontSize: 40 }]}>
            {countdown}s
          </Text>
        </View>
      )}
      {phase === "crashed" && (
        <View style={[StyleSheet.absoluteFill, styles.multOverlay]} pointerEvents="none">
          <Text style={[styles.multText, { color: "#FF1A3A", textShadowColor: "transparent" }]}>
            {mult.toFixed(2)}x
          </Text>
          <Text style={styles.crashedLabel}>💥  BLAST!</Text>
        </View>
      )}
      {!synced && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(4,0,12,0.88)", alignItems: "center", justifyContent: "center", borderRadius: 16 }]} pointerEvents="none">
          <Text style={{ fontSize: 28, marginBottom: 8 }}>🚀</Text>
          <Text style={{ color: "#FF3A3A", fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 2 }}>SYNCING...</Text>
          <Text style={{ color: "#AA5566", fontSize: 10, marginTop: 4, letterSpacing: 1 }}>Connecting to live game</Text>
        </View>
      )}
    </View>
  );
}

type SlotStatus = "idle" | "placed" | "queued" | "active" | "cashedout" | "lost";

interface SlotState {
  amount: number;
  input: string;
  status: SlotStatus;
  cashedOutAt: number | null;
  result: { text: string; win: boolean } | null;
}

function initSlot(defaultAmt: number): SlotState {
  return { amount: defaultAmt, input: String(defaultAmt), status: "idle", cashedOutAt: null, result: null };
}

export default function GameScreen() {
  const { state: authState } = useAuth();
  const insets = useSafeAreaInsets();
  const [, setTick] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [slots, setSlots] = useState<[SlotState, SlotState]>([initSlot(100), initSlot(200)]);
  const [soundOn, setSoundOn] = useState(true);

  const slotRefs = useRef<[SlotState, SlotState]>([initSlot(100), initSlot(200)]);
  const resultTimers = useRef<[ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null]>([null, null]);

  const [cashoutPopup, setCashoutPopup] = useState<{ payout: number; mult: number; slot: number } | null>(null);
  const popupAnim = useRef(new Animated.Value(0)).current;
  const popupDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Sound: load on mount, restore preference ──────────────────────────
  useEffect(() => {
    AsyncStorage.getItem("blazeSound").then(val => {
      const on = val !== "off";
      setSoundOn(on);
      setSoundEnabled(on);
    });
    loadSounds();
  }, []);

  // ── Sound: phase-based triggers ────────────────────────────────────────
  const prevPhaseForSound = useRef<string>("");
  useEffect(() => {
    const listener = () => {
      const ph = WSC.state.phase;
      if (ph !== prevPhaseForSound.current) {
        if (ph === "flying") startAmbient();
        if (ph === "crashed") { stopAmbient(); playBlast(); }
        prevPhaseForSound.current = ph;
      }
    };
    WSC.listeners.add(listener);
    return () => { WSC.listeners.delete(listener); };
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    AsyncStorage.setItem("blazeSound", next ? "on" : "off");
  }

  const showCashoutPopup = useCallback((payout: number, mult: number, slot: number) => {
    if (popupDismissTimer.current) clearTimeout(popupDismissTimer.current);
    setCashoutPopup({ payout, mult, slot });
    popupAnim.setValue(0);
    Animated.spring(popupAnim, { toValue: 1, useNativeDriver: true, tension: 90, friction: 10 }).start();
    popupDismissTimer.current = setTimeout(() => {
      Animated.timing(popupAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setCashoutPopup(null));
    }, 5000);
  }, [popupAnim]);


  const updateSlot = useCallback((idx: 0 | 1, patch: Partial<SlotState>) => {
    setSlots(prev => {
      const next: [SlotState, SlotState] = [{ ...prev[0] }, { ...prev[1] }];
      next[idx] = { ...next[idx], ...patch };
      slotRefs.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    const wsListener = () => {
      if (WSC.state.phase === "flying" && WSC.state.startTime > 0) {
        setElapsedSec((Date.now() - WSC.state.startTime) / 1000);
      }
      setTick(n => n + 1);
    };
    WSC.listeners.add(wsListener);
    return () => { WSC.listeners.delete(wsListener); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (WSC.state.phase === "flying") {
        setElapsedSec((Date.now() - WSC.state.startTime) / 1000);
      } else if (WSC.state.phase === "waiting") {
        setElapsedSec(0);
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (msg: Record<string, unknown>) => {
      const slotNum = (msg.slot as number | undefined) ?? 1;
      const slotIdx = (slotNum - 1) as 0 | 1;

      if (msg.type === "bet_ok") {
        const isQueued = msg.auto === true;
        updateSlot(slotIdx, { status: isQueued ? "active" : "placed", result: null });
        if (Platform.OS !== "web") Haptics.selectionAsync();
      }

      if (msg.type === "bet_queued") {
        updateSlot(slotIdx, { status: "queued", result: null });
        if (Platform.OS !== "web") Haptics.selectionAsync();
      }

      if (msg.type === "bet_cancelled") {
        updateSlot(slotIdx, { status: "idle", result: null });
      }

      if (msg.type === "bet_cancel_fail") {
        // Round already flying — revert to active so cashout button shows
        updateSlot(slotIdx, { status: "active" });
      }

      if (msg.type === "cashout_ok") {
        const m = msg.mult as number;
        const payout = msg.payout as number;
        const amt = slotRefs.current[slotIdx].amount;
        const profit = payout - amt;
        if (resultTimers.current[slotIdx]) clearTimeout(resultTimers.current[slotIdx]!);
        updateSlot(slotIdx, {
          status: "cashedout",
          cashedOutAt: m,
          result: { text: `+₹${profit.toLocaleString("en-IN")} @ ${m.toFixed(2)}x`, win: true },
        });
        resultTimers.current[slotIdx] = setTimeout(() => updateSlot(slotIdx, { result: null }), 5000);
        showCashoutPopup(payout, m, slotNum);
        playCashout(); // 🎵 Win chime
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (msg.type === "cashout_fail") {
        updateSlot(slotIdx, { status: "active" });
      }

      if (msg.type === "bet_crash") {
        const m = msg.mult as number;
        const amt = slotRefs.current[slotIdx].amount;
        if (resultTimers.current[slotIdx]) clearTimeout(resultTimers.current[slotIdx]!);
        updateSlot(slotIdx, {
          status: "lost",
          result: { text: `-₹${amt.toLocaleString("en-IN")} @ ${m.toFixed(2)}x`, win: false },
        });
        resultTimers.current[slotIdx] = setTimeout(() => updateSlot(slotIdx, { result: null }), 5000);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      if (msg.type === "bet_fail") {
        const errSlot = ((msg.slot as number | undefined) ?? 1) - 1 as 0 | 1;
        const errMsg = String(msg.error ?? "Please try again");
        const isOccupied = errMsg.toLowerCase().includes("already has a bet") || errMsg.toLowerCase().includes("already active");
        if (isOccupied) {
          // Server still has a bet — restore correct state so cancel button shows
          const ph = WSC.state.phase;
          const restored: SlotState["status"] = ph === "flying" ? "active" : ph === "crashed" ? "queued" : "placed";
          updateSlot(errSlot, { status: restored });
        } else {
          Alert.alert("Bet Failed", errMsg);
          updateSlot(errSlot, { status: "idle" });
        }
      }

      // Restore bet state after WS reconnect
      if (msg.type === "bet_state") {
        const slots = (msg as any).slots as Array<{ slot: number; active: boolean; queued: boolean; queuedAmount: number; amount: number }>;
        const ph = (msg as any).phase as string;
        slots.forEach((sl) => {
          const idx = (sl.slot - 1) as 0 | 1;
          if (sl.active) {
            updateSlot(idx, { status: ph === "flying" ? "active" : "placed", amount: sl.amount });
          } else if (sl.queued) {
            updateSlot(idx, { status: "queued", amount: sl.queuedAmount });
          }
        });
      }

      if (msg.type === "state") {
        const newPhase = (msg as { phase?: string }).phase;
        if (newPhase === "waiting") {
          setSlots(prev => {
            const next: [SlotState, SlotState] = [{ ...prev[0] }, { ...prev[1] }];
            for (let i = 0; i < 2; i++) {
              if (next[i].status === "lost" || next[i].status === "cashedout") {
                next[i] = { ...next[i], status: "idle", cashedOutAt: null };
              }
            }
            slotRefs.current = next;
            return next;
          });
        }
        if (newPhase === "flying") {
          setSlots(prev => {
            const next: [SlotState, SlotState] = [{ ...prev[0] }, { ...prev[1] }];
            for (let i = 0; i < 2; i++) {
              if (next[i].status === "placed") next[i] = { ...next[i], status: "active" };
            }
            slotRefs.current = next;
            return next;
          });
        }
      }
    };
    WSC.msgListeners.add(handler);
    return () => { WSC.msgListeners.delete(handler); };
  }, [updateSlot]);

  const phase = WSC.state.phase;
  const mult = WSC.state.mult;
  const countdown = WSC.state.countdown;
  const allBets = WSC.state.allBets ?? [];
  const history = WSC.state.history ?? [];
  const betCount = WSC.state.betCount ?? 0;
  const cashedCount = WSC.state.cashedCount ?? 0;
  const totalWin = WSC.state.totalWin ?? 0;
  const prevRound = WSC.state.prevRound ?? null;
  const topBets = WSC.state.topBets ?? [];
  const topHistory = WSC.state.topHistory ?? [];
  const [betsTab, setBetsTab] = useState<"all" | "prev" | "top">("all");
  const [topSort, setTopSort] = useState<"X" | "Win" | "Rounds">("X");
  const [topTime, setTopTime] = useState<"Day" | "Month" | "Year">("Month");

  function placeBet(slotIdx: 0 | 1) {
    if (!authState.user) { Alert.alert("Login Required", "Please login to place bets"); return; }
    const slot = slotRefs.current[slotIdx]; // always up-to-date
    const isEffectivelyIdle = slot.status === "idle" ||
      slot.status === "cashedout" || slot.status === "lost";
    if (!isEffectivelyIdle) return;
    wsSend({ type: "place_bet", slot: slotIdx + 1, amount: slot.amount });
    updateSlot(slotIdx, {
      status: (WSC.state.phase === "flying" || WSC.state.phase === "crashed") ? "queued" : "placed",
      result: null,
    });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function cancelBet(slotIdx: 0 | 1) {
    const slot = slotRefs.current[slotIdx];
    const canCancel = slot.status === "placed" || slot.status === "queued" ||
      // Also allow during first 3.5s of flying (server enforces the window)
      (slot.status === "active" && WSC.state.phase === "flying" &&
        WSC.state.startTime > 0 && Date.now() - WSC.state.startTime < 3500);
    if (!canCancel) return;
    wsSend({ type: "cancel_bet", slot: slotIdx + 1 });
    updateSlot(slotIdx, { status: "idle" });
    if (Platform.OS !== "web") Haptics.selectionAsync();
  }

  function cashOut(slotIdx: 0 | 1) {
    // Always use slotRefs.current (synchronously updated) — never stale closure slots[]
    const slot = slotRefs.current[slotIdx];
    // Always use WSC.state.phase — never stale closure phase variable
    if (slot.status !== "active" || WSC.state.phase !== "flying") return;
    wsSend({ type: "cashout", slot: slotIdx + 1 });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  function setSlotAmount(slotIdx: 0 | 1, val: number) {
    const amt = Math.max(10, val);
    updateSlot(slotIdx, { amount: amt, input: String(amt) });
    if (Platform.OS !== "web") Haptics.selectionAsync();
  }

  function renderBetPanel(slotIdx: 0 | 1) {
    const slot = slots[slotIdx];
    const label = slotIdx === 0 ? "BET 1" : "BET 2";

    // After cashout/loss, always reset to idle so user can immediately queue next bet
    const effectiveStatus: SlotStatus = (slot.status === "cashedout" || slot.status === "lost")
      ? "idle"
      : slot.status;

    const canEdit = effectiveStatus === "idle";
    const potentialWin = effectiveStatus === "active" ? Math.floor(slot.amount * mult) : 0;

    let btnContent: React.ReactNode;
    const canStillCancel = effectiveStatus === "active" && phase === "flying" && elapsedSec < 3.5 && WSC.state.startTime > 0;
    if (effectiveStatus === "active" && phase === "flying") {
      btnContent = (
        <View style={{ flex: 1, gap: 5 }}>
          <TouchableOpacity onPress={() => cashOut(slotIdx)} activeOpacity={0.85}>
            <LinearGradient colors={["#FF8C00", "#CC4400"]} style={[styles.mainBtn, styles.cashoutGlow]}>
              <Text style={styles.cashoutLabel}>CASHOUT</Text>
              <Text style={styles.cashoutAmt}>₹{potentialWin.toLocaleString("en-IN")}</Text>
            </LinearGradient>
          </TouchableOpacity>
          {canStillCancel && (
            <TouchableOpacity onPress={() => cancelBet(slotIdx)} activeOpacity={0.7}
              style={{ alignItems: "center", paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,26,58,0.35)", backgroundColor: "rgba(255,26,58,0.06)" }}>
              <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#FF4D4D", letterSpacing: 1.5 }}>✕  CANCEL BET</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    } else if (effectiveStatus === "placed") {
      btnContent = (
        <TouchableOpacity onPress={() => cancelBet(slotIdx)} activeOpacity={0.8} style={{ flex: 1 }}>
          <View style={styles.placedBtn}>
            <Text style={styles.placedBtnTop}>BET PLACED ✓</Text>
            <Text style={styles.placedBtnAmt}>₹{slot.amount.toLocaleString("en-IN")}</Text>
            <Text style={styles.placedBtnHint}>TAP TO CANCEL</Text>
          </View>
        </TouchableOpacity>
      );
    } else if (effectiveStatus === "queued") {
      btnContent = (
        <TouchableOpacity onPress={() => cancelBet(slotIdx)} activeOpacity={0.8} style={{ flex: 1 }}>
          <View style={[styles.placedBtn, { borderColor: "rgba(255,152,0,0.45)", backgroundColor: "rgba(255,152,0,0.07)" }]}>
            <Text style={[styles.placedBtnTop, { color: "#FF9800" }]}>NEXT ROUND ✓</Text>
            <Text style={styles.placedBtnAmt}>₹{slot.amount.toLocaleString("en-IN")}</Text>
            <Text style={styles.placedBtnHint}>TAP TO CANCEL</Text>
          </View>
        </TouchableOpacity>
      );
    } else if (effectiveStatus === "cashedout") {
      btnContent = (
        <View style={[styles.mainBtn, { backgroundColor: "rgba(0,180,80,0.12)", borderWidth: 1, borderColor: "rgba(0,180,80,0.3)", alignItems: "center", justifyContent: "center", flex: 1 }]}>
          <Text style={[styles.mainBtnText, { color: "#00C853" }]}>EXITED @ {slot.cashedOutAt?.toFixed(2)}x ✓</Text>
        </View>
      );
    } else {
      const canBet = !!authState.user && effectiveStatus === "idle";
      const isNextRound = phase === "flying" || phase === "crashed";
      btnContent = (
        <TouchableOpacity onPress={() => placeBet(slotIdx)} disabled={!canBet} activeOpacity={0.85} style={{ flex: 1 }}>
          <LinearGradient
            colors={canBet ? (isNextRound ? ["#1565C0", "#0D47A1"] : ["#00C853", "#009C41"]) : ["rgba(20,20,30,0.4)", "rgba(10,10,20,0.4)"]}
            style={styles.mainBtn}
          >
            <Text style={[styles.mainBtnText, !canBet && { color: "#556" }]}>
              {!authState.user ? "SIGN IN" : isNextRound ? `BET NEXT  ₹${slot.amount.toLocaleString("en-IN")}` : `BET  ₹${slot.amount.toLocaleString("en-IN")}`}
            </Text>
            {isNextRound && canBet && <Text style={styles.mainBtnSub2}>next round</Text>}
          </LinearGradient>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.betPanel} key={slotIdx}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelLabel}>{label}</Text>
          {slot.result && (
            <View style={[styles.resultPill, { backgroundColor: slot.result.win ? "rgba(0,200,83,0.15)" : "rgba(255,26,58,0.15)" }]}>
              <Text style={[styles.resultPillText, { color: slot.result.win ? "#00C853" : "#FF1A3A" }]}>
                {slot.result.text}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.betAmtRow}>
          <TouchableOpacity onPress={() => setSlotAmount(slotIdx, slot.amount - 50)} disabled={!canEdit} style={[styles.amtBtn, !canEdit && styles.disabled]}>
            <Text style={styles.amtBtnText}>−</Text>
          </TouchableOpacity>
          <View style={styles.betInputWrap}>
            <Text style={styles.betInputPrefix}>₹</Text>
            <TextInput
              style={styles.betInput}
              value={slot.input}
              keyboardType="numeric"
              editable={canEdit}
              onChangeText={t => updateSlot(slotIdx, { input: t })}
              onBlur={() => {
                const v = parseInt(slot.input, 10);
                if (!isNaN(v) && v >= 10) updateSlot(slotIdx, { amount: v, input: String(v) });
                else updateSlot(slotIdx, { input: String(slot.amount) });
              }}
            />
          </View>
          <TouchableOpacity onPress={() => setSlotAmount(slotIdx, slot.amount + 50)} disabled={!canEdit} style={[styles.amtBtn, !canEdit && styles.disabled]}>
            <Text style={styles.amtBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.presetRow}>
          {[100, 250, 500, 1000].map(v => (
            <TouchableOpacity key={v} onPress={() => setSlotAmount(slotIdx, v)} disabled={!canEdit} style={[styles.presetBtn, slot.amount === v && styles.presetBtnActive, !canEdit && styles.disabled]}>
              <Text style={[styles.presetText, slot.amount === v && styles.presetTextActive]}>₹{v >= 1000 ? "1K" : v}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {btnContent}
      </View>
    );
  }

  const connected = WSC.state.connected;
  const synced = WSC.state.synced;

  const popupTranslateY = popupAnim.interpolate({ inputRange: [0, 1], outputRange: [-130, 0] });
  const popupOpacity = popupAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 24 + insets.bottom }} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.balanceChip}>
          <Text style={styles.balanceLabel}>BALANCE</Text>
          <Text style={styles.balanceValue}>₹{(authState.user?.balance ?? 0).toLocaleString("en-IN")}</Text>
        </View>
        <View style={styles.appLabel}>
          <Text style={styles.appLabelText}>BLAZE</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {/* Sound toggle */}
          <TouchableOpacity
            onPress={toggleSound}
            style={{
              flexDirection: "row", alignItems: "center", gap: 3,
              backgroundColor: soundOn ? "rgba(255,26,58,0.15)" : "rgba(255,255,255,0.06)",
              borderWidth: 1, borderColor: soundOn ? "rgba(255,26,58,0.4)" : "rgba(255,255,255,0.15)",
              borderRadius: 10, paddingHorizontal: 7, paddingVertical: 5,
            }}>
            <Text style={{ fontSize: 13 }}>{soundOn ? "🔊" : "🔇"}</Text>
            <Text style={{ fontSize: 8, fontWeight: "700", color: soundOn ? "#FF1A3A" : "#AA7788", letterSpacing: 0.5 }}>
              {soundOn ? "ON" : "OFF"}
            </Text>
          </TouchableOpacity>
          {/* LIVE */}
          <View style={styles.connectionChip}>
            <View style={[styles.dot, { backgroundColor: connected ? "#00E676" : "#FF1A3A" }]} />
            <Text style={styles.connectionText}>{connected ? "LIVE" : "OFFLINE"}</Text>
          </View>
        </View>
      </View>

      <View style={IS_DESKTOP_WEB ? { paddingHorizontal: 16, maxWidth: 1280, alignSelf: "center", width: "100%" } : { paddingHorizontal: 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyRow} contentContainerStyle={{ paddingHorizontal: 0 }}>
          {history.map((h, i) => {
            const col = h >= 10 ? "#FF4DFF" : h >= 2 ? "#4DA6FF" : "#FF3A3A";
            const bg  = h >= 10 ? "rgba(255,77,255,0.13)" : h >= 2 ? "rgba(77,166,255,0.13)" : "rgba(255,58,58,0.13)";
            return (
              <View key={i} style={[styles.histChip, { backgroundColor: bg, borderColor: col + "55" }]}>
                <Text style={[styles.histText, { color: col }]}>{h.toFixed(2)}x</Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Desktop: canvas left + panels right. Mobile: stacked */}
        {IS_DESKTOP_WEB ? (
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            {/* LEFT: canvas */}
            <View style={{ flex: 1 }}>
              <GameCanvas phase={phase} mult={mult} countdown={countdown} elapsed={elapsedSec} synced={synced} />
            </View>
            {/* RIGHT: BET panels stacked */}
            <View style={{ width: 272, gap: 10 }}>
              {renderBetPanel(0)}
              {renderBetPanel(1)}
            </View>
          </View>
        ) : (
          <>
            <GameCanvas phase={phase} mult={mult} countdown={countdown} elapsed={elapsedSec} synced={synced} />
            <View style={styles.dualPanel}>
              {renderBetPanel(0)}
              {renderBetPanel(1)}
            </View>
          </>
        )}

        {/* ── Tabbed bets panel ── */}
        <View style={styles.betsPanel}>
          {/* Tab bar */}
          <View style={styles.tabBar}>
            {(["all", "prev", "top"] as const).map(tab => (
              <TouchableOpacity key={tab} style={[styles.tab, betsTab === tab && styles.tabActive]} onPress={() => setBetsTab(tab)}>
                <Text style={[styles.tabText, betsTab === tab && styles.tabTextActive]}>
                  {tab === "all" ? "All Bets" : tab === "prev" ? "Previous" : "Top"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── ALL BETS ── */}
          {betsTab === "all" && (
            <View>
              <View style={styles.betsSummaryRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {[0, 1, 2].map(i => (
                    <View key={i} style={[styles.avatarCircle, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], marginLeft: i > 0 ? -10 : 0 }]}>
                      <Text style={styles.avatarText}>{AVATAR_EMOJI[i % AVATAR_EMOJI.length]}</Text>
                    </View>
                  ))}
                  <Text style={styles.betsSummaryCount}>{cashedCount}/{betCount} Bets</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.betsSummaryWin}>₹{totalWin >= 1000 ? (totalWin / 1000).toFixed(2) + "K" : totalWin.toFixed(2)}</Text>
                  <Text style={styles.betsSummaryLabel}>Total win INR</Text>
                </View>
              </View>
              <View style={styles.betsProgressBar}>
                <View style={[styles.betsProgressFill, { width: betCount > 0 ? `${Math.min(100, (cashedCount / betCount) * 100)}%` as any : "0%" }]} />
              </View>
              <View style={styles.betsColHeader}>
                <Text style={[styles.betsColText, { flex: 1.8 }]}>Player</Text>
                <Text style={[styles.betsColText, { flex: 1.5, textAlign: "right" }]}>Bet INR</Text>
                <Text style={[styles.betsColText, { flex: 0.9, textAlign: "center" }]}>X</Text>
                <Text style={[styles.betsColText, { flex: 1.5, textAlign: "right" }]}>Win INR</Text>
              </View>
              {allBets.slice(0, 18).map((b, i) => (
                <View key={i} style={styles.betRow2}>
                  <View style={[styles.avatarCircle, { backgroundColor: AVATAR_COLORS[b.avatar % AVATAR_COLORS.length] }]}>
                    <Text style={styles.avatarText}>{AVATAR_EMOJI[b.avatar % AVATAR_EMOJI.length]}</Text>
                  </View>
                  <Text style={[styles.betUser2, { flex: 1.4 }]}>{b.user}</Text>
                  <Text style={[styles.betAmt2, { flex: 1.5 }]}>₹{b.amount.toLocaleString("en-IN")}</Text>
                  <Text style={[styles.betMult, { flex: 0.9, color: b.status === "cashed" ? multColor(b.cashout ?? 0) : b.status === "lost" ? "#555" : "#888" }]}>
                    {b.cashout ? `${b.cashout.toFixed(2)}x` : "—"}
                  </Text>
                  <Text style={[styles.betWin, { flex: 1.5, color: b.winAmount > 0 ? "#00C853" : "#555" }]}>
                    {b.winAmount > 0 ? `₹${b.winAmount.toLocaleString("en-IN")}` : "0.00"}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* ── PREVIOUS ── */}
          {betsTab === "prev" && (
            <View>
              <View style={styles.prevHeader}>
                <Text style={styles.prevLabel}>Round Result</Text>
                <Text style={[styles.prevResult, { color: prevRound ? multColor(prevRound.result) : "#888" }]}>
                  {prevRound ? `${prevRound.result.toFixed(2)}x` : "—"}
                </Text>
              </View>
              <View style={styles.betsColHeader}>
                <Text style={[styles.betsColText, { flex: 1.8 }]}>Player</Text>
                <Text style={[styles.betsColText, { flex: 1.5, textAlign: "right" }]}>Bet INR</Text>
                <Text style={[styles.betsColText, { flex: 0.9, textAlign: "center" }]}>X</Text>
                <Text style={[styles.betsColText, { flex: 1.5, textAlign: "right" }]}>Win INR</Text>
              </View>
              {(prevRound?.bets ?? []).slice(0, 18).map((b, i) => (
                <View key={i} style={styles.betRow2}>
                  <View style={[styles.avatarCircle, { backgroundColor: AVATAR_COLORS[b.avatar % AVATAR_COLORS.length] }]}>
                    <Text style={styles.avatarText}>{AVATAR_EMOJI[b.avatar % AVATAR_EMOJI.length]}</Text>
                  </View>
                  <Text style={[styles.betUser2, { flex: 1.4 }]}>{b.user}</Text>
                  <Text style={[styles.betAmt2, { flex: 1.5 }]}>₹{b.amount.toLocaleString("en-IN")}</Text>
                  <Text style={[styles.betMult, { flex: 0.9, color: b.cashout ? multColor(b.cashout) : "#555" }]}>
                    {b.cashout ? `${b.cashout.toFixed(2)}x` : "—"}
                  </Text>
                  <Text style={[styles.betWin, { flex: 1.5, color: b.winAmount > 0 ? "#00C853" : "#555" }]}>
                    {b.winAmount > 0 ? `₹${b.winAmount.toLocaleString("en-IN")}` : "0.00"}
                  </Text>
                </View>
              ))}
              {!prevRound && <Text style={styles.emptyMsg}>No previous round data yet</Text>}
            </View>
          )}

          {/* ── TOP ── */}
          {betsTab === "top" && (
            <View>
              {/* Sort row */}
              <View style={styles.topFilterRow}>
                {(["X", "Win", "Rounds"] as const).map(f => (
                  <TouchableOpacity key={f} onPress={() => setTopSort(f)} style={[styles.topFilterBtn, topSort === f && styles.topFilterBtnActive]}>
                    <Text style={[styles.topFilterText, topSort === f && styles.topFilterTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Time row */}
              <View style={[styles.topFilterRow, { marginBottom: 12 }]}>
                {(["Day", "Month", "Year"] as const).map(f => (
                  <TouchableOpacity key={f} onPress={() => setTopTime(f)} style={[styles.topFilterBtn, topTime === f && styles.topFilterBtnActive]}>
                    <Text style={[styles.topFilterText, topTime === f && styles.topFilterTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── X sub-tab: top crash multipliers ── */}
              {topSort === "X" && (() => {
                const cutoff = topTime === "Day" ? 86400000 : topTime === "Month" ? 30 * 86400000 : 365 * 86400000;
                const rows = topHistory.filter(h => Date.now() - new Date(h.date).getTime() < cutoff);
                const fmtDate = (iso: string) => {
                  const d = new Date(iso);
                  const dd = String(d.getDate()).padStart(2, "0");
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  const yy = String(d.getFullYear()).slice(-2);
                  const hh = String(d.getHours()).padStart(2, "0");
                  const mi = String(d.getMinutes()).padStart(2, "0");
                  return `${dd}.${mm}.${yy} ${hh}:${mi}`;
                };
                const fmtMult = (m: number) => m >= 1000 ? m.toLocaleString("en-US", { maximumFractionDigits: 2 }) + "x" : m.toFixed(2) + "x";
                return (
                  <View>
                    <View style={styles.topTableHeader}>
                      <Text style={styles.topTableHeaderTxt}>Date & Time</Text>
                      <Text style={styles.topTableHeaderTxt}>X</Text>
                    </View>
                    {rows.map((h, i) => (
                      <View key={i} style={styles.topTableRow}>
                        <Text style={styles.topTableDate}>{fmtDate(h.date)}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Text style={styles.topTableMult}>{fmtMult(h.mult)}</Text>
                          <View style={styles.topShieldBadge}>
                            <Text style={styles.topShieldTxt}>✓</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                    {rows.length === 0 && <Text style={styles.emptyMsg}>No records for this period</Text>}
                  </View>
                );
              })()}

              {/* ── Win sub-tab: top wins ── */}
              {topSort === "Win" && (() => {
                const cutoff = topTime === "Day" ? 86400000 : topTime === "Month" ? 30 * 86400000 : 365 * 86400000;
                const rows = topBets.filter(t => Date.now() - new Date(t.date).getTime() < cutoff);
                return (
                  <View>
                    <View style={styles.topTableHeader}>
                      <Text style={styles.topTableHeaderTxt}>Player</Text>
                      <Text style={styles.topTableHeaderTxt}>Win INR</Text>
                    </View>
                    {rows.map((t, i) => (
                      <View key={i} style={styles.topTableRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={[styles.avatarCircle, { backgroundColor: AVATAR_COLORS[t.avatar % AVATAR_COLORS.length], width: 28, height: 28 }]}>
                            <Text style={[styles.avatarText, { fontSize: 12 }]}>{AVATAR_EMOJI[t.avatar % AVATAR_EMOJI.length]}</Text>
                          </View>
                          <View>
                            <Text style={styles.topTableUser}>{t.user}</Text>
                            <Text style={[styles.topTableMult, { fontSize: 10, color: multColor(t.mult) }]}>{t.mult.toFixed(2)}x</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Text style={[styles.topTableHeaderTxt, { color: "#00C853", fontSize: 13 }]}>₹{t.win.toLocaleString("en-IN")}</Text>
                          <View style={styles.topShieldBadge}><Text style={styles.topShieldTxt}>✓</Text></View>
                        </View>
                      </View>
                    ))}
                    {rows.length === 0 && <Text style={styles.emptyMsg}>No records for this period</Text>}
                  </View>
                );
              })()}

              {/* ── Rounds sub-tab: top players by rounds ── */}
              {topSort === "Rounds" && (() => {
                const ROUNDS_DATA = [
                  { user: "5***8", avatar: 3, rounds: 1842, wins: 1124 },
                  { user: "2***1", avatar: 6, rounds: 1567, wins: 892 },
                  { user: "7***4", avatar: 1, rounds: 1344, wins: 755 },
                  { user: "3***9", avatar: 5, rounds: 1122, wins: 612 },
                  { user: "9***2", avatar: 0, rounds: 987,  wins: 487 },
                  { user: "4***7", avatar: 2, rounds: 856,  wins: 398 },
                  { user: "8***5", avatar: 4, rounds: 742,  wins: 301 },
                  { user: "1***6", avatar: 7, rounds: 621,  wins: 244 },
                ];
                return (
                  <View>
                    <View style={styles.topTableHeader}>
                      <Text style={styles.topTableHeaderTxt}>Player</Text>
                      <Text style={styles.topTableHeaderTxt}>Rounds</Text>
                    </View>
                    {ROUNDS_DATA.map((r, i) => (
                      <View key={i} style={styles.topTableRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={[styles.avatarCircle, { backgroundColor: AVATAR_COLORS[r.avatar % AVATAR_COLORS.length], width: 28, height: 28 }]}>
                            <Text style={[styles.avatarText, { fontSize: 12 }]}>{AVATAR_EMOJI[r.avatar % AVATAR_EMOJI.length]}</Text>
                          </View>
                          <Text style={styles.topTableUser}>{r.user}</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View>
                            <Text style={[styles.topTableHeaderTxt, { fontSize: 13 }]}>{r.rounds.toLocaleString()}</Text>
                            <Text style={[styles.topTableDate, { textAlign: "right" }]}>{r.wins} wins</Text>
                          </View>
                          <View style={styles.topShieldBadge}><Text style={styles.topShieldTxt}>✓</Text></View>
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>
          )}
        </View>
      </View>
    </ScrollView>

    {/* ── Cashout toast (compact, centered) ── */}
    {cashoutPopup && (
      <Animated.View
        style={[styles.toastWrap, {
          top: insets.top + 10,
          opacity: popupOpacity,
          transform: [{ translateY: popupTranslateY }],
          pointerEvents: "none",
        }]}
      >
        <Text style={styles.toastEmoji}>🚀</Text>
        <View style={{ marginLeft: 8 }}>
          <Text style={styles.toastTitle}>{cashoutPopup.mult.toFixed(2)}x  ·  WIN</Text>
          <Text style={styles.toastAmt}>+₹{cashoutPopup.payout.toLocaleString("en-IN")}</Text>
        </View>
        <View style={styles.toastBadge}><Text style={styles.toastBadgeTxt}>✓</Text></View>
      </Animated.View>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10 },
  balanceChip: { backgroundColor: C.bgCard, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
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
  canvas: { width: CV_W, height: CV_H, backgroundColor: "#04000C", borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden", marginBottom: 12 },
  multOverlay: { alignItems: "center", justifyContent: "center" },
  multText: { fontSize: 54, fontFamily: "Inter_700Bold" },
  countLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, letterSpacing: 2, marginBottom: 2 },
  crashedLabel: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FF4500", letterSpacing: 5, marginTop: 4, textShadowColor: "#FF4500", textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
  dualPanel: { flexDirection: "row", gap: 8, marginBottom: 12 },
  betPanel: { flex: 1, backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 11 },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  panelLabel: { fontSize: 11, fontFamily: "Inter_700Bold", color: C.textMuted, letterSpacing: 2 },
  resultPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  resultPillText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  betAmtRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  amtBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,26,58,0.12)", borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  amtBtnText: { fontSize: 20, color: C.text, fontFamily: "Inter_700Bold", lineHeight: 24 },
  disabled: { opacity: 0.35 },
  betInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 9, paddingVertical: 7 },
  betInputPrefix: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.gold, marginRight: 2 },
  betInput: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold", color: C.text },
  presetRow: { flexDirection: "row", gap: 5, marginBottom: 10 },
  presetBtn: { flex: 1, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: C.border, alignItems: "center" },
  presetBtnActive: { backgroundColor: "rgba(255,26,58,0.18)", borderColor: C.primaryBright },
  presetText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted },
  presetTextActive: { color: C.red },
  mainBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  mainBtnText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFFFFF", letterSpacing: 0.8 },
  mainBtnSub: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFFFFF", marginTop: 1 },
  cashoutGlow: { shadowColor: "#FF6B00", shadowRadius: 16, shadowOpacity: 0.8, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  cashoutLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.75)", letterSpacing: 2, marginBottom: 1 },
  cashoutAmt: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFFFFF", letterSpacing: -0.5 },
  placedBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: "rgba(0,200,83,0.4)", backgroundColor: "rgba(0,200,83,0.07)" },
  placedBtnTop: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#00C853", letterSpacing: 1.5, marginBottom: 3 },
  placedBtnAmt: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 3 },
  placedBtnHint: { fontSize: 8, fontFamily: "Inter_500Medium", color: "rgba(255,26,58,0.7)", letterSpacing: 1.2 },
  mainBtnSub2: { fontSize: 9, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.55)", marginTop: 2, letterSpacing: 1 },
  betsPanel: { backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginTop: 0 },
  tabBar: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 20, padding: 3, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: 16 },
  tabActive: { backgroundColor: "rgba(255,255,255,0.12)" },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textMuted },
  tabTextActive: { color: C.text },
  betsSummaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  betsSummaryCount: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textMuted, marginLeft: 8 },
  betsSummaryWin: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  betsSummaryLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: C.textMuted },
  betsProgressBar: { height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2, marginBottom: 12 },
  betsProgressFill: { height: 4, backgroundColor: "#00C853", borderRadius: 2 },
  betsColHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", marginBottom: 4 },
  betsColText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.35)", letterSpacing: 0.5 },
  betRow2: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 2 },
  avatarText: { fontSize: 13 },
  betUser2: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.text },
  betAmt2: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textMuted, textAlign: "right" },
  betMult: { fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "center" },
  betWin: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  prevHeader: { alignItems: "center", paddingVertical: 14, marginBottom: 6 },
  prevLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textMuted, letterSpacing: 1.5, marginBottom: 4 },
  prevResult: { fontSize: 34, fontFamily: "Inter_700Bold" },
  topFilterRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  topFilterBtn: { flex: 1, paddingVertical: 6, alignItems: "center", borderRadius: 8, backgroundColor: "rgba(0,0,0,0.25)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  topFilterBtnActive: { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)" },
  topFilterText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted },
  topFilterTextActive: { color: C.text },
  topTableHeader: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", marginBottom: 2 },
  topTableHeaderTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted },
  topTableRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  topTableDate: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textMuted },
  topTableMult: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#C62AE8" },
  topTableUser: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.text },
  topShieldBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(120,120,140,0.2)", borderWidth: 1, borderColor: "rgba(180,180,200,0.25)", alignItems: "center", justifyContent: "center" },
  topShieldTxt: { fontSize: 13, color: "rgba(180,180,200,0.8)", fontFamily: "Inter_700Bold" },
  emptyMsg: { textAlign: "center", fontSize: 13, fontFamily: "Inter_500Medium", color: C.textMuted, paddingVertical: 24 },
  toastWrap: {
    position: "absolute", alignSelf: "center", zIndex: 999,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(4,14,4,0.92)",
    borderRadius: 50, borderWidth: 1, borderColor: "rgba(0,200,83,0.5)",
    paddingHorizontal: 14, paddingVertical: 9,
    shadowColor: "#00C853", shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14, shadowOpacity: 0.5, elevation: 12,
  },
  toastEmoji: { fontSize: 16 },
  toastTitle: { fontSize: 11, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.7)", letterSpacing: 0.3 },
  toastAmt: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFFFFF", lineHeight: 18 },
  toastBadge: {
    backgroundColor: "rgba(0,200,83,0.25)", borderRadius: 50, borderWidth: 1, borderColor: "rgba(0,200,83,0.5)",
    width: 24, height: 24, alignItems: "center", justifyContent: "center", marginLeft: 4,
  },
  toastBadgeTxt: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#00C853" },
});
