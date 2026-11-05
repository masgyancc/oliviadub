import { withSession } from "@/lib/auth";
import { updateGroupMember } from "@/lib/telegram/groups";
import { NextResponse } from "next/server";

// POST /api/user/telegram/groups/[groupId]/members/[memberId] – approve a pending member
export const POST = withSession(async ({ session, params }) => {
  await updateGroupMember({
    userId: session.user.id,
    groupId: params.groupId,
    memberId: params.memberId,
    action: "approve",
  });
  return NextResponse.json({ id: params.memberId });
});

// DELETE /api/user/telegram/groups/[groupId]/members/[memberId] – remove a member or reject
export const DELETE = withSession(async ({ session, params }) => {
  await updateGroupMember({
    userId: session.user.id,
    groupId: params.groupId,
    memberId: params.memberId,
    action: "remove",
  });
  return NextResponse.json({ id: params.memberId });
});
