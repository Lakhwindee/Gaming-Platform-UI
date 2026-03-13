import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
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
type Prediction = "high" | "low";
type GameState = "idle" | "rolling" | "result";

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function DiceDisplay({
  value,
  rolling,
}: {
  value: number;
  rolling: boolean;
}) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (rolling) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        { iterations: 5 }
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 5 }
      ).start();
    } else {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 4,
        useNativeDriver: true,
      }).start();
    }
  }, [rolling]);

  return (
    <Animated.View
      style={[styles.diceContainer, { transform: [{ scale: scaleAnim }] }]}
    >
      <Text style={styles.diceFace}>{DICE_FACES[Math.max(0, value - 1)]}</Text>
      <Text style={styles.diceValue}>{value}</Text>
    </Animated.View>
  );
}

export default function DiceGame() {
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn, addGameResult } = useGame();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [wager, setWager] = useState("100");
  const [diceValue, setDiceValue] = useState(3);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [lastResult, setLastResult] = useState<{
    won: boolean;
    dice: number;
    payout: number;
    wager: number;
  } | null>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;

  const roll = useCallback(() => {
    if (!isLoggedIn) {
      router.push("/auth");
      return;
    }
    if (!prediction) return;
    const w = parseInt(wager, 10);
    if (isNaN(w) || w <= 0 || (user?.balance ?? 0) < w) return;

    setGameState("rolling");
    setLastResult(null);

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    let ticks = 0;
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      ticks++;
      if (ticks >= 12) {
        clearInterval(interval);
        const finalValue = Math.floor(Math.random() * 6) + 1;
        setDiceValue(finalValue);

        const won =
          (prediction === "high" && finalValue >= 4) ||
          (prediction === "low" && finalValue <= 3);
        const payout = won ? Math.floor(w * 1.95) : 0;

        addGameResult({
          gameType: "dice",
          wager: w,
          multiplier: won ? 1.95 : 0,
          payout,
          won,
          details: { diceValue: finalValue, prediction },
        });

        setLastResult({ won, dice: finalValue, payout, wager: w });
        setGameState("result");
        resultOpacity.setValue(0);
        Animated.timing(resultOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();

        if (Platform.OS !== "web") {
          won
            ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    }, 80);
  }, [isLoggedIn, prediction, wager, user, addGameResult]);

  const wagerNum = parseInt(wager, 10) || 0;
  const canRoll =
    isLoggedIn && prediction !== null && wagerNum > 0 && (user?.balance ?? 0) >= wagerNum;

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
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={styles.gameTitle}>Dice Roll</Text>
          <Text style={styles.gameSubtitle}>Predict high or low!</Text>
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
        <View style={styles.gameArea}>
          <DiceDisplay value={diceValue} rolling={gameState === "rolling"} />

          <View style={styles.rangeInfo}>
            <View style={styles.rangeBox}>
              <Text style={[styles.rangeValue, { color: C.neonPurple }]}>1–3</Text>
              <Text style={styles.rangeLabel}>LOW</Text>
            </View>
            <Feather name="arrow-right" size={20} color={C.textMuted} />
            <View style={styles.rangeBox}>
              <Text style={[styles.rangeValue, { color: C.neonBlue }]}>4–6</Text>
              <Text style={styles.rangeLabel}>HIGH</Text>
            </View>
          </View>
        </View>

        {lastResult && gameState === "result" && (
          <Animated.View
            style={[
              styles.resultBanner,
              lastResult.won ? styles.resultBannerWin : styles.resultBannerLoss,
              { opacity: resultOpacity },
            ]}
          >
            <Feather
              name={lastResult.won ? "check-circle" : "x-circle"}
              size={22}
              color={lastResult.won ? C.neonGreen : C.neonRed}
            />
            <View>
              <Text
                style={[
                  styles.resultTitle,
                  { color: lastResult.won ? C.neonGreen : C.neonRed },
                ]}
              >
                {lastResult.won ? "You Won!" : "You Lost!"}
              </Text>
              <Text style={styles.resultSub}>
                Rolled {lastResult.dice} ·{" "}
                {lastResult.won
                  ? `+${(lastResult.payout - lastResult.wager).toLocaleString()} pts`
                  : `-${lastResult.wager.toLocaleString()} pts`}
              </Text>
            </View>
          </Animated.View>
        )}

        <View style={styles.controls}>
          <Text style={styles.label}>YOUR PREDICTION</Text>
          <View style={styles.predictionRow}>
            <Pressable
              onPress={() => setPrediction("low")}
              disabled={gameState === "rolling"}
              style={({ pressed }) => [
                styles.predBtn,
                prediction === "low" && {
                  borderColor: C.neonPurple,
                  backgroundColor: C.neonPurple + "20",
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.predBtnEmoji}>⬇️</Text>
              <Text
                style={[
                  styles.predBtnText,
                  prediction === "low" && { color: C.neonPurple },
                ]}
              >
                LOW (1–3)
              </Text>
              <Text style={styles.predOdds}>1.95x</Text>
            </Pressable>
            <Pressable
              onPress={() => setPrediction("high")}
              disabled={gameState === "rolling"}
              style={({ pressed }) => [
                styles.predBtn,
                prediction === "high" && {
                  borderColor: C.neonBlue,
                  backgroundColor: C.neonBlue + "20",
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.predBtnEmoji}>⬆️</Text>
              <Text
                style={[
                  styles.predBtnText,
                  prediction === "high" && { color: C.neonBlue },
                ]}
              >
                HIGH (4–6)
              </Text>
              <Text style={styles.predOdds}>1.95x</Text>
            </Pressable>
          </View>

          <Text style={[styles.label, { marginTop: 8 }]}>WAGER</Text>
          <View style={styles.wagerInput}>
            <Feather name="dollar-sign" size={16} color={C.textMuted} />
            <TextInput
              style={styles.wagerTextInput}
              value={wager}
              onChangeText={setWager}
              keyboardType="numeric"
              placeholderTextColor={C.textMuted}
              editable={gameState !== "rolling"}
            />
            <Text style={styles.pts}>pts</Text>
          </View>

          <View style={styles.quickBets}>
            {[50, 100, 250, 500].map((amt) => (
              <Pressable
                key={amt}
                onPress={() => setWager(String(amt))}
                disabled={gameState === "rolling"}
                style={({ pressed }) => [
                  styles.quickBetBtn,
                  wagerNum === amt && styles.quickBetBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.quickBetText,
                    wagerNum === amt && { color: C.neonPurple },
                  ]}
                >
                  {amt}
                </Text>
              </Pressable>
            ))}
          </View>

          {wagerNum > 0 && prediction && (
            <View style={styles.potentialWin}>
              <Feather name="trending-up" size={14} color={C.neonGreen} />
              <Text style={styles.potentialWinText}>
                Potential win:{" "}
                <Text style={{ color: C.neonGreen, fontFamily: "Inter_700Bold" }}>
                  +{(Math.floor(wagerNum * 1.95) - wagerNum).toLocaleString()} pts
                </Text>
              </Text>
            </View>
          )}

          <Pressable
            onPress={roll}
            disabled={!canRoll || gameState === "rolling"}
            style={({ pressed }) => [
              styles.rollBtn,
              { backgroundColor: C.neonPurple },
              pressed && { opacity: 0.85 },
              (!canRoll || gameState === "rolling") && { opacity: 0.4 },
            ]}
          >
            <Text style={styles.rollBtnText}>
              {gameState === "rolling" ? "Rolling..." : "Roll Dice"}
            </Text>
            <Feather name="shuffle" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How to Play</Text>
          <Text style={styles.infoText}>
            Predict if the dice lands on 1–3 (Low) or 4–6 (High). Win 1.95x your wager on correct predictions.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
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
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.surface,
    justifyContent: "center", alignItems: "center",
  },
  gameTitle: {
    fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, textAlign: "center",
  },
  gameSubtitle: {
    fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, textAlign: "center",
  },
  balancePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: C.neonGold + "20", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  balancePillText: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.neonGold },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  gameArea: {
    backgroundColor: C.surface, borderRadius: 20, marginTop: 16, marginBottom: 14,
    padding: 24, alignItems: "center", borderWidth: 1, borderColor: C.surfaceBorder,
  },
  diceContainer: { alignItems: "center", marginBottom: 16 },
  diceFace: { fontSize: 90 },
  diceValue: {
    fontFamily: "Inter_700Bold", fontSize: 40, color: C.text,
    letterSpacing: -1, marginTop: -8,
  },
  rangeInfo: {
    flexDirection: "row", alignItems: "center", gap: 16,
  },
  rangeBox: { alignItems: "center" },
  rangeValue: { fontFamily: "Inter_700Bold", fontSize: 20 },
  rangeLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted, marginTop: 2 },
  resultBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1,
  },
  resultBannerWin: {
    backgroundColor: C.neonGreen + "15", borderColor: C.neonGreen + "40",
  },
  resultBannerLoss: {
    backgroundColor: C.neonRed + "15", borderColor: C.neonRed + "40",
  },
  resultTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  resultSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 2 },
  controls: {
    backgroundColor: C.surface, borderRadius: 20, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: C.surfaceBorder, gap: 14,
  },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textMuted, letterSpacing: 1.5 },
  predictionRow: { flexDirection: "row", gap: 10 },
  predBtn: {
    flex: 1, backgroundColor: C.surfaceElevated, borderRadius: 14,
    padding: 16, alignItems: "center", gap: 6,
    borderWidth: 2, borderColor: C.surfaceBorder,
  },
  predBtnEmoji: { fontSize: 28 },
  predBtnText: {
    fontFamily: "Inter_700Bold", fontSize: 14, color: C.textSecondary,
  },
  predOdds: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted },
  wagerInput: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surfaceElevated, borderRadius: 12,
    paddingHorizontal: 14, height: 50,
    borderWidth: 1, borderColor: C.surfaceBorder, gap: 8,
  },
  wagerTextInput: {
    flex: 1, fontFamily: "Inter_700Bold", fontSize: 20, color: C.text,
  },
  pts: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textMuted },
  quickBets: { flexDirection: "row", gap: 8 },
  quickBetBtn: {
    flex: 1, backgroundColor: C.surfaceElevated, borderRadius: 10,
    paddingVertical: 10, alignItems: "center",
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  quickBetBtnActive: { backgroundColor: C.neonPurple + "20", borderColor: C.neonPurple },
  quickBetText: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.textSecondary },
  potentialWin: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.neonGreen + "10", borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: C.neonGreen + "20",
  },
  potentialWinText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  rollBtn: {
    borderRadius: 16, height: 56,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10,
  },
  rollBtnText: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff" },
  infoCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  infoTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text, marginBottom: 6 },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 20 },
});
