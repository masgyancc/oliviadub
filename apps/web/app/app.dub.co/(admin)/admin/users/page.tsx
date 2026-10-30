import { getSession } from "@/lib/auth";
import { cn } from "@dub/utils";
import { AccountStatus } from "@prisma/client";
import Link from "next/link";
import { getAdminUsers } from "../get-admin-users";
import { UsersTable } from "../users-table";

export const dynamic = "force-dynamic";

const FILTERS = ["all", ...Object.values(AccountStatus)] as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status: statusParam, q } = await searchParams;
  const status = (Object.values(AccountStatus) as string[]).includes(
    statusParam ?? "",
  )
    ? (statusParam as AccountStatus)
    : undefined;
  const search = q?.trim().slice(0, 100);

  const session = await getSession();
  const users = await getAdminUsers({
    ...(status && { status }),
    ...(search && {
      OR: [{ email: { contains: search } }, { name: { contains: search } }],
    }),
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">Users</h1>
      <p className="mt-1 text-sm text-neutral-500">
        All BrewCC accounts. Master admins have equal, full access.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => {
            const active = (status ?? "all") === f;
            const params = new URLSearchParams({
              ...(f !== "all" && { status: f }),
              ...(search && { q: search }),
            });
            return (
              <Link
                key={f}
                href={`/admin/users${params.size ? `?${params}` : ""}`}
                className={cn(
                  "rounded-md px-2.5 py-1 text-sm capitalize",
                  active
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50",
                )}
              >
                {f}
              </Link>
            );
          })}
        </div>
        <form className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={search}
            placeholder="Search name or email"
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm sm:w-64"
          />
        </form>
      </div>

      <div className="mt-4">
        <UsersTable
          users={users}
          currentUserId={session.user.id}
          showRoleToggle
          emptyMessage="No users match this filter."
        />
      </div>
    </div>
  );
}
