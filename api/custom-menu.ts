import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/prisma.js";
import { requireUser } from "./_lib/auth.js";
import { ensureUserProfile } from "./_lib/profile.js";
import { uploadImageIfNeeded, deleteCloudinaryAssetIfNeeded } from "./_lib/cloudinary.js";

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const getCustomLimit = () => {
  const parsed = Number(process.env.PREMIUM_CUSTOM_MENU_LIMIT ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.floor(parsed);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireUser(req.headers.authorization);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }

  const uid = auth.decoded.uid;
  const email = auth.decoded.email ?? null;
  await ensureUserProfile(uid, email);

  if (req.method === "GET") {
    const items = await prisma.customMenuItem.findMany({
      where: { uid },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    res.status(200).json({ items });
    return;
  }

  const profile = await prisma.userProfile.findUnique({
    where: { uid },
    select: { isPremium: true },
  });
  if (!profile?.isPremium) {
    res.status(403).json({ error: "Premium access required" });
    return;
  }

  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
      const name = asString(body.name);
      const calories = Number(body.calories);
      if (!name) {
        res.status(400).json({ error: "Invalid name" });
        return;
      }
      if (!Number.isFinite(calories) || calories < 0) {
        res.status(400).json({ error: "Invalid calories" });
        return;
      }

      const currentCount = await prisma.customMenuItem.count({ where: { uid } });
      if (currentCount >= getCustomLimit()) {
        res.status(409).json({ error: "Custom menu limit reached" });
        return;
      }

      const maxPosition = await prisma.customMenuItem.aggregate({
        where: { uid },
        _max: { position: true },
      });
      const position = (maxPosition._max.position ?? -1) + 1;

      const rawImage = asString(body.imagePath);
      const imagePath = rawImage
        ? await uploadImageIfNeeded(rawImage, `custom-menu/${uid}`)
        : "/defaultico.png";

      const created = await prisma.customMenuItem.create({
        data: {
          uid,
          name,
          calories: Math.round(calories),
          imagePath,
          position,
        },
      });

      res.status(201).json({ item: created });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create custom menu item" });
    }
    return;
  }

  if (req.method === "DELETE") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
      const id = asString(body.id);
      if (!id) {
        res.status(400).json({ error: "Missing item id" });
        return;
      }

      const existing = await prisma.customMenuItem.findFirst({
        where: { id, uid },
      });
      if (!existing) {
        res.status(404).json({ error: "Custom item not found" });
        return;
      }

      if (existing.imagePath) {
        await deleteCloudinaryAssetIfNeeded(existing.imagePath);
      }

      await prisma.customMenuItem.delete({ where: { id: existing.id } });
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete custom menu item" });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

