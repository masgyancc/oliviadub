import { prisma } from "@/lib/prisma";
import { createSafeActionClient } from "next-safe-action";
import { after } from "next/server";
import { normalizeWorkspaceId } from "../api/workspaces/workspace-id";
import { getSession } from "../auth";
import { assertMasterAdmin, assertUserApproved } from "../auth/platform-access";
import { logger } from "../axiom/server";
import { PlanProps } from "../types";

export const actionClient = createSafeActionClient({
  handleServerError: async (e) => {
    console.error("Server action error:", e);

    // Send error to Axiom
    logger.error(e.message, e);
    after(logger.flush());

    if (e instanceof Error) {
      return e.message;
    }

    return "An unknown error occurred.";
  },
});

export const authUserActionClient = actionClient.use(async ({ next }) => {
  const session = await getSession();

  if (!session?.user.id) {
    throw new Error("Unauthorized: Login required.");
  }

  // BrewCC: only approved accounts can run server actions
  await assertUserApproved(session.user.id);

  return next({
    ctx: {
      user: session.user,
    },
  });
});

// BrewCC master admins (role is read from the database, never from client input)
export const masterAdminActionClient = actionClient.use(async ({ next }) => {
  const session = await getSession();

  if (!session?.user.id) {
    throw new Error("Unauthorized: Login required.");
  }

  await assertMasterAdmin(session.user.id);

  return next({
    ctx: {
      user: session.user,
    },
  });
});

// Workspace users
export const authActionClient = actionClient.use(
  async ({ next, clientInput }) => {
    const session = await getSession();

    if (!session?.user.id) {
      throw new Error("Unauthorized: Login required.");
    }

    await assertUserApproved(session.user.id);

    // @ts-ignore
    let workspaceId = clientInput?.workspaceId;

    if (!workspaceId) {
      throw new Error("WorkspaceId is required.");
    }

    workspaceId = normalizeWorkspaceId(workspaceId);

    const workspace = await prisma.project.findUnique({
      where: {
        id: workspaceId,
      },
      include: {
        users: {
          where: {
            userId: session.user.id,
          },
          select: {
            role: true,
            workspacePreferences: true,
          },
        },
      },
    });

    if (!workspace || !workspace.users || workspace.users.length === 0) {
      throw new Error("Workspace not found.");
    }

    return next({
      ctx: {
        user: session.user,
        workspace: {
          ...workspace,
          role: workspace.users[0].role,
          plan: workspace.plan as PlanProps,
        },
      },
    });
  },
);
