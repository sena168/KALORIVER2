import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMenuResponse } from "./_lib/menu.js";
import { verifyIdToken } from "./_lib/auth.js";
import { prisma } from "./_lib/prisma.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const data = await getMenuResponse({ includeHidden: false });
    const authHeader = req.headers.authorization;
    let uid: string | null = null;

    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      try {
        const decoded = await verifyIdToken(authHeader);
        uid = decoded?.uid ?? null;
      } catch {
        uid = null;
      }
    }

    if (uid) {
      const profile = await prisma.userProfile.findUnique({
        where: { uid },
        select: { isPremium: true },
      });
      if (profile?.isPremium) {
        const customItems = await prisma.customMenuItem.findMany({
          where: { uid },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        });

        data.push({
          id: "custom",
          label: "Custom",
          items: customItems.map((item) => ({
            id: item.id,
            name: item.name,
            calories: item.calories,
            imagePath: item.imagePath || "/defaultico.png",
            category: "custom",
            hidden: false,
          })),
        });
      }
    }

    res.status(200).json({ categories: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load menu" });
  }
}
