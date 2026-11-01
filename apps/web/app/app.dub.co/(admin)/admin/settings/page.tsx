import { getAllowUserDomains } from "@/lib/brewcc/platform-settings";
import { AllowUserDomainsToggle } from "./allow-user-domains-toggle";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const allowUserDomains = await getAllowUserDomains();

  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">Settings</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Platform-wide options. Changes apply immediately to every user.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Domain Settings
      </h2>
      <div className="mt-3 rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-start justify-between gap-6 p-5">
          <div>
            <div className="font-medium text-neutral-900">
              Allow Users to Add Domains
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              Control whether users are allowed to add custom domains to their
              workspace.
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              When off, only master admins can add domains. Existing domains
              stay as they are and remain usable by everyone.
            </p>
          </div>
          <AllowUserDomainsToggle enabled={allowUserDomains} />
        </div>
      </div>
    </div>
  );
}
