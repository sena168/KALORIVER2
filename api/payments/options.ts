import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PaymentProvider } from "@prisma/client";
import { requireUser } from "../_lib/auth.js";
import { prisma } from "../_lib/prisma.js";
import { ensureUserProfile } from "../_lib/profile.js";
import { getPremiumAmount, getPremiumProductName } from "../_lib/payments.js";

const has = (value?: string) => Boolean(value && value.trim().length > 0);

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
    const email = auth.decoded.email ?? null;
    await ensureUserProfile(uid, email);

    const profile = await prisma.userProfile.findUnique({
      where: { uid },
      select: {
        isPremium: true,
        premiumProvider: true,
        premiumSince: true,
        premiumUntil: true,
      },
    });

    const providers = [
      {
        code: PaymentProvider.MIDTRANS,
        enabled: has(process.env.MIDTRANS_SERVER_KEY),
      },
      {
        code: PaymentProvider.DUITKU,
        enabled: has(process.env.DUITKU_MERCHANT_CODE) && has(process.env.DUITKU_API_KEY),
      },
      {
        code: PaymentProvider.PAKKASIR,
        enabled: has(process.env.PAKKASIR_CHECKOUT_URL),
      },
    ];

    res.status(200).json({
      amount: getPremiumAmount(),
      productName: getPremiumProductName(),
      profile,
      providers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load payment options" });
  }
}

