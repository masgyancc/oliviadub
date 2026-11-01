"use client";

import { cn } from "@dub/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import { ThemePreference, useTheme } from "./theme";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

// Segmented Light / Dark / System control, used in the user menu
export function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
      <span className="text-base text-neutral-600 sm:text-sm">Theme</span>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="flex items-center rounded-lg border border-neutral-200 p-0.5"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={preference === value}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              preference === value
                ? "bg-neutral-100 text-neutral-900"
                : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
