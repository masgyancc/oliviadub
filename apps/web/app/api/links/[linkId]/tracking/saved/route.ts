import { getOwnedLinkForTracking } from "@/lib/ads-tracking/get-owned-link";
import {
  getLinkSavedPixelIds,
  setLinkSavedPixels,
  setLinkSavedPixelsSchema,
} from "@/lib/ads-tracking/saved-pixels";
import { DubApiError } from "@/lib/api/errors";
import { isRootDomainLinkKey } from "@/lib/api/links/utils/is-root-domain-link-key";
import { parseRequestBody } from "@/lib/api/utils";
import { withWorkspace } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET /api/links/[linkId]/tracking/saved – ids of the current user's saved pixels on this link
export const GET = withWorkspace(
  async ({ workspace, params, session }) => {
    const link = await getOwnedLinkForTracking({
      workspace,
      userId: session.user.id,
      linkId: params.linkId,
      write: false,
    });

    return NextResponse.json({
      savedPixelIds: await getLinkSavedPixelIds({
        linkId: link.id,
        userId: session.user.id,
        workspaceId: workspace.id,
      }),
    });
  },
  {
    requiredPermissions: ["links.read"],
  },
);

// PUT /api/links/[linkId]/tracking/saved – set which of the user's saved pixels the link uses
export const PUT = withWorkspace(
  async ({ req, workspace, params, session }) => {
    const link = await getOwnedLinkForTracking({
      workspace,
      userId: session.user.id,
      linkId: params.linkId,
      write: true,
    });

    if (isRootDomainLinkKey(link.key)) {
      throw new DubApiError({
        code: "forbidden",
        message:
          "Ads tracking is available for short links, not root domain links.",
      });
    }

    const { savedPixelIds } = setLinkSavedPixelsSchema.parse(
      await parseRequestBody(req),
    );

    await setLinkSavedPixels({
      linkId: link.id,
      userId: session.user.id,
      workspaceId: workspace.id,
      savedPixelIds,
    });

    return NextResponse.json({ savedPixelIds });
  },
  {
    requiredPermissions: ["links.write"],
  },
);
