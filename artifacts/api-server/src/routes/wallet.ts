import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, transactionsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "neonbet-secret-2024";

function getUser(authHeader: string | undefined): number | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number };
    return payload.userId;
  } catch {
    return null;
  }
}

router.get("/wallet/balance", async (req, res) => {
  const userId = getUser(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [user] = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ balance: user.balance });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/wallet/transactions", async (req, res) => {
  const userId = getUser(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const txs = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(50);
    res.json(txs);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/wallet/deposit", async (req, res) => {
  const userId = getUser(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const { amount, txRef } = req.body as { amount?: number; txRef?: string };
  if (!amount || amount < 1 || !Number.isFinite(amount)) {
    return res.status(400).json({ error: "Invalid amount" });
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId));
      if (!user) throw new Error("User not found");
      const newBalance = user.balance + Math.floor(amount);
      await tx.update(usersTable).set({ balance: newBalance }).where(eq(usersTable.id, userId));
      await tx.insert(transactionsTable).values({
        userId,
        type: "deposit",
        amount: Math.floor(amount),
        note: txRef ? `Deposit via ${txRef}` : "Manual deposit",
        txRef: txRef ?? null,
        status: "completed",
      });
      return { balance: newBalance };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Server error" });
  }
});

router.post("/wallet/withdraw", async (req, res) => {
  const userId = getUser(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const { amount, upiId } = req.body as { amount?: number; upiId?: string };
  if (!amount || amount < 200 || !Number.isFinite(amount)) {
    return res.status(400).json({ error: "Minimum withdrawal is ₹200" });
  }
  if (!upiId?.trim()) {
    return res.status(400).json({ error: "UPI ID is required" });
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId));
      if (!user) throw new Error("User not found");
      if (user.balance < amount) throw new Error("Insufficient balance");
      const newBalance = user.balance - Math.floor(amount);
      await tx.update(usersTable).set({ balance: newBalance }).where(eq(usersTable.id, userId));
      await tx.insert(transactionsTable).values({
        userId,
        type: "withdraw",
        amount: Math.floor(amount),
        note: `Withdrawal to ${upiId}`,
        txRef: null,
        status: "pending",
      });
      return { balance: newBalance };
    });
    res.json({ message: "Withdrawal requested. Processing within 24 hours.", balance: result.balance });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Server error" });
  }
});

export default router;
