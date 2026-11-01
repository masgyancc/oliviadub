"use client";

import { useCallback, useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

// BrewCC light/dark mode. The choice is per browser (localStorage) and applied as
// <html data-theme="dark">; globals.css does the actual darkening. "light" is the
// default, so pages look unchanged until a user opts in.

export type ThemePreference = "light" | "dark" | "system";

const readPreference = (): ThemePreference => {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" || value === "system" ? value : "light";
  } catch {
    return "light";
  }
};

const systemPrefersDark = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const applyTheme = (preference: ThemePreference) => {
  const dark =
    preference === "dark" || (preference === "system" && systemPrefersDark());
  if (dark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
};

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>("light");

  useEffect(() => {
    setPreferenceState(readPreference());
  }, []);

  // follow the OS setting live while "system" is selected
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((value: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // storage blocked: the choice still applies for this page view
    }
    setPreferenceState(value);
    applyTheme(value);
  }, []);

  return { preference, setPreference };
}
