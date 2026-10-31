import { getOwnedLinkForTracking } from "@/lib/ads-tracking/get-owned-link";
import {
  createTrackingSchema,
  createTrackingTags,
  listTrackingTags,
} from "@/lib/ads-tracking/service";
import { DubApiError } from "@/lib/api/errors";
import { isRootDomainLinkKey } from "@/lib/api/links/utils/is-root-domain-link-key";
import { parseRequestBody } from "@/lib/api/utils";
import { withWorkspace } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET /api/links/[linkId]/tracking – list a link's ads tracking tags
export const GET = withWorkspace(
  async ({ workspace, params, session }) => {
    const link = await getOwnedLinkForTracking({
      workspace,
      userId: session.user.id,
      linkId: params.linkId,
      write: false,
    });

    return NextResponse.json(await listTrackingTags(link.id, workspace.id));
  },
  {
    requiredPermissions: ["links.read"],
  },
);

// POST /api/links/[linkId]/tracking – add tags (manual id or pasted official code)
export const POST = withWorkspace(
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

    const input = createTrackingSchema.parse(await parseRequestBody(req));

    const created = await createTrackingTags({
      linkId: link.id,
      workspaceId: workspace.id,
      userId: session.user.id,
      input,
    });

    return NextResponse.json(created, { status: 201 });
  },
  {
    requiredPermissions: ["links.write"],
  },
);
