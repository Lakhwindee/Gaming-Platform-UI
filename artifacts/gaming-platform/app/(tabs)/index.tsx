import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
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
const { width } = Dimensions.get("window");

type Game = {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: "/game/crash" | "/game/dice" | "/game/coinflip";
  accentColor: string;
  tag: string;
  multiplier: string;
};

const GAMES: Game[] = [
  {
    id: "crash",
    name: "Crash",
    description: "Watch the multiplier climb. Cash out before it crashes!",
    icon: "trending-up",
    route: "/game/crash",
    accentColor: C.neonBlue,
    tag: "MULTIPLAYER",
    multiplier: "Up to 100x",
  },
  {
    id: "dice",
    name: "Dice Roll",
    description: "Predict if the next roll lands high or low. Instant results.",
    icon: "layers",
    route: "/game/dice",
    accentColor: C.neonPurple,
    tag: "INSTANT",
    multiplier: "Up to 2x",
  },
  {
    id: "coinflip",
    name: "Coin Flip",
    description: "Heads or tails? Classic 50/50 excitement with style.",
    icon: "refresh-cw",
    route: "/game/coinflip",
    accentColor: C.neonGold,
    tag: "CLASSIC",
    multiplier: "1.98x",
  },
];

function PulseAnimation({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      {children}
    </Animated.View>
  );
}

function GameCard({ game, index }: { game: Game; index: number }) {
  const scale = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 120),
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push(game.route);
  };

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.gameCard,
          {
            borderColor: pressed
              ? game.accentColor
              : C.surfaceBorder,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View
          style={[
            styles.gameCardAccent,
            { backgroundColor: game.accentColor + "20" },
          ]}
        />
        <View style={styles.gameCardContent}>
          <View style={styles.gameCardLeft}>
            <View
              style={[
                styles.gameIconContainer,
                { backgroundColor: game.accentColor + "20" },
              ]}
            >
              <Feather name={game.icon as any} size={28} color={game.accentColor} />
            </View>
            <View style={styles.gameInfo}>
              <View style={styles.gameNameRow}>
                <Text style={styles.gameName}>{game.name}</Text>
                <View
                  style={[
                    styles.tagBadge,
                    { backgroundColor: game.accentColor + "20" },
                  ]}
                >
                  <Text style={[styles.tagText, { color: game.accentColor }]}>
                    {game.tag}
                  </Text>
                </View>
              </View>
              <Text style={styles.gameDescription}>{game.description}</Text>
              <Text
                style={[styles.gameMultiplier, { color: game.accentColor }]}
              >
                {game.multiplier}
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={C.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function BalanceCard() {
  const { user, isLoggedIn } = useGame();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmer]);

  if (!isLoggedIn) {
    return (
      <Pressable
        onPress={() => router.push("/auth")}
        style={styles.loginBanner}
      >
        <Text style={styles.loginBannerText}>
          Sign in to start playing and win big!
        </Text>
        <View style={styles.loginBannerBtn}>
          <Text style={styles.loginBannerBtnText}>Sign In</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.balanceCard}>
      <View style={styles.balanceLeft}>
        <Text style={styles.balanceLabel}>YOUR BALANCE</Text>
        <Text style={styles.balanceAmount}>
          {(user?.balance ?? 0).toLocaleString()}
          <Text style={styles.balanceCurrency}> pts</Text>
        </Text>
      </View>
      <View style={styles.balanceRight}>
        <View style={styles.balanceStat}>
          <Text style={styles.balanceStatValue}>{user?.totalWins ?? 0}</Text>
          <Text style={styles.balanceStatLabel}>Wins</Text>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceStat}>
          <Text style={styles.balanceStatValue}>Lv.{user?.level ?? 1}</Text>
          <Text style={styles.balanceStatLabel}>Level</Text>
        </View>
      </View>
    </View>
  );
}

export default function LobbyScreen() {
  const insets = useSafeAreaInsets();
  const headerY = useRef(new Animated.Value(-20)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerY, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop:
              insets.top + (Platform.OS === "web" ? 67 : 16),
            paddingBottom: Platform.OS === "web" ? 34 : 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerY }],
            },
          ]}
        >
          <View>
            <Text style={styles.headerGreeting}>Welcome to</Text>
            <Text style={styles.headerTitle}>NeonBet</Text>
          </View>
          <PulseAnimation color={C.neonBlue}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </PulseAnimation>
        </Animated.View>

        <BalanceCard />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Games</Text>
          <Text style={styles.sectionSubtitle}>Choose your game</Text>
        </View>

        {GAMES.map((game, index) => (
          <GameCard key={game.id} game={game} index={index} />
        ))}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>12,480</Text>
            <Text style={styles.statBoxLabel}>Active Players</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statBoxValue, { color: C.neonGreen }]}>
              $4.2M
            </Text>
            <Text style={styles.statBoxLabel}>Total Wagered</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statBoxValue, { color: C.neonGold }]}>
              98.2%
            </Text>
            <Text style={styles.statBoxLabel}>Return Rate</Text>
          </View>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerGreeting: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textSecondary,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: C.text,
    letterSpacing: -1,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.neonGreen + "20",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: C.neonGreen + "40",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.neonGreen,
  },
  liveText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: C.neonGreen,
    letterSpacing: 1,
  },
  loginBanner: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.neonBlue + "40",
  },
  loginBannerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: C.textSecondary,
    flex: 1,
    marginRight: 12,
  },
  loginBannerBtn: {
    backgroundColor: C.neonBlue,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loginBannerBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#000",
  },
  balanceCard: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
    borderWidth: 1,
    borderColor: C.neonBlue + "30",
  },
  balanceLeft: {
    flex: 1,
  },
  balanceLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: C.textMuted,
    letterSpacing: 2,
    marginBottom: 4,
  },
  balanceAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: C.text,
    letterSpacing: -1,
  },
  balanceCurrency: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: C.textSecondary,
  },
  balanceRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  balanceStat: {
    alignItems: "center",
  },
  balanceStatValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: C.neonBlue,
  },
  balanceStatLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.textMuted,
    marginTop: 2,
  },
  balanceDivider: {
    width: 1,
    height: 32,
    backgroundColor: C.surfaceBorder,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: C.text,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textMuted,
    marginTop: 2,
  },
  gameCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    position: "relative",
  },
  gameCardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  gameCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
  },
  gameCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 14,
  },
  gameIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  gameInfo: {
    flex: 1,
  },
  gameNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  gameName: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: C.text,
  },
  tagBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1,
  },
  gameDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 6,
    lineHeight: 18,
  },
  gameMultiplier: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  statBoxValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: C.text,
    marginBottom: 4,
  },
  statBoxLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.textMuted,
    textAlign: "center",
  },
});
