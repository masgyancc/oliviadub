import { getOwnedLinkForTracking } from "@/lib/ads-tracking/get-owned-link";
import {
  deleteTrackingTag,
  updateTrackingSchema,
  updateTrackingTag,
} from "@/lib/ads-tracking/service";
import { parseRequestBody } from "@/lib/api/utils";
import { withWorkspace } from "@/lib/auth";
import { NextResponse } from "next/server";

// PATCH /api/links/[linkId]/tracking/[tagId] – enable/disable, rename or change the id
export const PATCH = withWorkspace(
  async ({ req, workspace, params, session }) => {
    const link = await getOwnedLinkForTracking({
      workspace,
      userId: session.user.id,
      linkId: params.linkId,
      write: true,
    });

    const input = updateTrackingSchema.parse(await parseRequestBody(req));

    return NextResponse.json(
      await updateTrackingTag({
        id: params.tagId,
        linkId: link.id,
        workspaceId: workspace.id,
        input,
      }),
    );
  },
  {
    requiredPermissions: ["links.write"],
  },
);

// DELETE /api/links/[linkId]/tracking/[tagId]
export const DELETE = withWorkspace(
  async ({ workspace, params, session }) => {
    const link = await getOwnedLinkForTracking({
      workspace,
      userId: session.user.id,
      linkId: params.linkId,
      write: true,
    });

    await deleteTrackingTag({
      id: params.tagId,
      linkId: link.id,
      workspaceId: workspace.id,
    });

    return NextResponse.json({ id: params.tagId });
  },
  {
    requiredPermissions: ["links.write"],
  },
);
