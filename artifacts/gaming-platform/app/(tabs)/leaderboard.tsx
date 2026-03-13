import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useGame } from "@/context/GameContext";

const C = Colors.dark;

const RANK_COLORS = [C.neonGold, "#C0C0C0", "#CD7F32"];

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <View
        style={[
          styles.rankBadgePodium,
          { backgroundColor: RANK_COLORS[rank - 1] + "20" },
        ]}
      >
        <Text
          style={[styles.rankBadgePodiumText, { color: RANK_COLORS[rank - 1] }]}
        >
          {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.rankBadge}>
      <Text style={styles.rankBadgeText}>#{rank}</Text>
    </View>
  );
}

function LeaderboardRow({
  entry,
  index,
  isCurrentUser,
}: {
  entry: { id: string; username: string; avatar: string; totalWinnings: number; rank: number; level: number };
  index: number;
  isCurrentUser: boolean;
}) {
  const translateX = useRef(new Animated.Value(-30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.row,
        isCurrentUser && styles.rowHighlighted,
        { opacity, transform: [{ translateX }] },
      ]}
    >
      <RankBadge rank={entry.rank} />
      <View style={styles.rowAvatar}>
        <Text style={styles.avatarEmoji}>{entry.avatar}</Text>
      </View>
      <View style={styles.rowInfo}>
        <View style={styles.rowNameRow}>
          <Text
            style={[styles.rowName, isCurrentUser && { color: C.neonBlue }]}
          >
            {entry.username}
          </Text>
          {isCurrentUser && (
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>YOU</Text>
            </View>
          )}
        </View>
        <Text style={styles.rowLevel}>Level {entry.level}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowWinnings}>
          {entry.totalWinnings >= 1000
            ? `${(entry.totalWinnings / 1000).toFixed(1)}K`
            : entry.totalWinnings.toLocaleString()}
        </Text>
        <Text style={styles.rowWinningsLabel}>pts won</Text>
      </View>
    </Animated.View>
  );
}

function PodiumView({ entries }: { entries: { id: string; username: string; avatar: string; totalWinnings: number; rank: number; level: number }[] }) {
  const top3 = entries.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]];
  const heights = [80, 110, 60];
  const rankOrder = [2, 1, 3];

  return (
    <View style={styles.podium}>
      {podiumOrder.map((entry, i) => (
        <View key={entry?.id ?? i} style={styles.podiumCol}>
          <Text style={styles.podiumEmoji}>{entry?.avatar}</Text>
          <Text style={styles.podiumName} numberOfLines={1}>
            {entry?.username}
          </Text>
          <View
            style={[
              styles.podiumBlock,
              {
                height: heights[i],
                backgroundColor: RANK_COLORS[rankOrder[i] - 1] + "30",
                borderColor: RANK_COLORS[rankOrder[i] - 1] + "60",
              },
            ]}
          >
            <Text
              style={[
                styles.podiumRankText,
                { color: RANK_COLORS[rankOrder[i] - 1] },
              ]}
            >
              {rankOrder[i] === 1 ? "🥇" : rankOrder[i] === 2 ? "🥈" : "🥉"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { leaderboard, user } = useGame();

  const userIsOnBoard = leaderboard.find((e) => e.id === user?.id);

  return (
    <View style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
            paddingBottom: Platform.OS === "web" ? 34 : 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Feather name="award" size={24} color={C.neonGold} />
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </View>

        <PodiumView entries={leaderboard} />

        <Text style={styles.listTitle}>All Rankings</Text>

        {leaderboard.map((entry, index) => (
          <LeaderboardRow
            key={entry.id}
            entry={entry}
            index={index}
            isCurrentUser={entry.id === user?.id}
          />
        ))}

        {!userIsOnBoard && user && (
          <View style={styles.userRankBanner}>
            <Feather name="user" size={16} color={C.textSecondary} />
            <Text style={styles.userRankBannerText}>
              Play more games to appear on the leaderboard!
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  content: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: C.text,
    letterSpacing: -0.5,
  },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    marginBottom: 28,
    paddingHorizontal: 16,
    gap: 8,
  },
  podiumCol: {
    flex: 1,
    alignItems: "center",
  },
  podiumEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  podiumName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: C.textSecondary,
    marginBottom: 6,
    maxWidth: 80,
    textAlign: "center",
  },
  podiumBlock: {
    width: "100%",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  podiumRankText: {
    fontSize: 24,
    marginVertical: 8,
  },
  listTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: C.text,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    gap: 12,
  },
  rowHighlighted: {
    borderColor: C.neonBlue + "60",
    backgroundColor: C.neonBlue + "10",
  },
  rankBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  rankBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: C.textSecondary,
  },
  rankBadgePodium: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  rankBadgePodiumText: {
    fontSize: 20,
  },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarEmoji: {
    fontSize: 20,
  },
  rowInfo: {
    flex: 1,
  },
  rowNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowName: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: C.text,
  },
  youBadge: {
    backgroundColor: C.neonBlue + "20",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  youBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: C.neonBlue,
    letterSpacing: 1,
  },
  rowLevel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
  rowRight: {
    alignItems: "flex-end",
  },
  rowWinnings: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: C.neonGreen,
  },
  rowWinningsLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.textMuted,
  },
  userRankBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  userRankBannerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
    flex: 1,
  },
});
