import { BillingReport } from "./billing-report";

export const dynamic = "force-dynamic";

export default function AdminBillingPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">Billing</h1>
      <p className="mt-1 max-w-3xl text-sm text-neutral-500">
        One shared bill for BrewCC and BrewAds, the same in both admin panels.
        The Vercel bill is split 50:50 between the two apps; each app's costs
        are then split between its users by their share of its clicks. A user
        of both apps gets one total with a line per app. Domains are not
        included.
      </p>
      <BillingReport />
    </div>
  );
}
