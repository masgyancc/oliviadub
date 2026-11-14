"use client";

import {
  Bill,
  BILLING_APP_LABEL,
  BILLING_APPS,
  BillingApp,
  COST_FIELDS,
  MonthCosts,
} from "@/lib/brewcc/billing";
import { Button } from "@dub/ui";
import { cn } from "@dub/utils";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Report = {
  month: string;
  app: BillingApp;
  costs: MonthCosts;
  saved: boolean;
  carriedFrom: string | null;
  bill: Bill;
  errors: { local: string | null; peer: string | null };
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const num = (n: number) => n.toLocaleString("en-US");

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

async function request(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || "Something went wrong.");
  return json;
}

function MoneyInput({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  id: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-neutral-400">
        $
      </span>
      <input
        id={id}
        type="number"
        min={0}
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-md border border-neutral-300 py-1.5 pl-6 pr-2 text-right text-sm tabular-nums"
      />
    </div>
  );
}

export function BillingReport() {
  const [month, setMonth] = useState(thisMonth);
  const [report, setReport] = useState<Report | null>(null);
  const [costs, setCosts] = useState<MonthCosts | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pullingVercel, setPullingVercel] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: Report = await request(`/api/admin/billing?month=${month}`);
      setReport(data);
      setCosts(data.costs);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!costs) return;
    setSaving(true);
    try {
      const res = await request("/api/admin/billing", {
        method: "PUT",
        body: JSON.stringify({ month, costs }),
      });
      if (res.syncedToPeer) toast.success("Costs saved in both panels.");
      else
        toast.warning(
          `Saved here, but not in the other app: ${res.peerError}. Save again later.`,
        );
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const pullVercel = async () => {
    setPullingVercel(true);
    try {
      const { total, until } = await request(
        `/api/admin/billing/vercel?month=${month}`,
      );
      setCosts((c) => (c ? { ...c, vercel: total } : c));
      toast.success(
        `Vercel charges until ${new Date(until).toLocaleDateString()}: ${usd(total)}. Save to apply.`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPullingVercel(false);
    }
  };

  const setAppCost = (app: BillingApp, key: string, v: number) =>
    setCosts((c) =>
      c ? { ...c, apps: { ...c.apps, [app]: { ...c.apps[app], [key]: v } } } : c,
    );

  const bill = report?.bill;
  const dirty = JSON.stringify(costs) !== JSON.stringify(report?.costs);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="billing-month" className="text-sm font-medium text-neutral-700">
          Month
        </label>
        <input
          id="billing-month"
          type="month"
          value={month}
          max={thisMonth()}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {report?.errors.peer && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The other app's clicks couldn't be loaded ({report.errors.peer}).
          Totals below only include{" "}
          {BILLING_APP_LABEL[report.app]}.
        </div>
      )}
      {report?.errors.local && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          This app's clicks couldn't be loaded ({report.errors.local}).
        </div>
      )}

      {/* costs */}
      <section className="rounded-xl border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-3">
          <h2 className="font-medium text-neutral-900">Costs for {month}</h2>
          {report && !report.saved && (
            <span className="text-xs text-amber-700">
              {report.carriedFrom
                ? `Not saved yet — prefilled from ${report.carriedFrom}.`
                : "Not saved yet."}
            </span>
          )}
        </div>
        {!costs ? (
          <div className="m-5 h-40 animate-pulse rounded-lg bg-neutral-100" />
        ) : (
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-48">
                <label htmlFor="cost-vercel" className="mb-1 block text-sm text-neutral-700">
                  Vercel (whole team, split 50:50)
                </label>
                <MoneyInput
                  id="cost-vercel"
                  value={costs.vercel}
                  onChange={(v) => setCosts({ ...costs, vercel: v })}
                />
              </div>
              <Button
                variant="secondary"
                text="Get from Vercel"
                className="h-9 w-fit"
                loading={pullingVercel}
                onClick={pullVercel}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-neutral-500">
                    <th className="py-2 font-medium">Service</th>
                    {BILLING_APPS.map((app) => (
                      <th key={app} className="w-40 py-2 font-medium">
                        {BILLING_APP_LABEL[app]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COST_FIELDS.map((f) => (
                    <tr key={f.key} className="border-t border-neutral-100">
                      <td className="py-2 text-neutral-700">{f.label}</td>
                      {BILLING_APPS.map((app) => (
                        <td key={app} className="py-2 pr-2">
                          <MoneyInput
                            id={`cost-${app}-${f.key}`}
                            value={costs.apps[app][f.key]}
                            onChange={(v) => setAppCost(app, f.key, v)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3">
              {dirty && (
                <span className="text-xs text-neutral-500">Unsaved changes</span>
              )}
              <Button
                text="Save costs"
                className="h-9 w-fit"
                loading={saving}
                disabled={!dirty && !!report?.saved}
                onClick={save}
              />
            </div>
          </div>
        )}
      </section>

      {/* summary */}
      {bill && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Total cost", usd(bill.totalCost)],
            ...BILLING_APPS.map((app) => [
              `${BILLING_APP_LABEL[app]} share`,
              `${usd(bill.pools[app])} · ${num(bill.clicks[app])} clicks`,
            ]),
            ["Users billed", num(bill.users.length)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-xs text-neutral-500">{label}</div>
              <div className="mt-1 text-base font-semibold tabular-nums text-neutral-900">
                {value}
              </div>
            </div>
          ))}
        </section>
      )}

      {bill &&
        BILLING_APPS.some((app) => bill.unassigned[app] > 0) && (
          <p className="text-xs text-neutral-500">
            Not split (no clicks this month):{" "}
            {BILLING_APPS.filter((app) => bill.unassigned[app] > 0)
              .map((app) => `${BILLING_APP_LABEL[app]} ${usd(bill.unassigned[app])}`)
              .join(", ")}
            .
          </p>
        )}

      {/* per user */}
      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-neutral-50">
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5 font-medium">User</th>
              {BILLING_APPS.map((app) => (
                <th key={app} className="px-4 py-2.5 text-right font-medium">
                  {BILLING_APP_LABEL[app]}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading && !bill ? (
              <tr>
                <td colSpan={4} className="px-4 py-6">
                  <div className="h-16 animate-pulse rounded bg-neutral-100" />
                </td>
              </tr>
            ) : !bill?.users.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                  No clicks in {month} yet.
                </td>
              </tr>
            ) : (
              bill.users.map((u) => (
                <Fragment key={u.email}>
                  <tr
                    className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                    onClick={() => setOpen(open === u.email ? null : u.email)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-neutral-400 transition-transform",
                            open === u.email && "rotate-180",
                          )}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-neutral-900">
                            {u.email}
                          </div>
                          {u.name && (
                            <div className="truncate text-xs text-neutral-500">{u.name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {BILLING_APPS.map((app) => {
                      const line = u.apps[app];
                      return (
                        <td key={app} className="px-4 py-2.5 text-right tabular-nums">
                          {line ? (
                            <>
                              <div className="text-neutral-900">{usd(line.amount)}</div>
                              <div className="text-xs text-neutral-500">
                                {num(line.clicks)} clicks
                              </div>
                            </>
                          ) : (
                            <span className="text-neutral-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-neutral-900">
                      {usd(u.total)}
                    </td>
                  </tr>
                  {open === u.email && (
                    <tr className="bg-neutral-50/60">
                      <td colSpan={4} className="px-4 pb-3 pt-1">
                        <div className="grid gap-3 pl-6 sm:grid-cols-2">
                          {BILLING_APPS.filter((app) => u.apps[app]).map((app) => (
                            <div key={app}>
                              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                                {BILLING_APP_LABEL[app]} workspaces
                              </div>
                              {u.apps[app]!.workspaces.map((w) => (
                                <div
                                  key={w.slug}
                                  className="flex justify-between gap-3 text-sm text-neutral-700"
                                >
                                  <span className="truncate">{w.name}</span>
                                  <span className="tabular-nums text-neutral-500">
                                    {num(w.clicks)} clicks
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
