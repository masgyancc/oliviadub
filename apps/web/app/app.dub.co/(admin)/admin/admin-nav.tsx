"use client";

import { cn } from "@dub/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/approvals", label: "Pending Approvals" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/domains", label: "Domains" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit-log", label: "Audit Log" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {TABS.map(({ href, label }) => {
        const active =
          href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-neutral-100 font-medium text-neutral-900"
                : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
