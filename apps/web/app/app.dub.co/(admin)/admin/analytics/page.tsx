import { prisma } from "@/lib/prisma";
import { formatDateTime, nFormatter } from "@dub/utils";

export const dynamic = "force-dynamic";

// Platform-wide tracking for master admins: clicks across every domain and workspace.
// Uses the per-link counters (kept in sync by the update-click-stats cron); detailed
// per-click analytics stay in each workspace's own Analytics page.
export default async function AdminAnalyticsPage() {
  const [byDomain, byDomainWorkspace, topLinks, workspaces, domainOwners] =
    await Promise.all([
      prisma.link.groupBy({
        by: ["domain"],
        _sum: { clicks: true, leads: true },
        _count: { _all: true },
        _max: { lastClicked: true },
        orderBy: { _sum: { clicks: "desc" } },
      }),
      prisma.link.groupBy({
        by: ["domain", "projectId"],
        _sum: { clicks: true },
        _count: { _all: true },
      }),
      prisma.link.findMany({
        where: { key: { not: "_root" } },
        orderBy: { clicks: "desc" },
        take: 50,
        select: {
          id: true,
          domain: true,
          key: true,
          url: true,
          clicks: true,
          lastClicked: true,
          projectId: true,
        },
      }),
      prisma.project.findMany({ select: { id: true, slug: true } }),
      prisma.domain.findMany({
        where: { projectId: { not: null } },
        select: { slug: true, projectId: true },
      }),
    ]);

  const wsSlug = (id: string | null) =>
    workspaces.find((w) => w.id === id)?.slug ?? "—";
  const ownerOf = (domain: string) =>
    domainOwners.find((d) => d.slug === domain)?.projectId ?? null;
  const totalClicks = byDomain.reduce((a, d) => a + (d._sum.clicks ?? 0), 0);

  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">Analytics</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Clicks across all domains and all workspaces (
        {nFormatter(totalClicks, { full: true })} total). Each user sees only
        their own links in their workspace analytics.
      </p>

      <h2 className="mt-8 text-sm font-semibold text-neutral-900">By domain</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Domain</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Links</th>
              <th className="px-4 py-3 font-medium">Clicks</th>
              <th className="px-4 py-3 font-medium">Used by (clicks)</th>
              <th className="px-4 py-3 font-medium">Last click</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {byDomain.map((d) => {
              const owner = ownerOf(d.domain);
              const usage = byDomainWorkspace
                .filter((x) => x.domain === d.domain)
                .sort((a, b) => (b._sum.clicks ?? 0) - (a._sum.clicks ?? 0));
              return (
                <tr key={d.domain} className="align-top">
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {d.domain}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {owner ? wsSlug(owner) : "shared default"}
                  </td>
                  <td className="px-4 py-3">{d._count._all}</td>
                  <td className="px-4 py-3 font-medium">
                    {nFormatter(d._sum.clicks ?? 0, { full: true })}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {usage.map((u) => (
                      <div key={u.projectId ?? "none"}>
                        {wsSlug(u.projectId)}:{" "}
                        {nFormatter(u._sum.clicks ?? 0, { full: true })}{" "}
                        <span className="text-neutral-400">
                          ({u._count._all} links)
                        </span>
                      </div>
                    ))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                    {d._max.lastClicked
                      ? formatDateTime(d._max.lastClicked)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-neutral-900">
        Top links (all workspaces)
      </h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Short link</th>
              <th className="px-4 py-3 font-medium">Destination</th>
              <th className="px-4 py-3 font-medium">Workspace</th>
              <th className="px-4 py-3 font-medium">Clicks</th>
              <th className="px-4 py-3 font-medium">Last click</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {topLinks.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 font-medium text-neutral-900">
                  {l.domain}/{l.key}
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-neutral-600">
                  {l.url}
                </td>
                <td className="px-4 py-3">{wsSlug(l.projectId)}</td>
                <td className="px-4 py-3 font-medium">
                  {nFormatter(l.clicks, { full: true })}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                  {l.lastClicked ? formatDateTime(l.lastClicked) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
