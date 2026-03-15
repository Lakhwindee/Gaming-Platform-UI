import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable, betsTable, gameRoundsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "neonbet-secret-2024";

function makeToken(userId: number, username: string) {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: "30d" });
}

function sanitizeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    balance: u.balance,
    totalWins: u.totalWins,
    totalLosses: u.totalLosses,
    totalWagered: u.totalWagered,
    vipLevel: u.vipLevel,
    createdAt: u.createdAt,
  };
}

function getUserId(authHeader: string | undefined): number | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number };
    return payload.userId;
  } catch {
    return null;
  }
}

router.post("/auth/register", async (req, res) => {
  const { username, email, password } = req.body ?? {};
  if (!username || !email || !password)
    return res.status(400).json({ error: "All fields required" });
  if (username.length < 3 || username.length > 32)
    return res.status(400).json({ error: "Username must be 3-32 characters" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const rows = await db.insert(usersTable)
      .values({ username, email, passwordHash, balance: 10000 })
      .returning();
    const user = rows[0];
    const token = makeToken(user.id, user.username);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (e: unknown) {
    const msg = String((e as { message?: string }).message ?? "");
    if (msg.includes("unique")) return res.status(400).json({ error: "Username or email already taken" });
    console.error("Register error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid username or password" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid username or password" });

    const token = makeToken(user.id, user.username);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (e) {
    console.error("Login error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/auth/me", async (req, res) => {
  const userId = getUserId(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(sanitizeUser(user));
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

router.get("/auth/game-history", async (req, res) => {
  const userId = getUserId(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const rows = await db
      .select({
        betId: betsTable.id,
        roundId: betsTable.roundId,
        amount: betsTable.amount,
        payout: betsTable.payout,
        cashedOutAt: betsTable.cashedOutAt,
        status: betsTable.status,
        placedAt: betsTable.placedAt,
        crashPoint: gameRoundsTable.crashPoint,
      })
      .from(betsTable)
      .leftJoin(gameRoundsTable, eq(betsTable.roundId, gameRoundsTable.id))
      .where(and(eq(betsTable.userId, userId)))
      .orderBy(desc(betsTable.placedAt))
      .limit(30);

    return res.json(rows);
  } catch (e) {
    console.error("Game history error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/auth/change-password", async (req, res) => {
  const userId = getUserId(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: "Both fields required" });
  if (newPassword.length < 6)
    return res.status(400).json({ error: "New password must be at least 6 characters" });

  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, userId));
    return res.json({ success: true });
  } catch (e) {
    console.error("Change password error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
