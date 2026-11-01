"use client";

import { setUserAliasAction } from "@/lib/actions/admin/admin-actions";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

// Inline editor for the viewer's private alias, shown next to the email.
export function UserAlias({
  userId,
  alias,
}: {
  userId: string;
  alias: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(alias ?? "");

  const alias$ = useAction(setUserAliasAction, {
    onSuccess: () => {
      setEditing(false);
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError || "Failed."),
  });

  // Enter and blur both save; skip duplicates and unchanged values
  const save = () => {
    if (alias$.isPending) return;
    if (value.trim() === (alias ?? "")) return setEditing(false);
    alias$.execute({ userId, alias: value });
  };

  if (editing) {
    return (
      <form
        className="inline-flex"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          autoFocus
          value={value}
          maxLength={100}
          disabled={alias$.isPending}
          placeholder="Private alias"
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setValue(alias ?? "");
              setEditing(false);
            }
          }}
          className="h-6 w-40 rounded border border-neutral-300 px-1.5 text-xs"
        />
      </form>
    );
  }

  return (
    <button
      type="button"
      title="Private alias, only visible to you"
      onClick={() => setEditing(true)}
      className={
        alias
          ? "rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
          : "rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
      }
    >
      {alias || "+ alias"}
    </button>
  );
}
