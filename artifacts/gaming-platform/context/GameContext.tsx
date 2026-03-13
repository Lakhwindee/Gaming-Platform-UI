import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type User = {
  id: string;
  username: string;
  email: string;
  avatar: string;
  balance: number;
  totalWins: number;
  totalLosses: number;
  totalWagered: number;
  rank: number;
  level: number;
  xp: number;
  joinedAt: string;
};

export type GameHistoryEntry = {
  id: string;
  gameType: "crash" | "dice" | "coinflip";
  wager: number;
  multiplier: number;
  payout: number;
  won: boolean;
  timestamp: string;
  details: Record<string, unknown>;
};

export type LeaderboardEntry = {
  id: string;
  username: string;
  avatar: string;
  totalWinnings: number;
  rank: number;
  level: number;
};

type GameContextType = {
  user: User | null;
  isLoggedIn: boolean;
  gameHistory: GameHistoryEntry[];
  leaderboard: LeaderboardEntry[];
  login: (username: string, password: string) => Promise<boolean>;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<boolean>;
  logout: () => void;
  addGameResult: (entry: Omit<GameHistoryEntry, "id" | "timestamp">) => void;
  updateBalance: (newBalance: number) => void;
};

const GameContext = createContext<GameContextType | null>(null);

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: "1",
    username: "CryptoKing",
    avatar: "👑",
    totalWinnings: 485200,
    rank: 1,
    level: 50,
  },
  {
    id: "2",
    username: "NeonBlade",
    avatar: "⚡",
    totalWinnings: 342100,
    rank: 2,
    level: 45,
  },
  {
    id: "3",
    username: "ShadowWolf",
    avatar: "🐺",
    totalWinnings: 298700,
    rank: 3,
    level: 42,
  },
  {
    id: "4",
    username: "StarDust",
    avatar: "✨",
    totalWinnings: 187500,
    rank: 4,
    level: 38,
  },
  {
    id: "5",
    username: "IronFist",
    avatar: "🥊",
    totalWinnings: 156300,
    rank: 5,
    level: 35,
  },
  {
    id: "6",
    username: "PixelHunter",
    avatar: "🎯",
    totalWinnings: 134800,
    rank: 6,
    level: 32,
  },
  {
    id: "7",
    username: "VortexX",
    avatar: "🌀",
    totalWinnings: 112000,
    rank: 7,
    level: 30,
  },
  {
    id: "8",
    username: "NightOwl",
    avatar: "🦉",
    totalWinnings: 98500,
    rank: 8,
    level: 28,
  },
  {
    id: "9",
    username: "BlazeRun",
    avatar: "🔥",
    totalWinnings: 87200,
    rank: 9,
    level: 26,
  },
  {
    id: "10",
    username: "GhostRider",
    avatar: "💀",
    totalWinnings: 76100,
    rank: 10,
    level: 24,
  },
];

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
  const [leaderboard] = useState<LeaderboardEntry[]>(MOCK_LEADERBOARD);
  const isLoggedIn = user !== null;
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem("user");
      const storedHistory = await AsyncStorage.getItem("gameHistory");
      if (storedUser) setUser(JSON.parse(storedUser));
      if (storedHistory) setGameHistory(JSON.parse(storedHistory));
    } catch (e) {
      console.error("Failed to load stored data", e);
    }
  };

  const saveUser = async (u: User) => {
    await AsyncStorage.setItem("user", JSON.stringify(u));
  };

  const saveHistory = async (h: GameHistoryEntry[]) => {
    await AsyncStorage.setItem("gameHistory", JSON.stringify(h));
  };

  const login = useCallback(
    async (username: string, _password: string): Promise<boolean> => {
      const newUser: User = {
        id: generateId(),
        username,
        email: `${username.toLowerCase()}@neonbet.gg`,
        avatar: "🎮",
        balance: 5000,
        totalWins: 0,
        totalLosses: 0,
        totalWagered: 0,
        rank: 999,
        level: 1,
        xp: 0,
        joinedAt: new Date().toISOString(),
      };
      setUser(newUser);
      await saveUser(newUser);
      return true;
    },
    []
  );

  const register = useCallback(
    async (
      username: string,
      _email: string,
      _password: string
    ): Promise<boolean> => {
      const newUser: User = {
        id: generateId(),
        username,
        email: _email,
        avatar: "🎮",
        balance: 5000,
        totalWins: 0,
        totalLosses: 0,
        totalWagered: 0,
        rank: 999,
        level: 1,
        xp: 0,
        joinedAt: new Date().toISOString(),
      };
      setUser(newUser);
      await saveUser(newUser);
      return true;
    },
    []
  );

  const logout = useCallback(async () => {
    setUser(null);
    setGameHistory([]);
    await AsyncStorage.removeItem("user");
    await AsyncStorage.removeItem("gameHistory");
  }, []);

  const addGameResult = useCallback(
    (entry: Omit<GameHistoryEntry, "id" | "timestamp">) => {
      const newEntry: GameHistoryEntry = {
        ...entry,
        id: generateId(),
        timestamp: new Date().toISOString(),
      };
      setGameHistory((prev) => {
        const updated = [newEntry, ...prev].slice(0, 100);
        saveHistory(updated);
        return updated;
      });
      setUser((prev) => {
        if (!prev) return prev;
        const updated: User = {
          ...prev,
          balance: entry.payout - entry.wager + prev.balance,
          totalWins: prev.totalWins + (entry.won ? 1 : 0),
          totalLosses: prev.totalLosses + (entry.won ? 0 : 1),
          totalWagered: prev.totalWagered + entry.wager,
          xp: prev.xp + Math.floor(entry.wager / 10),
          level: Math.floor((prev.xp + Math.floor(entry.wager / 10)) / 1000) + 1,
        };
        saveUser(updated);
        return updated;
      });
    },
    []
  );

  const updateBalance = useCallback((newBalance: number) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, balance: newBalance };
      saveUser(updated);
      return updated;
    });
  }, []);

  return (
    <GameContext.Provider
      value={{
        user,
        isLoggedIn,
        gameHistory,
        leaderboard,
        login,
        register,
        logout,
        addGameResult,
        updateBalance,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
