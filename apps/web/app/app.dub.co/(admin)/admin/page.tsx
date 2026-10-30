import { prisma } from "@/lib/prisma";
import { nFormatter } from "@dub/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [statusCounts, workspaces, links, domains, domainsVerified] =
    await Promise.all([
      prisma.user.groupBy({
        by: ["status"],
        where: { isMachine: false },
        _count: { _all: true },
      }),
      prisma.project.count(),
      prisma.link.count(),
      prisma.domain.count({ where: { projectId: { not: null } } }),
      prisma.domain.count({
        where: { projectId: { not: null }, verified: true, archived: false },
      }),
    ]);

  const byStatus = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count._all]),
  ) as Record<string, number>;
  const totalUsers = Object.values(byStatus).reduce((a, b) => a + b, 0);

  const stats = [
    { label: "Users", value: totalUsers },
    {
      label: "Pending approvals",
      value: byStatus.pending ?? 0,
      href: "/admin/approvals",
      highlight: (byStatus.pending ?? 0) > 0,
    },
    { label: "Suspended", value: byStatus.suspended ?? 0 },
    { label: "Workspaces", value: workspaces },
    { label: "Links", value: links },
    {
      label: "Custom domains (active / total)",
      value: `${domainsVerified} / ${domains}`,
      href: "/admin/domains",
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">Overview</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Platform statistics for BrewCC.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, href, highlight }) => {
          const body = (
            <div
              className={`rounded-xl border bg-white p-5 ${highlight ? "border-amber-300" : "border-neutral-200"}`}
            >
              <div className="text-sm text-neutral-500">{label}</div>
              <div className="mt-2 text-2xl font-semibold text-neutral-900">
                {typeof value === "number"
                  ? nFormatter(value, { full: true })
                  : value}
              </div>
            </div>
          );
          return href ? (
            <Link
              key={label}
              href={href}
              className="transition-opacity hover:opacity-80"
            >
              {body}
            </Link>
          ) : (
            <div key={label}>{body}</div>
          );
        })}
      </div>
    </div>
  );
}
