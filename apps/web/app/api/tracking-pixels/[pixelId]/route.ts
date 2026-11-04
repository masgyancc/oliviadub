import { deleteSavedPixel } from "@/lib/ads-tracking/saved-pixels";
import { withWorkspace } from "@/lib/auth";
import { NextResponse } from "next/server";

// DELETE /api/tracking-pixels/[pixelId] – remove a pixel from the current user's list
export const DELETE = withWorkspace(
  async ({ workspace, params, session }) => {
    await deleteSavedPixel({
      id: params.pixelId,
      userId: session.user.id,
      workspaceId: workspace.id,
    });

    return NextResponse.json({ id: params.pixelId });
  },
  {
    requiredPermissions: ["links.write"],
  },
);
