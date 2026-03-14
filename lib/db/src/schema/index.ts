import { pgTable, serial, varchar, bigint, integer, numeric, timestamp, text } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  email: varchar("email", { length: 128 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  balance: bigint("balance", { mode: "number" }).notNull().default(10000),
  totalWins: integer("total_wins").notNull().default(0),
  totalLosses: integer("total_losses").notNull().default(0),
  totalWagered: bigint("total_wagered", { mode: "number" }).notNull().default(0),
  vipLevel: varchar("vip_level", { length: 16 }).notNull().default("Bronze"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameRoundsTable = pgTable("game_rounds", {
  id: serial("id").primaryKey(),
  crashPoint: numeric("crash_point", { precision: 10, scale: 2 }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  crashedAt: timestamp("crashed_at", { withTimezone: true }),
  status: varchar("status", { length: 16 }).notNull().default("waiting"),
});

export const betsTable = pgTable("bets", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id").references(() => gameRoundsTable.id),
  userId: integer("user_id").references(() => usersTable.id),
  amount: bigint("amount", { mode: "number" }).notNull(),
  autoCashout: numeric("auto_cashout", { precision: 6, scale: 2 }),
  cashedOutAt: numeric("cashed_out_at", { precision: 10, scale: 2 }),
  payout: bigint("payout", { mode: "number" }),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type Bet = typeof betsTable.$inferSelect;
export type GameRound = typeof gameRoundsTable.$inferSelect;
