import { cn } from "@dub/utils";

// BrewCC symbol: a geometric lowercase "b" on a circle
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="BrewCC"
      className={cn("h-10 w-10 text-black dark:text-white", className)}
    >
      <circle cx="32" cy="32" r="32" fill="currentColor" />
      <g className="fill-white stroke-white dark:fill-black dark:stroke-black">
        <rect x="18" y="13" width="7" height="38" rx="1.5" stroke="none" />
        <circle cx="34" cy="38" r="9.5" fill="none" strokeWidth="7" />
      </g>
    </svg>
  );
}
