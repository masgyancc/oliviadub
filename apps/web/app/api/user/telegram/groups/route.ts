import { DubApiError } from "@/lib/api/errors";
import { parseRequestBody } from "@/lib/api/utils";
import { withSession } from "@/lib/auth";
import { isTelegramConfigured } from "@/lib/telegram/config";
import {
  createGroupConnectToken,
  listOwnedGroups,
} from "@/lib/telegram/groups";
import { ratelimit } from "@/lib/upstash";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

// GET /api/user/telegram/groups – Telegram groups the current user connected
export const GET = withSession(async ({ session }) => {
  return NextResponse.json(await listOwnedGroups(session.user.id));
});

// POST /api/user/telegram/groups – "add to group" deep link for one of the user's workspaces
export const POST = withSession(async ({ req, session }) => {
  if (!isTelegramConfigured()) {
    throw new DubApiError({
      code: "forbidden",
      message: "The Telegram bot is not configured yet.",
    });
  }

  const { workspaceId } = z
    .object({ workspaceId: z.string().min(1) })
    .parse(await parseRequestBody(req));

  const { success } = await ratelimit(10, "10 m").limit(
    `telegram:group-token:${session.user.id}`,
  );
  if (!success) {
    throw new DubApiError({
      code: "rate_limit_exceeded",
      message: "Too many attempts. Please try again in a few minutes.",
    });
  }

  return NextResponse.json(
    await createGroupConnectToken({ userId: session.user.id, workspaceId }),
  );
});
