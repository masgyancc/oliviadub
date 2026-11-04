import { DubApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import * as z from "zod/v4";
import { TRACKING_ADAPTERS, TRACKING_PLATFORMS } from "./adapters";
import { invalidateTrackingTags } from "./cache";
import { MAX_TAGS_PER_LINK } from "./service";
import { TrackingPlatform } from "./types";

// A user's saved pixels ("my pixels"), picked by checkbox in the link builder.
// Every query is scoped by userId AND projectId: a saved pixel is never listed for,
// or attachable by, any other user, even a member of the same workspace.

export const MAX_SAVED_PIXELS = 100;

const platformSchema = z.enum(
  TRACKING_PLATFORMS as [TrackingPlatform, ...TrackingPlatform[]],
);

export const createSavedPixelSchema = z.object({
  platform: platformSchema,
  pixelId: z.string().trim().min(1).max(64),
  conversionLabel: z.string().trim().max(64).optional(),
  name: z.string().trim().min(1).max(60),
});

export const setLinkSavedPixelsSchema = z.object({
  savedPixelIds: z.array(z.string().min(1)).max(MAX_TAGS_PER_LINK),
});

const savedSelect = {
  id: true,
  platform: true,
  pixelId: true,
  conversionLabel: true,
  name: true,
  createdAt: true,
} as const;

const owner = (userId: string, workspaceId: string) => ({
  userId,
  projectId: workspaceId,
});

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export function listSavedPixels(userId: string, workspaceId: string) {
  return prisma.savedTrackingPixel.findMany({
    where: owner(userId, workspaceId),
    select: savedSelect,
    orderBy: { name: "asc" },
  });
}

export async function createSavedPixel({
  userId,
  workspaceId,
  input,
}: {
  userId: string;
  workspaceId: string;
  input: z.infer<typeof createSavedPixelSchema>;
}) {
  const result = TRACKING_ADAPTERS[input.platform].validate(input);
  if (!result.ok) {
    throw new DubApiError({
      code: "unprocessable_entity",
      message: result.error,
    });
  }

  const count = await prisma.savedTrackingPixel.count({
    where: owner(userId, workspaceId),
  });
  if (count >= MAX_SAVED_PIXELS) {
    throw new DubApiError({
      code: "exceeded_limit",
      message: `You can save at most ${MAX_SAVED_PIXELS} pixels.`,
    });
  }

  try {
    return await prisma.savedTrackingPixel.create({
      data: {
        ...owner(userId, workspaceId),
        platform: input.platform,
        pixelId: result.value.pixelId,
        conversionLabel: result.value.conversionLabel,
        name: input.name,
      },
      select: savedSelect,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DubApiError({
        code: "conflict",
        message: "You already saved this pixel.",
      });
    }
    throw error;
  }
}

// Removes the pixel from the user's list. Links that already use it keep the tag (now
// shown as a regular tag in Ads Tracking), so running campaigns don't lose tracking.
export async function deleteSavedPixel({
  id,
  userId,
  workspaceId,
}: {
  id: string;
  userId: string;
  workspaceId: string;
}) {
  const saved = await prisma.savedTrackingPixel.findFirst({
    where: { id, ...owner(userId, workspaceId) },
    select: { id: true },
  });
  if (!saved) {
    throw new DubApiError({ code: "not_found", message: "Pixel not found." });
  }

  await prisma.$transaction([
    prisma.linkTrackingPixel.updateMany({
      where: { savedPixelId: saved.id, projectId: workspaceId },
      data: { savedPixelId: null },
    }),
    prisma.savedTrackingPixel.delete({ where: { id: saved.id } }),
  ]);
}

// Saved pixels currently attached to a link, restricted to this user's own pixels.
export async function getLinkSavedPixelIds({
  linkId,
  userId,
  workspaceId,
}: {
  linkId: string;
  userId: string;
  workspaceId: string;
}) {
  const rows = await prisma.linkTrackingPixel.findMany({
    where: { linkId, projectId: workspaceId, savedPixelId: { not: null } },
    select: { savedPixelId: true },
  });
  const ids = rows.map((r) => r.savedPixelId!);
  if (ids.length === 0) return [];

  const own = await prisma.savedTrackingPixel.findMany({
    where: { id: { in: ids }, ...owner(userId, workspaceId) },
    select: { id: true },
  });
  return own.map((s) => s.id);
}

// Makes the link's picked pixels match `savedPixelIds` (the user's own pixels only).
// Tags entered by hand, and pixels another user picked, are left untouched.
export async function setLinkSavedPixels({
  linkId,
  userId,
  workspaceId,
  savedPixelIds,
}: {
  linkId: string;
  userId: string;
  workspaceId: string;
  savedPixelIds: string[];
}) {
  const wanted = await prisma.savedTrackingPixel.findMany({
    where: { id: { in: [...new Set(savedPixelIds)] }, ...owner(userId, workspaceId) },
  });
  if (wanted.length !== new Set(savedPixelIds).size) {
    throw new DubApiError({
      code: "not_found",
      message: "One or more pixels were not found.",
    });
  }

  const ownIds = (
    await prisma.savedTrackingPixel.findMany({
      where: owner(userId, workspaceId),
      select: { id: true },
    })
  ).map((s) => s.id);

  const tags = await prisma.linkTrackingPixel.findMany({
    where: { linkId, projectId: workspaceId },
  });

  const wantedIds = new Set(wanted.map((s) => s.id));
  const toRemove = tags.filter(
    (t) =>
      t.savedPixelId &&
      ownIds.includes(t.savedPixelId) &&
      !wantedIds.has(t.savedPixelId),
  );
  const attached = new Set(tags.map((t) => t.savedPixelId).filter(Boolean));
  const toAdd = wanted.filter((s) => !attached.has(s.id));

  const sameTag = (s: (typeof wanted)[number]) =>
    tags.find(
      (t) =>
        t.platform === s.platform &&
        t.pixelId === s.pixelId &&
        t.conversionLabel === s.conversionLabel,
    );

  // a hand-entered tag with the same id is linked instead of duplicated
  const toLink = toAdd.filter((s) => sameTag(s));
  const toCreate = toAdd.filter((s) => !sameTag(s));

  if (tags.length - toRemove.length + toCreate.length > MAX_TAGS_PER_LINK) {
    throw new DubApiError({
      code: "exceeded_limit",
      message: `A link can have at most ${MAX_TAGS_PER_LINK} tracking tags.`,
    });
  }

  await prisma.$transaction([
    prisma.linkTrackingPixel.deleteMany({
      where: { id: { in: toRemove.map((t) => t.id) }, projectId: workspaceId },
    }),
    ...toLink.map((s) =>
      prisma.linkTrackingPixel.update({
        where: { id: sameTag(s)!.id },
        data: { savedPixelId: s.id, enabled: true },
      }),
    ),
    ...toCreate.map((s) =>
      prisma.linkTrackingPixel.create({
        data: {
          linkId,
          projectId: workspaceId,
          createdById: userId,
          platform: s.platform,
          pixelId: s.pixelId,
          conversionLabel: s.conversionLabel,
          name: s.name,
          savedPixelId: s.id,
        },
      }),
    ),
  ]);

  await invalidateTrackingTags(linkId);
}
