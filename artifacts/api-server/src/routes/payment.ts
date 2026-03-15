import { Router } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, transactionsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "neonbet-secret-2024";

const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

let razorpay: Razorpay | null = null;
if (RZP_KEY_ID && RZP_KEY_SECRET) {
  razorpay = new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET });
}

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
  res.json({ keyId: RZP_KEY_ID || null, enabled: !!razorpay });
});

router.post("/payment/create-order", async (req, res) => {
  const userId = getUser(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { amount } = req.body as { amount?: number };
  if (!amount || amount < 100 || !Number.isFinite(amount)) {
    return res.status(400).json({ error: "Minimum deposit is ₹100" });
  }

  if (!razorpay) {
    return res.status(503).json({ error: "Payment gateway not configured" });
  }

  try {
    const order = await razorpay.orders.create({
      amount: Math.floor(amount) * 100,
      currency: "INR",
      receipt: `user_${userId}_${Date.now()}`,
      notes: { userId: String(userId) },
    });

    res.json({
      orderId: order.id,
      amount: Math.floor(amount) * 100,
      currency: "INR",
      keyId: RZP_KEY_ID,
    });
  } catch (e) {
    console.error("Razorpay create order error:", e);
    res.status(500).json({ error: "Failed to create payment order" });
  }
});

router.post("/payment/verify", async (req, res) => {
  const userId = getUser(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { orderId, paymentId, signature, amount } = req.body as {
    orderId?: string;
    paymentId?: string;
    signature?: string;
    amount?: number;
  };

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: "Missing payment details" });
  }

  if (!RZP_KEY_SECRET) {
    return res.status(503).json({ error: "Payment gateway not configured" });
  }

  const expectedSig = crypto
    .createHmac("sha256", RZP_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (expectedSig !== signature) {
    return res.status(400).json({ error: "Invalid payment signature" });
  }

  const depositAmount = Math.floor((amount ?? 0) / 100);
  if (depositAmount < 100) {
    return res.status(400).json({ error: "Invalid payment amount" });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId));
      if (!user) throw new Error("User not found");

      const newBalance = user.balance + depositAmount;
      await tx.update(usersTable).set({ balance: newBalance }).where(eq(usersTable.id, userId));
      await tx.insert(transactionsTable).values({
        userId,
        type: "deposit",
        amount: depositAmount,
        note: `UPI deposit via Razorpay`,
        txRef: paymentId,
        status: "completed",
      });
      return { balance: newBalance };
    });

    res.json({ success: true, balance: result.balance, amount: depositAmount });
  } catch (e) {
    console.error("Payment verify error:", e);
    res.status(500).json({ error: "Failed to credit balance" });
  }
});

export default router;
