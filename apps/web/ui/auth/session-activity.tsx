"use client";

import {
  LAST_ACTIVITY_STORAGE_KEY,
  SESSION_EXPIRED_ERROR,
  SESSION_IDLE_TIMEOUT_SECONDS,
  SESSION_REFRESH_INTERVAL_MS,
} from "@/lib/auth/session-policy";
import { getSession, signOut, useSession } from "next-auth/react";
import { useEffect } from "react";

const IDLE_MS = SESSION_IDLE_TIMEOUT_SECONDS * 1000;
const SHARE_EVERY_MS = 30 * 1000;

function readShared() {
  try {
    return Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeShared(time: number) {
  try {
    localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(time));
  } catch {
    // private mode: this tab still tracks its own activity
  }
}

// BrewCC/BrewCC: keeps the session alive while the user works (refreshes the cookie at
// most every 5 minutes on clicks, typing or scrolling) and signs out after an hour without
// activity in any tab. The server enforces the same hour through the cookie's lifetime.
export function SessionActivity() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    let lastActivity = Date.now();
    let lastRefresh = Date.now();
    let lastShared = 0;
    writeShared(lastActivity);

    const onActivity = () => {
      const now = Date.now();
      lastActivity = now;
      if (now - lastShared > SHARE_EVERY_MS) {
        lastShared = now;
        writeShared(now);
      }
      if (now - lastRefresh > SESSION_REFRESH_INTERVAL_MS) {
        lastRefresh = now;
        // re-issues the session cookie with a fresh one-hour lifetime
        void getSession();
      }
    };

    const checkIdle = () => {
      const latest = Math.max(lastActivity, readShared());
      if (Date.now() - latest >= IDLE_MS) {
        void signOut({ callbackUrl: `/login?error=${SESSION_EXPIRED_ERROR}` });
      }
    };

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );
    const onVisible = () =>
      document.visibilityState === "visible" && checkIdle();
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(checkIdle, 60 * 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [status]);

  return null;
}
