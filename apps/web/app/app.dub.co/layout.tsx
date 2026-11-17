"use client";

import { SessionActivity } from "@/ui/auth/session-activity";
import { SessionProvider } from "next-auth/react";
import { ReactNode, Suspense } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {/* BrewCC: signs out after an hour without activity */}
      <SessionActivity />
      <Suspense>{children}</Suspense>
    </SessionProvider>
  );
}
