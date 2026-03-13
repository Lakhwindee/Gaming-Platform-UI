import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useGame, type GameHistoryEntry } from "@/context/GameContext";

const C = Colors.dark;

const GAME_ICONS: Record<string, string> = {
  crash: "trending-up",
  dice: "layers",
  coinflip: "refresh-cw",
};
const GAME_LABELS: Record<string, string> = {
  crash: "Crash",
  dice: "Dice Roll",
  coinflip: "Coin Flip",
};

function HistoryRow({ item }: { item: GameHistoryEntry }) {
  const isWin = item.won;
  const profit = item.payout - item.wager;
  const date = new Date(item.timestamp);
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.gameIconBox,
          {
            backgroundColor: isWin
              ? C.neonGreen + "20"
              : C.neonRed + "20",
          },
        ]}
      >
        <Feather
          name={GAME_ICONS[item.gameType] as any}
          size={20}
          color={isWin ? C.neonGreen : C.neonRed}
        />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.gameName}>{GAME_LABELS[item.gameType]}</Text>
        <Text style={styles.gameTime}>
          {dateStr} · {timeStr}
        </Text>
      </View>
      <View style={styles.rowMid}>
        <Text style={styles.wager}>{item.wager.toLocaleString()} pts</Text>
        <Text style={styles.multiplierLabel}>
          {item.multiplier.toFixed(2)}x
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text
          style={[
            styles.profitText,
            { color: isWin ? C.neonGreen : C.neonRed },
          ]}
        >
          {profit >= 0 ? "+" : ""}
          {profit.toLocaleString()}
        </Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: isWin ? C.neonGreen + "20" : C.neonRed + "20" },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: isWin ? C.neonGreen : C.neonRed },
            ]}
          >
            {isWin ? "WIN" : "LOSS"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function EmptyHistory() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name="clock" size={36} color={C.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No Games Yet</Text>
      <Text style={styles.emptyText}>
        Your game history will appear here after you play your first game.
      </Text>
    </View>
  );
}

function SummaryBar({ history }: { history: GameHistoryEntry[] }) {
  const wins = history.filter((h) => h.won).length;
  const losses = history.filter((h) => !h.won).length;
  const totalWagered = history.reduce((a, b) => a + b.wager, 0);
  const totalProfit = history.reduce(
    (a, b) => a + (b.payout - b.wager),
    0
  );

  return (
    <View style={styles.summaryBar}>
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryValue, { color: C.neonGreen }]}>{wins}</Text>
        <Text style={styles.summaryLabel}>Wins</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryValue, { color: C.neonRed }]}>{losses}</Text>
        <Text style={styles.summaryLabel}>Losses</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>
          {totalWagered >= 1000
            ? `${(totalWagered / 1000).toFixed(1)}K`
            : totalWagered}
        </Text>
        <Text style={styles.summaryLabel}>Wagered</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text
          style={[
            styles.summaryValue,
            { color: totalProfit >= 0 ? C.neonGreen : C.neonRed },
          ]}
        >
          {totalProfit >= 0 ? "+" : ""}
          {totalProfit >= 1000 || totalProfit <= -1000
            ? `${(totalProfit / 1000).toFixed(1)}K`
            : totalProfit}
        </Text>
        <Text style={styles.summaryLabel}>P&L</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { gameHistory } = useGame();

  return (
    <View style={styles.container}>
      <FlatList
        data={gameHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HistoryRow item={item} />}
        ListEmptyComponent={<EmptyHistory />}
        ListHeaderComponent={
          <View
            style={[
              styles.header,
              {
                paddingTop:
                  insets.top + (Platform.OS === "web" ? 67 : 16),
              },
            ]}
          >
            <View style={styles.headerRow}>
              <Feather name="clock" size={24} color={C.neonBlue} />
              <Text style={styles.headerTitle}>Game History</Text>
            </View>
            {gameHistory.length > 0 && (
              <SummaryBar history={gameHistory} />
            )}
          </View>
        }
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: Platform.OS === "web" ? 34 : 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: C.text,
    letterSpacing: -0.5,
  },
  summaryBar: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: C.text,
    marginBottom: 2,
  },
  summaryLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.textMuted,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: C.surfaceBorder,
    marginVertical: 4,
  },
  listContent: {
    paddingHorizontal: 16,
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
  gameIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  rowInfo: {
    flex: 1,
  },
  gameName: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: C.text,
    marginBottom: 3,
  },
  gameTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textMuted,
  },
  rowMid: {
    alignItems: "center",
    marginRight: 8,
  },
  wager: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textSecondary,
  },
  multiplierLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: C.neonBlue,
    marginTop: 2,
  },
  rowRight: {
    alignItems: "flex-end",
    minWidth: 60,
  },
  profitText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    marginBottom: 4,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: C.text,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
