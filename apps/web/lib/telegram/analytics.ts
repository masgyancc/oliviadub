import { getAnalytics } from "@/lib/analytics/get-analytics";
import { WorkspaceWithUsers } from "@/lib/types";
import { parseAnalyticsQuery } from "@/lib/zod/schemas/analytics";
import { TZDate } from "@date-fns/tz";
import { COUNTRIES, REGIONS } from "@dub/utils";
import { format, subDays } from "date-fns";
import { TELEGRAM_TIMEZONE } from "./config";

// Basic click analytics for the bot, fetched through the same getAnalytics/Tinybird path and
// query parsing as GET /api/analytics, so the numbers match the dashboard.

export type Range = "today" | "yesterday" | "7d" | "30d" | "all";

export const RANGE_LABELS: Record<Range, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

// a calendar day in the bot timezone, expressed as noon UTC of that date
const dayParam = (daysAgo: number) =>
  `${format(subDays(new TZDate(Date.now(), TELEGRAM_TIMEZONE), daysAgo), "yyyy-MM-dd")}T12:00:00.000Z`;

const rangeParams = (range: Range): Record<string, string> => {
  switch (range) {
    case "today":
      return { start: dayParam(0), end: dayParam(0) };
    case "yesterday":
      return { start: dayParam(1), end: dayParam(1) };
    case "7d":
      return { interval: "7d" };
    case "30d":
      return { interval: "30d" };
    case "all":
      return { interval: "all" };
  }
};

export async function getClicks({
  workspace,
  range,
  linkId,
}: {
  workspace: WorkspaceWithUsers;
  range: Range;
  linkId?: string;
}) {
  const params = parseAnalyticsQuery({
    event: "clicks",
    groupBy: "count",
    timezone: TELEGRAM_TIMEZONE,
    ...rangeParams(range),
    ...(linkId && { linkId }),
  });

  const response = (await getAnalytics({
    ...params,
    workspaceId: workspace.id,
    // "all" starts at workspace creation, like the dashboard
    ...(range === "all" && { dataAvailableFrom: workspace.createdAt }),
  })) as { clicks?: number } | undefined;

  return response?.clicks ?? 0;
}

export type Breakdown = { label: string; clicks: number }[];

export const BREAKDOWN_RANGE: Range = "30d";
const BREAKDOWN_TOP = 5;

// top regions / devices by clicks over BREAKDOWN_RANGE
export async function getBreakdown({
  workspace,
  linkId,
  groupBy,
}: {
  workspace: WorkspaceWithUsers;
  linkId?: string;
  groupBy: "regions" | "devices";
}): Promise<Breakdown> {
  const params = parseAnalyticsQuery({
    event: "clicks",
    groupBy,
    timezone: TELEGRAM_TIMEZONE,
    ...rangeParams(BREAKDOWN_RANGE),
    ...(linkId && { linkId }),
  });

  const rows = ((await getAnalytics({
    ...params,
    workspaceId: workspace.id,
  })) ?? []) as {
    region?: string;
    country?: string;
    device?: string;
    clicks?: number;
  }[];

  return rows
    .filter((row) => (row.clicks ?? 0) > 0)
    .sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0))
    .slice(0, BREAKDOWN_TOP)
    .map((row) => ({
      label:
        groupBy === "regions"
          ? `${REGIONS[row.region ?? ""] || row.region || "Unknown"}, ${COUNTRIES[row.country ?? ""] || row.country || "?"}`
          : row.device || "Unknown",
      clicks: row.clicks ?? 0,
    }));
}

export async function getClicksSummary(args: {
  workspace: WorkspaceWithUsers;
  linkId?: string;
}) {
  const ranges: Range[] = ["today", "yesterday", "7d", "30d", "all"];
  const values = await Promise.all(
    ranges.map((range) => getClicks({ ...args, range })),
  );
  return Object.fromEntries(ranges.map((r, i) => [r, values[i]])) as Record<
    Range,
    number
  >;
}
