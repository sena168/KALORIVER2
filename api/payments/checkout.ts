import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../_lib/prisma.js";
import { requireUser } from "../_lib/auth.js";
import { createCheckout, createOrderId, getPremiumAmount } from "../_lib/payments.js";
import { ensureUserProfile } from "../_lib/profile.js";

const parseProvider = (value: unknown): PaymentProvider | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === PaymentProvider.MIDTRANS) return PaymentProvider.MIDTRANS;
  if (normalized === PaymentProvider.DUITKU) return PaymentProvider.DUITKU;
  if (normalized === PaymentProvider.PAKKASIR) return PaymentProvider.PAKKASIR;
  return null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const auth = await requireUser(req.headers.authorization);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    const provider = parseProvider(body.provider);
    if (!provider) {
      res.status(400).json({ error: "Invalid payment provider" });
      return;
    }

    const { decoded } = auth;
    const uid = decoded.uid;
    const email = decoded.email ?? null;
    await ensureUserProfile(uid, email);

    const existingPremium = await prisma.userProfile.findUnique({
      where: { uid },
      select: { isPremium: true },
    });
    if (existingPremium?.isPremium) {
      res.status(200).json({
        alreadyPremium: true,
        message: "Account already has premium access",
      });
      return;
    }

    const amount = getPremiumAmount();
    const orderId = createOrderId(provider);
    const checkout = await createCheckout(provider, {
      orderId,
      amount,
      uid,
      email,
      displayName: decoded.name ?? decoded.email ?? uid,
    });

    await prisma.paymentTransaction.create({
      data: {
        uid,
        provider,
        status: PaymentStatus.PENDING,
        orderId,
        amount,
        currency: "IDR",
        checkoutUrl: checkout.checkoutUrl,
        externalReference: checkout.externalReference ?? undefined,
        rawResponse: (checkout.rawResponse as Prisma.InputJsonValue | undefined) ?? undefined,
        expiresAt: checkout.expiresAt ?? undefined,
      },
    });

    res.status(200).json({
      orderId,
      provider,
      amount,
      checkoutUrl: checkout.checkoutUrl,
      expiresAt: checkout.expiresAt ?? null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create payment checkout" });
  }
}
