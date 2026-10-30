import { formatDate } from "@dub/utils";
import type { AccountStatus, PlatformRole } from "@prisma/client";
import { StatusPill } from "./status-pill";
import { UserActions } from "./user-actions";

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: Date;
  status: AccountStatus;
  platformRole: PlatformRole;
  statusReason: string | null;
  workspaces: number;
}

export function UsersTable({
  users,
  currentUserId,
  showRoleToggle = false,
  emptyMessage,
}: {
  users: AdminUserRow[];
  currentUserId: string;
  showRoleToggle?: boolean;
  emptyMessage: string;
}) {
  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Workspaces</th>
            <th className="px-4 py-3 font-medium">Registered</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {users.map((u) => (
            <tr key={u.id} className="align-top">
              <td className="px-4 py-3">
                <div className="font-medium text-neutral-900">
                  {u.name || "—"}
                </div>
                <div className="text-neutral-500">{u.email}</div>
                {u.statusReason && (
                  <div className="mt-1 text-xs text-neutral-400">
                    Reason: {u.statusReason}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusPill value={u.status} />
              </td>
              <td className="px-4 py-3">
                <StatusPill value={u.platformRole} />
              </td>
              <td className="px-4 py-3 text-neutral-600">{u.workspaces}</td>
              <td className="px-4 py-3 text-neutral-600">
                {formatDate(u.createdAt)}
              </td>
              <td className="px-4 py-3">
                <UserActions
                  userId={u.id}
                  status={u.status}
                  platformRole={u.platformRole}
                  isSelf={u.id === currentUserId}
                  showRoleToggle={showRoleToggle}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
