import { parseRequestBody } from "@/lib/api/utils";
import { withWorkspace } from "@/lib/auth";
import { listRuns, undoRun } from "@/lib/bulk-replace/service";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

export const maxDuration = 300;

// GET /api/links/bulk-replace/runs – the session user's recent replacement runs (this workspace)
export const GET = withWorkspace(
  async ({ workspace, session }) =>
    NextResponse.json(await listRuns({ workspace, userId: session.user.id })),
  {
    requiredPermissions: ["links.read"],
  },
);

// POST /api/links/bulk-replace/runs – { runId } undo a run (only the session user's own rows)
export const POST = withWorkspace(
  async ({ req, workspace, session }) => {
    const { runId } = z
      .object({ runId: z.string().min(1).max(64) })
      .parse(await parseRequestBody(req));

    return NextResponse.json(
      await undoRun({ workspace, userId: session.user.id, runId }),
    );
  },
  {
    requiredPermissions: ["links.write"],
  },
);
