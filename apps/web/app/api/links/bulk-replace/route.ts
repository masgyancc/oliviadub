import { DubApiError } from "@/lib/api/errors";
import { parseRequestBody } from "@/lib/api/utils";
import { withWorkspace } from "@/lib/auth";
import {
  applyReplacement,
  MAX_LINKS_PER_RUN,
  previewReplacement,
} from "@/lib/bulk-replace/service";
import { ratelimit } from "@/lib/upstash";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

export const maxDuration = 300;

const domains = {
  oldDomain: z.string().trim().min(1).max(300),
  newDomain: z.string().trim().min(1).max(300),
};

const previewSchema = z.object({
  ...domains,
  action: z.literal("preview"),
  scope: z.enum(["all", "selected"]),
  linkIds: z.array(z.string().min(1)).max(1000).optional(),
});

const applySchema = z.object({
  ...domains,
  action: z.literal("apply"),
  items: z
    .array(z.object({ linkId: z.string().min(1), expectedUrl: z.string() }))
    .min(1)
    .max(MAX_LINKS_PER_RUN),
});

// POST /api/links/bulk-replace – BrewCC Bulk Destination Replacement
// { action: "preview" } is read-only; { action: "apply" } updates links after re-checking them.
// Always limited to links the session user created in this workspace (see lib/bulk-replace).
export const POST = withWorkspace(
  async ({ req, workspace, session }) => {
    const body = await parseRequestBody(req);
    const userId = session.user.id; // never taken from the request body

    if (body?.action === "apply") {
      const { success } = await ratelimit(5, "1 m").limit(
        `bulk-replace:apply:${userId}`,
      );
      if (!success) {
        throw new DubApiError({
          code: "rate_limit_exceeded",
          message: "Too many replacements. Please wait a minute.",
        });
      }
      const input = applySchema.parse(body);
      return NextResponse.json(
        await applyReplacement({ workspace, userId, ...input }),
      );
    }

    const input = previewSchema.parse(body);
    if (input.scope === "selected" && !input.linkIds?.length) {
      throw new DubApiError({
        code: "bad_request",
        message: "Select at least one link.",
      });
    }

    return NextResponse.json(
      await previewReplacement({
        workspace,
        userId,
        oldDomain: input.oldDomain,
        newDomain: input.newDomain,
        linkIds: input.scope === "selected" ? input.linkIds : undefined,
      }),
    );
  },
  {
    requiredPermissions: ["links.write"],
  },
);
