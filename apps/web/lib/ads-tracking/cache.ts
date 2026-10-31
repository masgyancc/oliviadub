import { prismaEdge } from "@/lib/prisma/edge";
import { redis } from "@/lib/upstash/redis";
import { TrackingPlatform, TrackingTag } from "./types";

// Enabled tracking tags per link, read on every click by the link middleware.
// Links without tags are cached as [] so they cost one Redis read and no DB query.

export type ActiveTag = TrackingTag & { platform: TrackingPlatform };

const key = (linkId: string) => `ads-tracking:${linkId}`;
const TTL_SECONDS = 60 * 60 * 24;

export async function getActiveTrackingTags({
  linkId,
  workspaceId,
}: {
  linkId: string;
  workspaceId?: string | null;
}): Promise<ActiveTag[]> {
  try {
    const cached = await redis.get<ActiveTag[]>(key(linkId));
    if (cached) return cached;

    const rows = await prismaEdge.linkTrackingPixel.findMany({
      where: {
        linkId,
        enabled: true,
        // tags only apply while the link stays in the workspace that configured them
        projectId: workspaceId ?? "__none__",
      },
      select: { platform: true, pixelId: true, conversionLabel: true },
    });

    await redis.set(key(linkId), rows, { ex: TTL_SECONDS });
    return rows;
  } catch (error) {
    // tracking must never break a redirect
    console.error("[ads-tracking] failed to load tags", error);
    return [];
  }
}

export async function invalidateTrackingTags(linkId: string) {
  try {
    await redis.del(key(linkId));
  } catch (error) {
    console.error("[ads-tracking] failed to invalidate", error);
  }
}
