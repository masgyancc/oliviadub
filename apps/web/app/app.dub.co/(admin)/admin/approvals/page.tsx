import { getSession } from "@/lib/auth";
import { getAdminUsers } from "../get-admin-users";
import { UsersTable } from "../users-table";

export const dynamic = "force-dynamic";

export default async function PendingApprovalsPage() {
  const session = await getSession();
  const users = await getAdminUsers(
    { status: "pending" },
    session.user.id,
  );

  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">
        Pending Approvals
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        New registrations waiting for review. Approved users get full access
        immediately.
      </p>
      <div className="mt-6">
        <UsersTable
          users={users}
          currentUserId={session.user.id}
          emptyMessage="No registrations are waiting for approval."
        />
      </div>
    </div>
  );
}
