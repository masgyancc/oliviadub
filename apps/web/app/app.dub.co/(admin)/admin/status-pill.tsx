import { cn } from "@dub/utils";

const STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  suspended: "bg-red-100 text-red-800",
  master_admin: "bg-neutral-900 text-white",
  active: "bg-green-100 text-green-800",
  awaiting_dns: "bg-amber-100 text-amber-800",
  disabled: "bg-neutral-200 text-neutral-700",
};

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        STYLES[value] || "bg-neutral-100 text-neutral-700",
      )}
    >
      {value.replace("_", " ")}
    </span>
  );
}
