"use server";

import { addDomainToVercel } from "@/lib/api/domains/add-domain-vercel";
import { markDomainAsDeleted } from "@/lib/api/domains/mark-domain-deleted";
import { removeDomainFromVercel } from "@/lib/api/domains/remove-domain-vercel";
import { invalidateUserAccess } from "@/lib/auth/platform-access";
import { upgradeOwnedWorkspacesToEnterprise } from "@/lib/brewcc/enterprise-plan";
import {
  getAllowUserDomains,
  setAllowUserDomains,
} from "@/lib/brewcc/platform-settings";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@dub/email";
import { APP_DOMAIN } from "@dub/utils";
import { AccountStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import * as z from "zod/v4";
import { masterAdminActionClient } from "../safe-action";

// BrewCC master admin actions. Every action is authorized server-side by
// masterAdminActionClient (role read from the database) and written to AdminAuditLog.

const STATUS_ACTIONS = {
  approve: { to: "approved", from: ["pending", "rejected"] },
  reject: { to: "rejected", from: ["pending", "approved"] },
  suspend: { to: "suspended", from: ["approved"] },
  reactivate: { to: "approved", from: ["suspended"] },
} as const satisfies Record<
  string,
  { to: AccountStatus; from: readonly AccountStatus[] }
>;

const STATUS_EMAILS: Record<
  keyof typeof STATUS_ACTIONS,
  { subject: string; body: (reason?: string | null) => string }
> = {
  approve: {
    subject: "Your BrewCC account has been approved",
    body: () =>
      `Good news! Your BrewCC account has been approved. You can now sign in and start using BrewCC: ${APP_DOMAIN}`,
  },
  reject: {
    subject: "Your BrewCC registration",
    body: (reason) =>
      `Unfortunately your BrewCC registration was not approved.${reason ? `\n\nReason: ${reason}` : ""}`,
  },
  suspend: {
    subject: "Your BrewCC account has been suspended",
    body: (reason) =>
      `Your BrewCC account has been suspended.${reason ? `\n\nReason: ${reason}` : ""}`,
  },
  reactivate: {
    subject: "Your BrewCC account has been reactivated",
    body: () =>
      `Your BrewCC account has been reactivated. You can sign in again: ${APP_DOMAIN}`,
  },
};

export const updateUserStatusAction = masterAdminActionClient
  .inputSchema(
    z.object({
      userId: z.string().min(1),
      action: z.enum(["approve", "reject", "suspend", "reactivate"]),
      reason: z.string().trim().max(500).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { userId, action, reason } = parsedInput;
    const { to, from } = STATUS_ACTIONS[action];

    if (userId === ctx.user.id) {
      throw new Error("You cannot change your own account status.");
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true, platformRole: true },
    });

    if (!target) {
      throw new Error("User not found.");
    }

    // prevents locking out the platform: master admins must be demoted before suspension/rejection
    if (target.platformRole === "master_admin" && to !== "approved") {
      throw new Error(
        "Master admins cannot be suspended or rejected. Change their role first.",
      );
    }

    if (!(from as readonly AccountStatus[]).includes(target.status)) {
      throw new Error(
        `Cannot ${action} a user whose status is "${target.status}".`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: to,
          statusReason: reason || null,
          statusUpdatedAt: new Date(),
          statusUpdatedById: ctx.user.id,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: ctx.user.id,
          action: `user.${action}`,
          targetUserId: userId,
          fromValue: target.status,
          toValue: to,
          reason: reason || null,
        },
      });
      // BrewCC: approved users get enterprise on any workspace they already own
      if (to === "approved") {
        await upgradeOwnedWorkspacesToEnterprise(tx, userId);
      }
    });

    await invalidateUserAccess(userId);

    if (target.email) {
      const email = STATUS_EMAILS[action];
      try {
        await sendEmail({
          to: target.email,
          subject: email.subject,
          text: email.body(reason),
        });
      } catch (error) {
        console.error("[updateUserStatusAction] email failed", error);
      }
    }

    revalidatePath("/admin", "layout");
  });

export const updateUserRoleAction = masterAdminActionClient
  .inputSchema(
    z.object({
      userId: z.string().min(1),
      role: z.enum(["user", "master_admin"]),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { userId, role } = parsedInput;

    // the acting admin always remains, so at least one master admin is guaranteed
    if (userId === ctx.user.id) {
      throw new Error("You cannot change your own role.");
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { platformRole: true, status: true, isMachine: true },
    });

    if (!target || target.isMachine) {
      throw new Error("User not found.");
    }

    if (role === "master_admin" && target.status !== "approved") {
      throw new Error("Only approved users can become master admins.");
    }

    if (target.platformRole === role) {
      return;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { platformRole: role },
      }),
      prisma.adminAuditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "user.role",
          targetUserId: userId,
          fromValue: target.platformRole,
          toValue: role,
        },
      }),
    ]);

    await invalidateUserAccess(userId);
    revalidatePath("/admin", "layout");
  });

// Private alias: scoped to the acting admin, so other admins never see it.
// Deliberately not written to AdminAuditLog, which every master admin can read.
export const setUserAliasAction = masterAdminActionClient
  .inputSchema(
    z.object({
      userId: z.string().min(1),
      alias: z.string().trim().max(100),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { userId, alias } = parsedInput;
    const key = { adminId_userId: { adminId: ctx.user.id, userId } };

    if (!alias) {
      await prisma.adminUserAlias.deleteMany({
        where: { adminId: ctx.user.id, userId },
      });
    } else {
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!target) {
        throw new Error("User not found.");
      }
      await prisma.adminUserAlias.upsert({
        where: key,
        create: { adminId: ctx.user.id, userId, alias },
        update: { alias },
      });
    }

    revalidatePath("/admin", "layout");
  });

// "Allow Users to Add Domains": global, stored in PlatformSetting, applies immediately
export const setAllowUserDomainsAction = masterAdminActionClient
  .inputSchema(z.object({ enabled: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const { enabled } = parsedInput;
    const before = await getAllowUserDomains();

    if (before === enabled) {
      return;
    }

    await setAllowUserDomains(enabled, ctx.user.id);
    await prisma.adminAuditLog.create({
      data: {
        actorId: ctx.user.id,
        action: "settings.allow_user_domains",
        fromValue: before ? "on" : "off",
        toValue: enabled ? "on" : "off",
      },
    });

    revalidatePath("/admin", "layout");
  });

export const adminDomainAction = masterAdminActionClient
  .inputSchema(
    z.object({
      domainId: z.string().min(1),
      action: z.enum(["disable", "enable", "delete"]),
      reason: z.string().trim().max(500).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { domainId, action, reason } = parsedInput;

    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { slug: true, archived: true, projectId: true },
    });

    if (!domain || !domain.projectId) {
      throw new Error("Domain not found.");
    }

    if (action === "disable") {
      // removing the hostname from Vercel stops all traffic and certificates for it
      await removeDomainFromVercel(domain.slug);
      await prisma.domain.update({
        where: { id: domainId },
        data: { archived: true, verified: false },
      });
    } else if (action === "enable") {
      const res = await addDomainToVercel(domain.slug);
      if (res.error && res.error.code !== "domain_already_in_use") {
        throw new Error(res.error.message);
      }
      // verified is restored by the domain verification cron once DNS checks pass
      await prisma.domain.update({
        where: { id: domainId },
        data: { archived: false },
      });
    } else {
      // same path as a workspace deleting its own domain (the background job removes it from Vercel and cleans up links)
      await markDomainAsDeleted({ domain: domain.slug });
    }

    await prisma.adminAuditLog.create({
      data: {
        actorId: ctx.user.id,
        action: `domain.${action}`,
        targetDomain: domain.slug,
        reason: reason || null,
      },
    });

    revalidatePath("/admin", "layout");
  });
