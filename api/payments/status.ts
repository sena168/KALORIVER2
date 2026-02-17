import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../_lib/prisma.js";
import { requireUser } from "../_lib/auth.js";
import { fetchProviderStatus } from "../_lib/payments.js";
import { applyPremiumIfPaid } from "../_lib/profile.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const auth = await requireUser(req.headers.authorization);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }

  try {
    const uid = auth.decoded.uid;
    const orderId = typeof req.query.orderId === "string" ? req.query.orderId : undefined;
    const where = orderId ? { uid, orderId } : { uid };

    let transaction = await prisma.paymentTransaction.findFirst({
      where,
      orderBy: { createdAt: "desc" },
    });

    if (!transaction) {
      const profile = await prisma.userProfile.findUnique({
        where: { uid },
        select: { isPremium: true, premiumProvider: true, premiumSince: true, premiumUntil: true },
      });
      res.status(200).json({ transaction: null, profile });
      return;
    }

    if (transaction.status === PaymentStatus.PENDING) {
      const latest = await fetchProviderStatus(transaction.provider, transaction.orderId);
      if (latest.status !== PaymentStatus.PENDING) {
        transaction = await prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            status: latest.status,
            paidAt: latest.paidAt ?? undefined,
            rawResponse: (latest.rawResponse as Prisma.InputJsonValue | undefined) ?? undefined,
          },
        });
      }
      await applyPremiumIfPaid({
        uid,
        provider: transaction.provider,
        transactionId: transaction.id,
        status: transaction.status,
        paidAt: transaction.paidAt,
      });
    }

    const profile = await prisma.userProfile.findUnique({
      where: { uid },
      select: { isPremium: true, premiumProvider: true, premiumSince: true, premiumUntil: true },
    });

    res.status(200).json({ transaction, profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to check payment status" });
  }
}
