import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../_lib/prisma.js";
import { applyPremiumIfPaid } from "../_lib/profile.js";
import {
  duitkuStatusToPaymentStatus,
  midtransStatusToPaymentStatus,
  verifyDuitkuSignature,
  verifyMidtransSignature,
  verifyPakkasirSignature,
} from "../_lib/payments.js";

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeProvider = (value?: string) => {
  const v = asString(value).toLowerCase();
  if (v === "midtrans") return PaymentProvider.MIDTRANS;
  if (v === "duitku") return PaymentProvider.DUITKU;
  if (v === "pakkasir") return PaymentProvider.PAKKASIR;
  return null;
};

const mapPakkasirStatus = (raw: string) => {
  const normalized = raw.toLowerCase();
  if (normalized === "paid" || normalized === "success" || normalized === "settlement") {
    return PaymentStatus.PAID;
  }
  if (normalized === "expired") return PaymentStatus.EXPIRED;
  if (normalized === "canceled" || normalized === "cancelled") return PaymentStatus.CANCELED;
  if (normalized === "failed" || normalized === "deny") return PaymentStatus.FAILED;
  return PaymentStatus.PENDING;
};

const resolveProviderFromPayload = (payload: Record<string, unknown>) => {
  if (payload.order_id) return PaymentProvider.MIDTRANS;
  if (payload.merchantOrderId) return PaymentProvider.DUITKU;
  if (payload.orderId || payload.order_id) return PaymentProvider.PAKKASIR;
  return null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    const queryProvider =
      typeof req.query.provider === "string" ? normalizeProvider(req.query.provider) : null;
    const provider = queryProvider ?? resolveProviderFromPayload(payload);
    if (!provider) {
      res.status(400).json({ error: "Unknown provider" });
      return;
    }

    let orderId = "";
    let status: PaymentStatus = PaymentStatus.PENDING;

    if (provider === PaymentProvider.MIDTRANS) {
      if (!verifyMidtransSignature(payload)) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      orderId = asString(payload.order_id);
      status = midtransStatusToPaymentStatus(
        asString(payload.transaction_status),
        asString(payload.fraud_status),
      );
    } else if (provider === PaymentProvider.DUITKU) {
      if (!verifyDuitkuSignature(payload)) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      orderId = asString(payload.merchantOrderId);
      status = duitkuStatusToPaymentStatus(asString(payload.resultCode || payload.statusCode || "01"));
    } else {
      if (!verifyPakkasirSignature(payload)) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      orderId = asString(payload.orderId || payload.order_id);
      status = mapPakkasirStatus(asString(payload.status));
    }

    if (!orderId) {
      res.status(400).json({ error: "Missing order id" });
      return;
    }

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { orderId },
    });

    if (!transaction || transaction.provider !== provider) {
      res.status(200).json({ ok: true });
      return;
    }

    const updated = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status,
        paidAt: status === PaymentStatus.PAID ? new Date() : null,
        rawResponse: payload as Prisma.InputJsonValue,
        externalReference:
          provider === PaymentProvider.DUITKU
            ? asString(payload.reference) || transaction.externalReference
            : transaction.externalReference,
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
    res.status(500).json({ error: "Failed to process payment webhook" });
  }
}
