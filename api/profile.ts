import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/prisma.js";
import { Prisma } from "@prisma/client";
import { isAdminUser, requireUser } from "./_lib/auth.js";
import { deleteCloudinaryByPublicId, uploadImageIfNeeded } from "./_lib/cloudinary.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const auth = await requireUser(req.headers.authorization);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }

  const { decoded } = auth;
  const uid = decoded.uid;
  const email = decoded.email ?? null;

  if (req.method === "GET") {
    const profile = await prisma.userProfile.findUnique({ where: { uid } });
    const admin = await isAdminUser(uid, email);
    res.status(200).json({
      profile,
      isAdmin: admin,
    });
    return;
  }

  let uploadedPublicId: string | null = null;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    const age = Number.isFinite(Number(body.age)) ? Number(body.age) : undefined;
    const weight = Number.isFinite(Number(body.weight)) ? Number(body.weight) : undefined;
    const height = Number.isFinite(Number(body.height)) ? Number(body.height) : undefined;
    const gender = typeof body.gender === "string" ? body.gender : undefined;
    const username = typeof body.username === "string" ? body.username.trim() : undefined;
    const calorieQuantities =
      body.calorieQuantities &&
      typeof body.calorieQuantities === "object" &&
      !Array.isArray(body.calorieQuantities)
        ? body.calorieQuantities
        : undefined;
    const burnList = Array.isArray(body.burnList) ? body.burnList : undefined;

    let photoUrl: string | undefined;
    if (typeof body.photoUrl === "string" && body.photoUrl.trim()) {
      const publicId = `users/${uid}`;
      uploadedPublicId = publicId;
      photoUrl = await uploadImageIfNeeded(body.photoUrl.trim(), "users", {
        publicId,
        overwrite: true,
      });
    }

    const profile = await prisma.userProfile.upsert({
      where: { uid },
      update: {
        age,
        weight,
        height,
        gender,
        username,
        photoUrl,
        email: email ?? undefined,
        calorieQuantities,
        burnList,
      },
      create: {
        uid,
        email: email ?? undefined,
        age,
        weight,
        height,
        gender,
        username,
        photoUrl,
        calorieQuantities,
        burnList,
      },
    });

    const admin = await isAdminUser(uid, email);
    res.status(200).json({
      profile,
      isAdmin: admin,
    });
  } catch (error) {
    console.error(error);
    if (uploadedPublicId) {
      await deleteCloudinaryByPublicId(uploadedPublicId);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      res.status(500).json({ error: "UserProfile table missing. Run migrations." });
      return;
    }
    res.status(500).json({ error: "Failed to save profile" });
  }
}
