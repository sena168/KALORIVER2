import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { prisma } from "./prisma.js";

export const ensureUserProfile = async (uid: string, email?: string | null) => {
  return prisma.userProfile.upsert({
    where: { uid },
    update: { email: email ?? undefined },
    create: { uid, email: email ?? undefined },
  });
};

export const applyPremiumIfPaid = async (params: {
  uid: string;
  provider: PaymentProvider;
  transactionId: string;
  status: PaymentStatus;
  paidAt?: Date | null;
}) => {
  if (params.status !== PaymentStatus.PAID) return;

  await prisma.userProfile.update({
    where: { uid: params.uid },
    data: {
      isPremium: true,
      premiumProvider: params.provider,
      premiumSince: params.paidAt ?? new Date(),
      premiumUntil: null,
    },
  });
};

