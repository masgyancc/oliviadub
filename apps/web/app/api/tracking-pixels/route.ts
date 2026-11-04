import {
  createSavedPixel,
  createSavedPixelSchema,
  listSavedPixels,
} from "@/lib/ads-tracking/saved-pixels";
import { parseRequestBody } from "@/lib/api/utils";
import { withWorkspace } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET /api/tracking-pixels – the current user's saved pixels in this workspace
export const GET = withWorkspace(
  async ({ workspace, session }) => {
    return NextResponse.json(
      await listSavedPixels(session.user.id, workspace.id),
    );
  },
  {
    requiredPermissions: ["links.read"],
  },
);

// POST /api/tracking-pixels – save a pixel to the current user's list
export const POST = withWorkspace(
  async ({ req, workspace, session }) => {
    const input = createSavedPixelSchema.parse(await parseRequestBody(req));

    return NextResponse.json(
      await createSavedPixel({
        userId: session.user.id,
        workspaceId: workspace.id,
        input,
      }),
      { status: 201 },
    );
  },
  {
    requiredPermissions: ["links.write"],
  },
);
