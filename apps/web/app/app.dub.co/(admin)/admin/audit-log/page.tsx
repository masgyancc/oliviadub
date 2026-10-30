import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@dub/utils";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const userIds = [
    ...new Set(
      logs.flatMap((l) => [l.actorId, l.targetUserId]).filter(Boolean),
    ),
  ] as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true },
  });
  const label = (id: string | null) => {
    if (!id) return null;
    const u = users.find((u) => u.id === id);
    return u?.email || u?.name || id;
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">Audit Log</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every action taken by a master admin (latest 200).
      </p>

      {logs.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No admin actions recorded yet.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {logs.map((log) => (
                <tr key={log.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">{label(log.actorId)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3">
                    {label(log.targetUserId) || log.targetDomain || "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {log.fromValue || log.toValue
                      ? `${log.fromValue ?? "—"} → ${log.toValue ?? "—"}`
                      : "—"}
                    {log.reason && (
                      <div className="mt-1 text-xs text-neutral-400">
                        {log.reason}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
