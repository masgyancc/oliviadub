"use client";

import { setAllowUserDomainsAction } from "@/lib/actions/admin/admin-actions";
import { Switch } from "@dub/ui";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function AllowUserDomainsToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(enabled);

  const setting$ = useAction(setAllowUserDomainsAction, {
    onSuccess: ({ input }) => {
      toast.success(
        input.enabled
          ? "Users can now add custom domains."
          : "Adding custom domains is now disabled for users.",
      );
      router.refresh();
    },
    onError: ({ error }) => {
      setChecked(enabled);
      toast.error(error.serverError || "Failed.");
    },
  });

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-neutral-500">{checked ? "On" : "Off"}</span>
      <Switch
        checked={checked}
        disabled={setting$.isPending}
        fn={(value: boolean) => {
          setChecked(value);
          setting$.execute({ enabled: value });
        }}
      />
    </div>
  );
}
