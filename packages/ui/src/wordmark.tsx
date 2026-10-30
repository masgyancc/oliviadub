import { cn } from "@dub/utils";

// BrewCC wordmark: lowercase "brewcc" set in the app's display font
export function Wordmark({ className }: { className?: string }) {
  return (
    <svg
      width="92"
      height="24"
      viewBox="0 0 92 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="BrewCC"
      className={cn("h-6 w-auto text-black dark:text-white", className)}
    >
      <text
        x="0"
        y="19"
        fill="currentColor"
        fontFamily="var(--font-satoshi), var(--font-inter), ui-sans-serif, system-ui, sans-serif"
        fontSize="24"
        fontWeight="700"
        textLength="92"
        lengthAdjust="spacingAndGlyphs"
      >
        brewcc
      </text>
    </svg>
  );
}
