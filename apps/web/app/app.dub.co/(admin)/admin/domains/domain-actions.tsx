"use client";

import { adminDomainAction } from "@/lib/actions/admin/admin-actions";
import { Button } from "@dub/ui";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const CONFIRMATIONS = {
  disable: (slug: string) =>
    `Disable ${slug}? All links on this domain stop working until it is re-enabled.`,
  enable: (slug: string) =>
    `Re-enable ${slug}? It becomes active again once its DNS is verified.`,
  delete: (slug: string) =>
    `Delete ${slug} permanently? The domain and all of its links will be removed. This cannot be undone.`,
};

export function DomainActions({
  domainId,
  slug,
  disabled,
}: {
  domainId: string;
  slug: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const { execute, isPending, input } = useAction(adminDomainAction, {
    onSuccess: () => {
      toast.success("Domain updated.");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError || "Failed."),
  });

  const run = (action: keyof typeof CONFIRMATIONS) => {
    if (confirm(CONFIRMATIONS[action](slug))) {
      execute({ domainId, action });
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        text={disabled ? "Enable" : "Disable"}
        loading={isPending && input?.action !== "delete"}
        onClick={() => run(disabled ? "enable" : "disable")}
        className="h-8 w-auto px-3 text-xs"
      />
      <Button
        variant="danger"
        text="Delete"
        loading={isPending && input?.action === "delete"}
        onClick={() => run("delete")}
        className="h-8 w-auto px-3 text-xs"
      />
    </div>
  );
}
