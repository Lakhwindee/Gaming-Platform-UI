import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, transactionsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "neonbet-secret-2024";
const MERCHANT_UPI_ID = process.env.MERCHANT_UPI_ID || "7973248683@pthdfc";

function getUser(authHeader: string | undefined): number | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number };
    return payload.userId;
  } catch {
    return null;
  }
}

router.get("/payment/config", (_req, res) => {
  res.json({ merchantUpi: MERCHANT_UPI_ID, enabled: true });
});

router.post("/payment/upi-initiate", async (req, res) => {
  const userId = getUser(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { amount, method } = req.body as { amount?: number; method?: string };

  if (!amount || !Number.isFinite(amount) || amount < 100 || amount > 100000) {
    return res.status(400).json({ error: "Amount must be between ₹100 and ₹1,00,000" });
  }

  const txnRef = `U${Date.now()}${userId}`;
  const bonus = amount >= 1000 ? Math.floor(amount * 0.1) : 0;

  try {
    await db.insert(transactionsTable).values({
      userId,
      type: "deposit",
      amount,
      note: `UPI deposit via ${method ?? "upi"} — pending`,
      txRef: txnRef,
      status: "pending",
    });

    res.json({
      txnRef,
      merchantUpi: MERCHANT_UPI_ID,
      amount,
      bonus,
      total: amount + bonus,
    });
  } catch (e) {
    console.error("upi-initiate error:", e);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
});

// User submits UTR — does NOT credit balance, sets admin_pending for manual review
router.post("/payment/upi-confirm", async (req, res) => {
  const userId = getUser(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { txnRef, utr } = req.body as { txnRef?: string; utr?: string };
  if (!txnRef) return res.status(400).json({ error: "Missing transaction reference" });
  if (!utr?.trim()) return res.status(400).json({ error: "UTR/Transaction ID required" });

  try {
    const [txn] = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.txRef, txnRef),
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.status, "pending"),
        )
      );

    if (!txn) throw new Error("Transaction not found or already processed");

    const bonus = txn.amount >= 1000 ? Math.floor(txn.amount * 0.1) : 0;
    const noteStr = bonus > 0
      ? `UPI deposit ₹${txn.amount} + ₹${bonus} bonus | UTR: ${utr.trim()}`
      : `UPI deposit ₹${txn.amount} | UTR: ${utr.trim()}`;

    await db
      .update(transactionsTable)
      .set({ status: "admin_pending", note: noteStr })
      .where(eq(transactionsTable.txRef, txnRef));

    // Balance NOT credited yet — admin must approve first
    res.json({ success: true, status: "admin_pending", message: "Payment submitted for admin verification. Balance will be credited after approval." });
  } catch (e) {
    console.error("upi-confirm error:", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to confirm payment" });
  }
});

export default router;
