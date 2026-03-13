import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Easing,
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
type Side = "heads" | "tails";
type GameState = "idle" | "flipping" | "result";

function CoinView({ side, flipping }: { side: Side; flipping: boolean }) {
  const flipAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (flipping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(flipAnim, {
            toValue: 1,
            duration: 300,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(flipAnim, {
            toValue: 0,
            duration: 300,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 5 }
      ).start();
    } else {
      flipAnim.setValue(0);
    }
  }, [flipping]);

  const scaleX = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.1, 1],
  });

  const isHeads = side === "heads";

  return (
    <View style={styles.coinArea}>
      <Animated.View
        style={[
          styles.coin,
          {
            backgroundColor: isHeads ? C.neonGold + "30" : C.neonPurple + "30",
            borderColor: isHeads ? C.neonGold : C.neonPurple,
            transform: [{ scaleX }],
          },
        ]}
      >
        <Text style={styles.coinEmoji}>{isHeads ? "🟡" : "🟣"}</Text>
        <Text style={[styles.coinLabel, { color: isHeads ? C.neonGold : C.neonPurple }]}>
          {flipping ? "..." : isHeads ? "HEADS" : "TAILS"}
        </Text>
      </Animated.View>
    </View>
  );
}

export default function CoinFlipGame() {
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn, addGameResult } = useGame();
  const [pick, setPick] = useState<Side | null>(null);
  const [wager, setWager] = useState("100");
  const [result, setResult] = useState<Side>("heads");
  const [gameState, setGameState] = useState<GameState>("idle");
  const [lastResult, setLastResult] = useState<{
    won: boolean;
    side: Side;
    wager: number;
    payout: number;
  } | null>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;

  const flip = useCallback(() => {
    if (!isLoggedIn) {
      router.push("/auth");
      return;
    }
    if (!pick) return;
    const w = parseInt(wager, 10);
    if (isNaN(w) || w <= 0 || (user?.balance ?? 0) < w) return;

    setGameState("flipping");
    setLastResult(null);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setTimeout(() => {
      const finalSide: Side = Math.random() < 0.5 ? "heads" : "tails";
      const won = finalSide === pick;
      const payout = won ? Math.floor(w * 1.98) : 0;

      setResult(finalSide);
      setGameState("result");
      setLastResult({ won, side: finalSide, wager: w, payout });
      resultOpacity.setValue(0);
      Animated.timing(resultOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      addGameResult({
        gameType: "coinflip",
        wager: w,
        multiplier: won ? 1.98 : 0,
        payout,
        won,
        details: { result: finalSide, prediction: pick },
      });

      if (Platform.OS !== "web") {
        won
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }, 1600);
  }, [isLoggedIn, pick, wager, user, addGameResult]);

  const wagerNum = parseInt(wager, 10) || 0;
  const canFlip = isLoggedIn && pick !== null && wagerNum > 0 && (user?.balance ?? 0) >= wagerNum;
  const displaySide = gameState === "result" ? result : pick ?? "heads";

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
          <Text style={styles.gameTitle}>Coin Flip</Text>
          <Text style={styles.gameSubtitle}>Heads or tails?</Text>
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
        <View style={styles.gameCenter}>
          <CoinView side={displaySide} flipping={gameState === "flipping"} />

          {lastResult && gameState === "result" && (
            <Animated.View
              style={[
                styles.resultBanner,
                lastResult.won ? styles.resultWin : styles.resultLoss,
                { opacity: resultOpacity },
              ]}
            >
              <Text style={styles.resultEmoji}>
                {lastResult.won ? "🎉" : "😔"}
              </Text>
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
                  {lastResult.side === "heads" ? "Heads" : "Tails"} landed ·{" "}
                  {lastResult.won
                    ? `+${(lastResult.payout - lastResult.wager).toLocaleString()} pts`
                    : `-${lastResult.wager.toLocaleString()} pts`}
                </Text>
              </View>
            </Animated.View>
          )}
        </View>

        <View style={styles.pickSection}>
          <Text style={styles.label}>PICK YOUR SIDE</Text>
          <View style={styles.pickRow}>
            <Pressable
              onPress={() => setPick("heads")}
              disabled={gameState === "flipping"}
              style={({ pressed }) => [
                styles.pickBtn,
                pick === "heads" && {
                  borderColor: C.neonGold,
                  backgroundColor: C.neonGold + "15",
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.pickEmoji}>🟡</Text>
              <Text
                style={[
                  styles.pickLabel,
                  pick === "heads" && { color: C.neonGold },
                ]}
              >
                HEADS
              </Text>
              <Text style={styles.pickOdds}>1.98x</Text>
            </Pressable>
            <Text style={styles.vsText}>VS</Text>
            <Pressable
              onPress={() => setPick("tails")}
              disabled={gameState === "flipping"}
              style={({ pressed }) => [
                styles.pickBtn,
                pick === "tails" && {
                  borderColor: C.neonPurple,
                  backgroundColor: C.neonPurple + "15",
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.pickEmoji}>🟣</Text>
              <Text
                style={[
                  styles.pickLabel,
                  pick === "tails" && { color: C.neonPurple },
                ]}
              >
                TAILS
              </Text>
              <Text style={styles.pickOdds}>1.98x</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.controls}>
          <Text style={styles.label}>WAGER</Text>
          <View style={styles.wagerInput}>
            <Feather name="dollar-sign" size={16} color={C.textMuted} />
            <TextInput
              style={styles.wagerTextInput}
              value={wager}
              onChangeText={setWager}
              keyboardType="numeric"
              placeholderTextColor={C.textMuted}
              editable={gameState !== "flipping"}
            />
            <Text style={styles.pts}>pts</Text>
          </View>

          <View style={styles.quickBets}>
            {[50, 100, 250, 500].map((amt) => (
              <Pressable
                key={amt}
                onPress={() => setWager(String(amt))}
                disabled={gameState === "flipping"}
                style={({ pressed }) => [
                  styles.quickBetBtn,
                  wagerNum === amt && styles.quickBetBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.quickBetText,
                    wagerNum === amt && { color: C.neonGold },
                  ]}
                >
                  {amt}
                </Text>
              </Pressable>
            ))}
          </View>

          {wagerNum > 0 && pick && (
            <View style={styles.potentialWin}>
              <Feather name="trending-up" size={14} color={C.neonGreen} />
              <Text style={styles.potentialWinText}>
                Potential win:{" "}
                <Text style={{ color: C.neonGreen, fontFamily: "Inter_700Bold" }}>
                  +{(Math.floor(wagerNum * 1.98) - wagerNum).toLocaleString()} pts
                </Text>
              </Text>
            </View>
          )}

          <Pressable
            onPress={flip}
            disabled={!canFlip || gameState === "flipping"}
            style={({ pressed }) => [
              styles.flipBtn,
              {
                backgroundColor:
                  pick === "tails"
                    ? C.neonPurple
                    : C.neonGold,
              },
              pressed && { opacity: 0.85 },
              (!canFlip || gameState === "flipping") && { opacity: 0.4 },
            ]}
          >
            <Text
              style={[
                styles.flipBtnText,
                { color: pick === "tails" ? "#fff" : "#000" },
              ]}
            >
              {gameState === "flipping" ? "Flipping..." : "Flip Coin"}
            </Text>
            <Feather
              name="refresh-cw"
              size={20}
              color={pick === "tails" ? "#fff" : "#000"}
            />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: C.neonGold }]}>50%</Text>
            <Text style={styles.statLabel}>Heads</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: C.neonPurple }]}>50%</Text>
            <Text style={styles.statLabel}>Tails</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>1.98x</Text>
            <Text style={styles.statLabel}>Payout</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface,
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
  gameCenter: {
    backgroundColor: C.surface, borderRadius: 20, marginTop: 16, marginBottom: 14,
    padding: 24, alignItems: "center", borderWidth: 1, borderColor: C.surfaceBorder,
    gap: 16,
  },
  coinArea: { alignItems: "center" },
  coin: {
    width: 140, height: 140, borderRadius: 70,
    justifyContent: "center", alignItems: "center",
    borderWidth: 4, gap: 8,
  },
  coinEmoji: { fontSize: 52 },
  coinLabel: { fontFamily: "Inter_700Bold", fontSize: 16, letterSpacing: 2 },
  resultBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, padding: 14, width: "100%",
    borderWidth: 1,
  },
  resultWin: { backgroundColor: C.neonGreen + "15", borderColor: C.neonGreen + "40" },
  resultLoss: { backgroundColor: C.neonRed + "15", borderColor: C.neonRed + "40" },
  resultEmoji: { fontSize: 28 },
  resultTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  resultSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 2 },
  pickSection: {
    backgroundColor: C.surface, borderRadius: 20, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: C.surfaceBorder, gap: 12,
  },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textMuted, letterSpacing: 1.5 },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pickBtn: {
    flex: 1, backgroundColor: C.surfaceElevated, borderRadius: 14,
    padding: 16, alignItems: "center", gap: 8,
    borderWidth: 2, borderColor: C.surfaceBorder,
  },
  pickEmoji: { fontSize: 36 },
  pickLabel: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.textSecondary },
  pickOdds: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted },
  vsText: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.textMuted },
  controls: {
    backgroundColor: C.surface, borderRadius: 20, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: C.surfaceBorder, gap: 14,
  },
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
  quickBetBtnActive: { backgroundColor: C.neonGold + "20", borderColor: C.neonGold },
  quickBetText: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.textSecondary },
  potentialWin: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.neonGreen + "10", borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: C.neonGreen + "20",
  },
  potentialWinText: {
    fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary,
  },
  flipBtn: {
    borderRadius: 16, height: 56,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10,
  },
  flipBtnText: { fontFamily: "Inter_700Bold", fontSize: 18 },
  statsRow: {
    flexDirection: "row", backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.surfaceBorder, alignItems: "center",
  },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, marginBottom: 4 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted },
  statDivider: { width: 1, height: 40, backgroundColor: C.surfaceBorder },
});
