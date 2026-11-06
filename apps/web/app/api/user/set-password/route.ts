import { DubApiError } from "@/lib/api/errors";
import { parseRequestBody } from "@/lib/api/utils";
import { withSession } from "@/lib/auth";
import { PASSWORD_RESET_TOKEN_EXPIRY } from "@/lib/auth/constants";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { assertRateLimit } from "@/lib/upstash/assert-rate-limit";
import { RATELIMIT_POLICIES } from "@/lib/upstash/ratelimit-policies";
import { passwordSchema } from "@/lib/zod/schemas/auth";
import { sendEmail } from "@dub/email";
import PasswordUpdated from "@dub/email/templates/password-updated";
import ResetPasswordLink from "@dub/email/templates/reset-password-link";
import { APP_DOMAIN } from "@dub/utils";
import { waitUntil } from "@vercel/functions";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

// POST /api/user/set-password - set account password (for users who signed up with a OAuth provider)
export const POST = withSession(async ({ session }) => {
  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      isMachine: false,
      passwordHash: null,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new DubApiError({
      code: "bad_request",
      message:
        "You already have a password set. You can change it in your account settings.",
    });
  }

  const { token } = await prisma.passwordResetToken.create({
    data: {
      identifier: session.user.email,
      token: randomBytes(32).toString("hex"),
      expires: new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY * 1000),
    },
  });

  // Send email with password reset link
  await sendEmail({
    subject: "BrewCC: Password reset instructions",
    to: session.user.email,
    react: ResetPasswordLink({
      email: session.user.email,
      url: `${APP_DOMAIN}/auth/reset-password/${token}`,
    }),
  });

  if (process.env.NODE_ENV === "development") {
    console.info(
      "Password reset URL:",
      `${APP_DOMAIN}/auth/reset-password/${token}`,
    );
  }

  return NextResponse.json({ ok: true });
});

// PUT /api/user/set-password - BrewCC: set the first password directly from the dashboard.
// Only for signed-in accounts without a password (Google/GitHub sign-up); the session already
// proves who the user is, so no email link is needed. Changing an existing password still
// goes through PATCH /api/user/password with the current password.
export const PUT = withSession(async ({ req, session }) => {
  const { password } = z
    .object({ password: passwordSchema })
    .parse(await parseRequestBody(req));

  await assertRateLimit({
    policy: RATELIMIT_POLICIES.passwordResetRequest,
    identifier: `set-password:${session.user.id}`,
  });

  const user = await prisma.user.findFirst({
    where: { id: session.user.id, isMachine: false },
    select: { id: true, passwordHash: true, emailVerified: true },
  });

  if (!user || user.passwordHash) {
    throw new DubApiError({
      code: "bad_request",
      message:
        "You already have a password set. You can change it in your account settings.",
    });
  }

  // only set it while the account still has no password (no race with a parallel request)
  const updated = await prisma.user.updateMany({
    where: { id: user.id, passwordHash: null },
    data: {
      passwordHash: await hashPassword(password),
      // the Google/GitHub sign-in already proved the email; password login requires this
      ...(!user.emailVerified && { emailVerified: new Date() }),
    },
  });
  if (updated.count === 0) {
    throw new DubApiError({
      code: "bad_request",
      message: "You already have a password set.",
    });
  }

  await prisma.passwordResetToken.deleteMany({
    where: { identifier: session.user.email },
  });

  waitUntil(
    sendEmail({
      subject: "Your BrewCC account password has been set",
      to: session.user.email,
      react: PasswordUpdated({ email: session.user.email }),
    }),
  );

  return NextResponse.json({ ok: true });
});
