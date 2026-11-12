import { DubApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import * as z from "zod/v4";
import { TRACKING_ADAPTERS, TRACKING_PLATFORMS } from "./adapters";
import { invalidateTrackingTags } from "./cache";
import { TrackingPlatform, TrackingTag } from "./types";

// CRUD for a link's tracking tags. Callers (API routes) have already verified that the
// link belongs to the workspace (getLinkOrThrow) and that the user has links.write.
// Every query is additionally scoped by linkId AND projectId.

export const MAX_TAGS_PER_LINK = 10;
export const MAX_SAVED_PIXELS = 100;

// default name in "My pixels" for a pixel added without a name
export const defaultPixelName = (platform: TrackingPlatform, pixelId: string) =>
  `${TRACKING_ADAPTERS[platform].label} ${pixelId}`.slice(0, 60);

// The user's saved pixel ("My pixels") with this exact id, created when missing, so a
// pixel added anywhere can be ticked for any other link. Returns null only when the
// user's list is full; the tag then still works on its link.
export async function findOrCreateSavedPixel({
  userId,
  workspaceId,
  platform,
  tag,
  name,
}: {
  userId: string;
  workspaceId: string;
  platform: TrackingPlatform;
  tag: TrackingTag;
  name?: string | null;
}): Promise<string | null> {
  const where = {
    userId,
    projectId: workspaceId,
    platform,
    pixelId: tag.pixelId,
    conversionLabel: tag.conversionLabel ?? "",
  };
  const existing = await prisma.savedTrackingPixel.findFirst({
    where,
    select: { id: true },
  });
  if (existing) return existing.id;

  const count = await prisma.savedTrackingPixel.count({
    where: { userId, projectId: workspaceId },
  });
  if (count >= MAX_SAVED_PIXELS) return null;

  try {
    const created = await prisma.savedTrackingPixel.create({
      data: {
        ...where,
        name: (name?.trim() || defaultPixelName(platform, tag.pixelId)).slice(
          0,
          60,
        ),
      },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    // saved at the same moment by another request
    if (isUniqueViolation(error)) {
      const again = await prisma.savedTrackingPixel.findFirst({
        where,
        select: { id: true },
      });
      return again?.id ?? null;
    }
    throw error;
  }
}

const platformSchema = z.enum(
  TRACKING_PLATFORMS as [TrackingPlatform, ...TrackingPlatform[]],
);

export const createTrackingSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("manual"),
    platform: platformSchema,
    pixelId: z.string().trim().min(1).max(64),
    conversionLabel: z.string().trim().max(64).optional(),
    name: z.string().trim().max(60).optional(),
  }),
  z.object({
    mode: z.literal("code"),
    platform: platformSchema,
    code: z.string().min(1).max(20_000),
    name: z.string().trim().max(60).optional(),
  }),
]);

export const updateTrackingSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().trim().max(60).nullable().optional(),
  pixelId: z.string().trim().min(1).max(64).optional(),
  conversionLabel: z.string().trim().max(64).optional(),
});

const publicSelect = {
  id: true,
  platform: true,
  pixelId: true,
  conversionLabel: true,
  name: true,
  enabled: true,
  savedPixelId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const scope = (linkId: string, workspaceId: string) => ({
  linkId,
  projectId: workspaceId,
});

const validateOrThrow = (
  platform: TrackingPlatform,
  input: { pixelId: string; conversionLabel?: string },
): TrackingTag => {
  const result = TRACKING_ADAPTERS[platform].validate(input);
  if (!result.ok) {
    throw new DubApiError({
      code: "unprocessable_entity",
      message: result.error,
    });
  }
  return result.value;
};

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export function listTrackingTags(linkId: string, workspaceId: string) {
  return prisma.linkTrackingPixel.findMany({
    where: scope(linkId, workspaceId),
    select: publicSelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function createTrackingTags({
  linkId,
  workspaceId,
  userId,
  input,
}: {
  linkId: string;
  workspaceId: string;
  userId: string;
  input: z.infer<typeof createTrackingSchema>;
}) {
  const adapter = TRACKING_ADAPTERS[input.platform];

  // full code: only the ids the platform parser extracts are kept; the code itself is discarded
  const tags =
    input.mode === "manual"
      ? [validateOrThrow(input.platform, input)]
      : adapter
          .parseFullCode(input.code)
          .map((tag) => validateOrThrow(input.platform, tag));

  if (tags.length === 0) {
    throw new DubApiError({
      code: "unprocessable_entity",
      message: `No valid ${adapter.label} ID was found in the code you pasted.`,
    });
  }

  const existing = await prisma.linkTrackingPixel.count({
    where: scope(linkId, workspaceId),
  });
  if (existing + tags.length > MAX_TAGS_PER_LINK) {
    throw new DubApiError({
      code: "exceeded_limit",
      message: `A link can have at most ${MAX_TAGS_PER_LINK} tracking tags.`,
    });
  }

  // BrewCC: every pixel added here also lands in the user's "My pixels", so the link
  // builder and Ads Tracking show the same list and nothing has to be typed twice
  const savedIds: (string | null)[] = [];
  for (const tag of tags) {
    savedIds.push(
      await findOrCreateSavedPixel({
        userId,
        workspaceId,
        platform: input.platform,
        tag,
        name: input.name,
      }),
    );
  }

  try {
    const created = await prisma.$transaction(
      tags.map((tag, i) =>
        prisma.linkTrackingPixel.create({
          data: {
            ...scope(linkId, workspaceId),
            createdById: userId,
            platform: input.platform,
            pixelId: tag.pixelId,
            conversionLabel: tag.conversionLabel,
            name: input.name || null,
            savedPixelId: savedIds[i],
          },
          select: publicSelect,
        }),
      ),
    );
    await invalidateTrackingTags(linkId);
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DubApiError({
        code: "conflict",
        message: "This tracking ID is already added to this link.",
      });
    }
    throw error;
  }
}

async function getTagOrThrow(id: string, linkId: string, workspaceId: string) {
  const tag = await prisma.linkTrackingPixel.findFirst({
    where: { id, ...scope(linkId, workspaceId) },
  });
  if (!tag) {
    throw new DubApiError({
      code: "not_found",
      message: "Tracking tag not found.",
    });
  }
  return tag;
}

export async function updateTrackingTag({
  id,
  linkId,
  workspaceId,
  input,
}: {
  id: string;
  linkId: string;
  workspaceId: string;
  input: z.infer<typeof updateTrackingSchema>;
}) {
  const tag = await getTagOrThrow(id, linkId, workspaceId);

  const idChanged =
    input.pixelId !== undefined || input.conversionLabel !== undefined;
  const validated = idChanged
    ? validateOrThrow(tag.platform, {
        pixelId: input.pixelId ?? tag.pixelId,
        conversionLabel: input.conversionLabel ?? tag.conversionLabel,
      })
    : null;

  try {
    const updated = await prisma.linkTrackingPixel.update({
      where: { id: tag.id },
      data: {
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        ...(input.name !== undefined && { name: input.name || null }),
        ...(validated && {
          pixelId: validated.pixelId,
          conversionLabel: validated.conversionLabel,
          // the tag no longer matches its "My pixels" entry
          ...((validated.pixelId !== tag.pixelId ||
            (validated.conversionLabel ?? "") !== tag.conversionLabel) && {
            savedPixelId: null,
          }),
        }),
      },
      select: publicSelect,
    });
    await invalidateTrackingTags(linkId);
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DubApiError({
        code: "conflict",
        message: "This tracking ID is already added to this link.",
      });
    }
    throw error;
  }
}

export async function deleteTrackingTag({
  id,
  linkId,
  workspaceId,
}: {
  id: string;
  linkId: string;
  workspaceId: string;
}) {
  const tag = await getTagOrThrow(id, linkId, workspaceId);
  await prisma.linkTrackingPixel.delete({ where: { id: tag.id } });
  await invalidateTrackingTags(linkId);
}
