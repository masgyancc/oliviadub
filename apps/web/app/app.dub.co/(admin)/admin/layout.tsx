import { getSession } from "@/lib/auth";
import { getUserAccess, isMasterAdmin } from "@/lib/auth/platform-access";
import { Wordmark } from "@dub/ui";
import { constructMetadata } from "@dub/utils";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReactNode } from "react";
import { AdminNav } from "./admin-nav";

export const metadata = constructMetadata({ title: "Admin", noIndex: true });

// the role is always re-checked on the server; middleware only redirects early
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const access = await getUserAccess(session.user.id);
  if (!isMasterAdmin(access)) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Wordmark className="h-6" />
            </Link>
            <span className="rounded-md bg-neutral-900 px-1.5 py-0.5 text-xs font-medium text-white">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4 overflow-x-auto">
            <AdminNav />
            <Link
              href="/"
              className="whitespace-nowrap text-sm text-neutral-500 hover:text-neutral-800"
            >
              Back to app
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
