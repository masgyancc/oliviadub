"use client";

import { Button } from "@dub/ui";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="secondary"
      text="Sign out"
      loading={loading}
      onClick={() => {
        setLoading(true);
        signOut({ callbackUrl: "/login" });
      }}
    />
  );
}
