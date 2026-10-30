"use client";

import {
  updateUserRoleAction,
  updateUserStatusAction,
} from "@/lib/actions/admin/admin-actions";
import { Button } from "@dub/ui";
import type { AccountStatus, PlatformRole } from "@prisma/client";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type StatusAction = "approve" | "reject" | "suspend" | "reactivate";

const ACTIONS_BY_STATUS: Record<AccountStatus, StatusAction[]> = {
  pending: ["approve", "reject"],
  approved: ["suspend"],
  rejected: ["approve"],
  suspended: ["reactivate"],
};

const NEEDS_REASON: StatusAction[] = ["reject", "suspend"];

export function UserActions({
  userId,
  status,
  platformRole,
  isSelf,
  showRoleToggle = false,
}: {
  userId: string;
  status: AccountStatus;
  platformRole: PlatformRole;
  isSelf: boolean;
  showRoleToggle?: boolean;
}) {
  const router = useRouter();
  const [reasonFor, setReasonFor] = useState<StatusAction | null>(null);
  const [reason, setReason] = useState("");

  const onDone = (message: string) => () => {
    toast.success(message);
    setReasonFor(null);
    setReason("");
    router.refresh();
  };

  const status$ = useAction(updateUserStatusAction, {
    onSuccess: onDone("User status updated."),
    onError: ({ error }) => toast.error(error.serverError || "Failed."),
  });

  const role$ = useAction(updateUserRoleAction, {
    onSuccess: onDone("User role updated."),
    onError: ({ error }) => toast.error(error.serverError || "Failed."),
  });

  if (isSelf) {
    return <span className="text-xs text-neutral-400">You</span>;
  }

  const actions =
    platformRole === "master_admin"
      ? ACTIONS_BY_STATUS[status].filter((a) => !NEEDS_REASON.includes(a))
      : ACTIONS_BY_STATUS[status];

  if (reasonFor) {
    return (
      <form
        className="flex flex-col gap-2 sm:min-w-64"
        onSubmit={(e) => {
          e.preventDefault();
          status$.execute({ userId, action: reasonFor, reason });
        }}
      >
        <textarea
          className="w-full rounded-md border border-neutral-300 p-2 text-sm"
          placeholder="Reason (optional, shown to the user)"
          maxLength={500}
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="danger"
            text={`Confirm ${reasonFor}`}
            loading={status$.isPending}
            className="h-8 w-auto px-3 text-xs capitalize"
          />
          <Button
            type="button"
            variant="secondary"
            text="Cancel"
            onClick={() => setReasonFor(null)}
            className="h-8 w-auto px-3 text-xs"
          />
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action}
          variant={
            action === "approve" || action === "reactivate"
              ? "primary"
              : "secondary"
          }
          text={action}
          loading={status$.isPending && status$.input?.action === action}
          onClick={() =>
            NEEDS_REASON.includes(action)
              ? setReasonFor(action)
              : status$.execute({ userId, action })
          }
          className="h-8 w-auto px-3 text-xs capitalize"
        />
      ))}
      {showRoleToggle && status === "approved" && (
        <Button
          variant="secondary"
          text={
            platformRole === "master_admin"
              ? "Remove master admin"
              : "Make master admin"
          }
          loading={role$.isPending}
          onClick={() => {
            const role =
              platformRole === "master_admin" ? "user" : "master_admin";
            if (
              confirm(
                role === "master_admin"
                  ? "Give this user full master admin access?"
                  : "Remove master admin access from this user?",
              )
            ) {
              role$.execute({ userId, role });
            }
          }}
          className="h-8 w-auto px-3 text-xs"
        />
      )}
    </div>
  );
}
