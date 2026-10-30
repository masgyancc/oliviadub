import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Wordmark } from "@dub/ui";
import { constructMetadata, formatDate } from "@dub/utils";
import { redirect } from "next/navigation";
import { SignOutButton } from "./sign-out-button";

export const metadata = constructMetadata({ title: "Account status" });

const STATUS_COPY = {
  pending: {
    title: "Your account is awaiting approval",
    description:
      "Thanks for signing up! An administrator is reviewing your registration. You'll be able to use BrewCC as soon as your account is approved.",
    badge: "bg-amber-100 text-amber-800",
  },
  rejected: {
    title: "Your registration was not approved",
    description:
      "An administrator reviewed your registration and did not approve it. Contact the BrewCC team if you believe this is a mistake.",
    badge: "bg-red-100 text-red-800",
  },
  suspended: {
    title: "Your account has been suspended",
    description:
      "Access to BrewCC has been suspended for this account. Contact the BrewCC team for more information.",
    badge: "bg-red-100 text-red-800",
  },
} as const;

export default async function PendingPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      createdAt: true,
      status: true,
      statusReason: true,
    },
  });

  if (user?.status === "approved") {
    redirect("/");
  }

  // stale session for a deleted account: middleware sends it here, so don't redirect back (loop)
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50 px-4">
        <Wordmark className="h-8" />
        <p className="text-sm text-neutral-600">
          This account no longer exists.
        </p>
        <SignOutButton />
      </div>
    );
  }

  const copy = STATUS_COPY[user.status];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12">
      <Wordmark className="mb-8 h-8" />
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${copy.badge}`}
        >
          {user.status}
        </span>
        <h1 className="mt-4 text-lg font-semibold text-neutral-900">
          {copy.title}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">{copy.description}</p>

        {user.statusReason && user.status !== "pending" && (
          <p className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
            <span className="font-medium">Reason:</span> {user.statusReason}
          </p>
        )}

        <dl className="mt-6 divide-y divide-neutral-100 border-t border-neutral-100 text-sm">
          {[
            ["Name", user.name || "—"],
            ["Email", user.email || "—"],
            ["Registered", formatDate(user.createdAt)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2.5">
              <dt className="text-neutral-500">{label}</dt>
              <dd className="truncate font-medium text-neutral-800">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
