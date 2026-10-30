import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@dub/utils";
import { StatusPill } from "../status-pill";
import { DomainActions } from "./domain-actions";

export const dynamic = "force-dynamic";

export default async function AdminDomainsPage() {
  const domains = await prisma.domain.findMany({
    where: { projectId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      slug: true,
      verified: true,
      archived: true,
      lastChecked: true,
      createdAt: true,
      project: {
        select: {
          slug: true,
          users: {
            where: { role: "owner" },
            select: { user: { select: { email: true } } },
            take: 3,
          },
        },
      },
    },
  });

  const statusOf = (d: (typeof domains)[number]) =>
    d.archived ? "disabled" : d.verified ? "active" : "awaiting_dns";

  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">Domains</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Custom domains added by users. DNS and SSL are verified automatically
        (hourly, and when the user clicks refresh). Disabling a domain removes
        it from the edge network and stops all of its links.
      </p>

      {domains.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No custom domains yet.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Workspace / owner</th>
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3 font-medium">Last checked</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {domains.map((d) => {
                const status = statusOf(d);
                return (
                  <tr key={d.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {d.slug}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={status} />
                      {status === "awaiting_dns" && (
                        <div className="mt-1 text-xs text-neutral-400">
                          DNS record missing or SSL not issued yet
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>{d.project?.slug}</div>
                      <div className="text-neutral-500">
                        {d.project?.users.map((u) => u.user.email).join(", ")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {formatDate(d.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {formatDateTime(d.lastChecked)}
                    </td>
                    <td className="px-4 py-3">
                      <DomainActions
                        domainId={d.id}
                        slug={d.slug}
                        disabled={d.archived}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
