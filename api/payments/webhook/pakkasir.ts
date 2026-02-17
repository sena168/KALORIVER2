import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { prisma } from "../../_lib/prisma.js";
import { applyPremiumIfPaid } from "../../_lib/profile.js";
import { verifyPakkasirSignature } from "../../_lib/payments.js";

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const mapStatus = (raw: string) => {
  const normalized = raw.toLowerCase();
  if (normalized === "paid" || normalized === "success" || normalized === "settlement") {
    return PaymentStatus.PAID;
  }
  if (normalized === "expired") return PaymentStatus.EXPIRED;
  if (normalized === "canceled" || normalized === "cancelled") return PaymentStatus.CANCELED;
  if (normalized === "failed" || normalized === "deny") return PaymentStatus.FAILED;
  return PaymentStatus.PENDING;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    if (!verifyPakkasirSignature(payload)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    const orderId = asString(payload.orderId || payload.order_id);
    if (!orderId) {
      res.status(400).json({ error: "Missing orderId" });
      return;
    }

    const transaction = await prisma.paymentTransaction.findUnique({ where: { orderId } });
    if (!transaction || transaction.provider !== PaymentProvider.PAKKASIR) {
      res.status(200).json({ ok: true });
      return;
    }

    const status = mapStatus(asString(payload.status));
    const updated = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status,
        paidAt: status === PaymentStatus.PAID ? new Date() : null,
        rawResponse: payload,
      },
    });

    await applyPremiumIfPaid({
      uid: transaction.uid,
      provider: transaction.provider,
      transactionId: updated.id,
      status: updated.status,
      paidAt: updated.paidAt,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process pakkasir webhook" });
  }
}

