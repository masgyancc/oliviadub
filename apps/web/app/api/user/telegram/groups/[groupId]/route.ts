import { withSession } from "@/lib/auth";
import { disconnectGroup } from "@/lib/telegram/groups";
import { NextResponse } from "next/server";

// DELETE /api/user/telegram/groups/[groupId] – disconnect a group the current user owns
export const DELETE = withSession(async ({ session, params }) => {
  await disconnectGroup(session.user.id, params.groupId);
  return NextResponse.json({ id: params.groupId });
});
