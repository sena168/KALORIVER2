import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { prisma } from "../../_lib/prisma.js";
import { applyPremiumIfPaid } from "../../_lib/profile.js";
import { duitkuStatusToPaymentStatus, verifyDuitkuSignature } from "../../_lib/payments.js";

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    if (!verifyDuitkuSignature(payload)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    const orderId = asString(payload.merchantOrderId);
    if (!orderId) {
      res.status(400).json({ error: "Missing merchantOrderId" });
      return;
    }

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { orderId },
    });

    if (!transaction || transaction.provider !== PaymentProvider.DUITKU) {
      res.status(200).json({ ok: true });
      return;
    }

    const resultCode = asString(payload.resultCode || payload.statusCode || "01");
    const status = duitkuStatusToPaymentStatus(resultCode);

    const updated = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status,
        paidAt: status === PaymentStatus.PAID ? new Date() : null,
        rawResponse: payload,
        externalReference: asString(payload.reference) || transaction.externalReference,
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
    res.status(500).json({ error: "Failed to process duitku webhook" });
  }
}

