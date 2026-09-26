import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: any = null;
let db: any = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
  } catch (e) {
    console.warn("Failed to initialize PostgreSQL pool, falling back to mock:", e);
  }
}

if (!db) {
  console.warn("[AI Studio] DATABASE_URL not set — using robust in-memory mock database");
  
  const inMemoryUsers = new Map<number, any>();
  let nextUserId = 1;
  const inMemoryBets = new Map<number, any>();
  let nextBetId = 1;
  const inMemoryRounds = new Map<number, any>();
  let nextRoundId = 1;

  db = {
    select: () => ({
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: async (n: number) => {
            if (table === schema.usersTable) {
              const users = Array.from(inMemoryUsers.values());
              return users.slice(0, n);
            }
            return [];
          },
          orderBy: () => ({
            limit: async () => []
          })
        }),
        leftJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => []
            })
          })
        }),
        orderBy: () => ({
          limit: async () => []
        }),
        limit: async () => []
      })
    }),
    insert: (table: any) => ({
      values: (data: any) => ({
        returning: async () => {
          if (table === schema.usersTable) {
            const user = {
              id: nextUserId++,
              username: data.username,
              email: data.email,
              passwordHash: data.passwordHash,
              balance: data.balance ?? 10000,
              totalWins: 0,
              totalLosses: 0,
              totalWagered: 0,
              wagerRequirement: 0,
              vipLevel: "Bronze",
              createdAt: new Date(),
              ...data,
            };
            inMemoryUsers.set(user.id, user);
            return [user];
          }
          if (table === schema.betsTable) {
            const bet = { id: nextBetId++, ...data, placedAt: new Date() };
            inMemoryBets.set(bet.id, bet);
            return [{ id: bet.id }];
          }
          if (table === schema.gameRoundsTable) {
            const round = { id: nextRoundId++, ...data, startedAt: new Date() };
            inMemoryRounds.set(round.id, round);
            return [{ id: round.id }];
          }
          return [{ id: 1 }];
        }
      })
    }),
    update: (table: any) => ({
      set: (setData: any) => ({
        where: (condition: any) => ({
          returning: async () => {
            if (table === schema.usersTable) {
              const users = Array.from(inMemoryUsers.values());
              if (users.length > 0) {
                const u = users[0];
                Object.assign(u, setData);
                return [{ balance: u.balance, wagerRequirement: u.wagerRequirement }];
              }
              return [{ balance: 10000, wagerRequirement: 0 }];
            }
            return [];
          }
        })
      })
    })
  };
}

export { pool, db };
export * from "./schema";
