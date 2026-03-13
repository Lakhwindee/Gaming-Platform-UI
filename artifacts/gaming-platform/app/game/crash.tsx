import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
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
const { width } = Dimensions.get("window");
const GRAPH_H = 200;

const MOCK_PLAYERS = [
  { id: "1", username: "CryptoKing", wager: 500, status: "playing" as const },
  { id: "2", username: "NeonBlade", wager: 250, status: "playing" as const },
  { id: "3", username: "StarDust", wager: 1000, status: "playing" as const },
  { id: "4", username: "ShadowWolf", wager: 750, status: "playing" as const },
];

type GameStatus = "idle" | "betting" | "running" | "crashed" | "cashed";

function generateCrashPoint(): number {
  const r = Math.random();
  if (r < 0.3) return parseFloat((1 + Math.random() * 1.5).toFixed(2));
  if (r < 0.7) return parseFloat((2 + Math.random() * 4).toFixed(2));
  if (r < 0.9) return parseFloat((6 + Math.random() * 10).toFixed(2));
  return parseFloat((16 + Math.random() * 84).toFixed(2));
}

function MultiplierGraph({ multiplier, crashed }: { multiplier: number; crashed: boolean }) {
  const points = useRef<{ x: number; y: number }[]>([]);
  const canvasRef = useRef(new Animated.Value(0)).current;

  const maxMult = Math.max(multiplier * 1.2, 2);
  const graphWidth = width - 48;

  const getY = (m: number) => GRAPH_H - ((m - 1) / (maxMult - 1)) * (GRAPH_H - 20);
  const getX = (t: number, total: number) => (t / Math.max(total, 1)) * graphWidth;

  points.current.push({
    x: getX(points.current.length, points.current.length + 1),
    y: getY(multiplier),
  });

  const recent = points.current.slice(-60);

  return (
    <View style={styles.graphContainer}>
      <View
        style={[
          styles.graphBg,
          { backgroundColor: crashed ? C.neonRed + "08" : C.neonBlue + "08" },
        ]}
      >
        {[1.5, 2, 3, 5, 10].map((val) => {
          const y = getY(Math.min(val, maxMult));
          if (y < 0 || y > GRAPH_H) return null;
          return (
            <View
              key={val}
              style={[styles.gridLine, { top: y }]}
            >
              <Text style={styles.gridLabel}>{val}x</Text>
            </View>
          );
        })}
        <Animated.View
          style={[
            styles.graphLine,
            {
              bottom: GRAPH_H - getY(multiplier),
              width: getX(recent.length, recent.length) + 4,
              backgroundColor: crashed ? C.neonRed : C.neonBlue,
            },
          ]}
        />
      </View>
      <Text
        style={[
          styles.bigMultiplier,
          {
            color: crashed
              ? C.neonRed
              : multiplier >= 5
              ? C.neonGold
              : multiplier >= 2
              ? C.neonGreen
              : C.neonBlue,
          },
        ]}
      >
        {multiplier.toFixed(2)}x
      </Text>
      {crashed && (
        <Text style={styles.crashedLabel}>CRASHED!</Text>
      )}
    </View>
  );
}

export default function CrashGame() {
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn, addGameResult } = useGame();
  const [status, setStatus] = useState<GameStatus>("idle");
  const [wager, setWager] = useState("100");
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [cashoutAt, setCashoutAt] = useState(0);
  const [players, setPlayers] = useState(MOCK_PLAYERS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const pulseBig = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startGame = useCallback(() => {
    if (!isLoggedIn) {
      router.push("/auth");
      return;
    }
    const w = parseInt(wager, 10);
    if (isNaN(w) || w <= 0) return;
    if ((user?.balance ?? 0) < w) return;

    const cp = generateCrashPoint();
    setCrashPoint(cp);
    setMultiplier(1.0);
    setStatus("running");
    tickRef.current = 0;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    intervalRef.current = setInterval(() => {
      tickRef.current += 1;
      const elapsed = tickRef.current * 0.1;
      const newMult = parseFloat((1 + elapsed * elapsed * 0.08 + elapsed * 0.3).toFixed(2));

      setMultiplier(newMult);
      if (newMult >= 2) pulseBig();

      if (newMult >= cp) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setMultiplier(cp);
        setStatus("crashed");
        addGameResult({
          gameType: "crash",
          wager: w,
          multiplier: cp,
          payout: 0,
          won: false,
          details: { crashPoint: cp },
        });
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    }, 100);
  }, [isLoggedIn, wager, user, addGameResult]);

  const cashOut = useCallback(() => {
    if (status !== "running") return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    const w = parseInt(wager, 10);
    const payout = Math.floor(w * multiplier);
    setCashoutAt(multiplier);
    setStatus("cashed");
    addGameResult({
      gameType: "crash",
      wager: w,
      multiplier,
      payout,
      won: true,
      details: { cashoutMultiplier: multiplier, crashPoint },
    });
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [status, multiplier, wager, crashPoint, addGameResult]);

  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStatus("idle");
    setMultiplier(1.0);
    setCrashPoint(0);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const wagerNum = parseInt(wager, 10) || 0;
  const canBet = isLoggedIn && wagerNum > 0 && (user?.balance ?? 0) >= wagerNum;

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
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            reset();
            router.back();
          }}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={styles.gameTitle}>Crash</Text>
          <Text style={styles.gameSubtitle}>Cash out before it crashes!</Text>
        </View>
        <View style={styles.balancePill}>
          <Feather name="zap" size={13} color={C.neonGold} />
          <Text style={styles.balancePillText}>
            {(user?.balance ?? 0).toLocaleString()}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <MultiplierGraph
          multiplier={multiplier}
          crashed={status === "crashed"}
        />

        {status === "cashed" && (
          <View style={styles.resultBox}>
            <Feather name="check-circle" size={24} color={C.neonGreen} />
            <Text style={styles.resultTitle}>Cashed Out!</Text>
            <Text style={styles.resultValue}>
              {cashoutAt.toFixed(2)}x · +
              {(Math.floor(wagerNum * cashoutAt) - wagerNum).toLocaleString()} pts
            </Text>
          </View>
        )}

        {status === "crashed" && (
          <View style={[styles.resultBox, styles.resultBoxCrash]}>
            <Feather name="x-circle" size={24} color={C.neonRed} />
            <Text style={[styles.resultTitle, { color: C.neonRed }]}>
              Crashed at {crashPoint.toFixed(2)}x
            </Text>
            <Text style={styles.resultValue}>-{wagerNum.toLocaleString()} pts</Text>
          </View>
        )}

        <View style={styles.controlsSection}>
          <Text style={styles.wagerLabel}>WAGER AMOUNT</Text>
          <View style={styles.wagerRow}>
            <View style={styles.wagerInput}>
              <Feather name="dollar-sign" size={16} color={C.textMuted} />
              <TextInput
                style={styles.wagerTextInput}
                value={wager}
                onChangeText={setWager}
                keyboardType="numeric"
                placeholderTextColor={C.textMuted}
                editable={status === "idle" || status === "crashed" || status === "cashed"}
              />
              <Text style={styles.pts}>pts</Text>
            </View>
          </View>

          <View style={styles.quickBets}>
            {[50, 100, 250, 500].map((amt) => (
              <Pressable
                key={amt}
                onPress={() => setWager(String(amt))}
                disabled={status === "running"}
                style={({ pressed }) => [
                  styles.quickBetBtn,
                  wagerNum === amt && styles.quickBetBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.quickBetText,
                    wagerNum === amt && styles.quickBetTextActive,
                  ]}
                >
                  {amt}
                </Text>
              </Pressable>
            ))}
          </View>

          {status === "idle" || status === "crashed" || status === "cashed" ? (
            <Pressable
              onPress={startGame}
              disabled={!canBet}
              style={({ pressed }) => [
                styles.mainBtn,
                { backgroundColor: C.neonBlue },
                pressed && { opacity: 0.85 },
                !canBet && { opacity: 0.4 },
              ]}
            >
              <Text style={styles.mainBtnText}>
                {status === "idle" ? "Start Game" : "Play Again"}
              </Text>
              <Feather name="play" size={18} color="#000" />
            </Pressable>
          ) : (
            <Pressable
              onPress={cashOut}
              style={({ pressed }) => [
                styles.mainBtn,
                { backgroundColor: C.neonGreen },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.mainBtnText, { color: "#000" }]}>
                Cash Out — {multiplier.toFixed(2)}x
              </Text>
              <Text style={[styles.mainBtnSub, { color: "#000" }]}>
                +{(Math.floor(wagerNum * multiplier) - wagerNum).toLocaleString()} pts
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.playersSection}>
          <Text style={styles.sectionLabel}>ACTIVE PLAYERS</Text>
          {players.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              <View style={styles.playerDot} />
              <Text style={styles.playerName}>{p.username}</Text>
              <Text style={styles.playerWager}>
                {p.wager.toLocaleString()} pts
              </Text>
              <View style={styles.playerStatusBadge}>
                <Text style={styles.playerStatusText}>Playing</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  gameTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: C.text,
    textAlign: "center",
  },
  gameSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textSecondary,
    textAlign: "center",
  },
  balancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.neonGold + "20",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  balancePillText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: C.neonGold,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  graphContainer: {
    backgroundColor: C.surface,
    borderRadius: 20,
    marginTop: 16,
    marginBottom: 16,
    height: GRAPH_H + 70,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    overflow: "hidden",
  },
  graphBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  graphLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 3,
    borderRadius: 2,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: C.surfaceBorder,
  },
  gridLabel: {
    position: "absolute",
    right: 8,
    top: -10,
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: C.textMuted,
  },
  bigMultiplier: {
    fontFamily: "Inter_700Bold",
    fontSize: 64,
    letterSpacing: -2,
  },
  crashedLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: C.neonRed,
    letterSpacing: 2,
    marginTop: 4,
  },
  resultBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.neonGreen + "15",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.neonGreen + "30",
    marginBottom: 16,
  },
  resultBoxCrash: {
    backgroundColor: C.neonRed + "15",
    borderColor: C.neonRed + "30",
  },
  resultTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: C.neonGreen,
    flex: 1,
  },
  resultValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.textSecondary,
  },
  controlsSection: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    gap: 14,
  },
  wagerLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: C.textMuted,
    letterSpacing: 1.5,
  },
  wagerRow: {
    gap: 8,
  },
  wagerInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    gap: 8,
  },
  wagerTextInput: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: C.text,
  },
  pts: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textMuted,
  },
  quickBets: {
    flexDirection: "row",
    gap: 8,
  },
  quickBetBtn: {
    flex: 1,
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  quickBetBtnActive: {
    backgroundColor: C.neonBlue + "20",
    borderColor: C.neonBlue,
  },
  quickBetText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: C.textSecondary,
  },
  quickBetTextActive: {
    color: C.neonBlue,
  },
  mainBtn: {
    borderRadius: 16,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  mainBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#000",
  },
  mainBtnSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  playersSection: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: C.textMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.neonGreen,
  },
  playerName: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: C.text,
    flex: 1,
  },
  playerWager: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: C.textSecondary,
    marginRight: 8,
  },
  playerStatusBadge: {
    backgroundColor: C.neonGreen + "20",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  playerStatusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: C.neonGreen,
  },
});
