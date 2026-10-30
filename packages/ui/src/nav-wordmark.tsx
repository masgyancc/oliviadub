"use client";

import { APP_DOMAIN, cn } from "@dub/utils";
import * as Popover from "@radix-ui/react-popover";
import { LayoutGrid, Type } from "lucide-react";
import { MouseEvent, useCallback, useContext, useState } from "react";
import { toast } from "sonner";
import { Button, ButtonProps } from "./button";
import { useCopyToClipboard } from "./hooks";
import { Logo } from "./logo";
import { NavContext } from "./nav";
import { Wordmark } from "./wordmark";

const logoSvg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="32" cy="32" r="32" fill="black"/>
<rect x="18" y="13" width="7" height="38" rx="1.5" fill="white"/>
<circle cx="34" cy="38" r="9.5" stroke="white" stroke-width="7"/>
</svg>`;

const wordmarkSvg = `<svg width="92" height="24" viewBox="0 0 92 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<text x="0" y="19" fill="black" font-family="Satoshi, Inter, sans-serif" font-size="24" font-weight="700" textLength="92" lengthAdjust="spacingAndGlyphs">brewcc</text>
</svg>`;

/**
 * The BrewCC logo with a custom context menu for copying/navigation,
 * for use in the top site nav
 */
export function NavWordmark({
  variant = "full",
  isInApp,
  className,
}: {
  variant?: "full" | "symbol";
  isInApp?: boolean;
  className?: string;
}) {
  const { theme } = useContext(NavContext);

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const handleContextMenu = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsPopoverOpen(true);
  }, []);

  const [, copyToClipboard] = useCopyToClipboard();

  function copy(text: string) {
    toast.promise(copyToClipboard(text), {
      success: "Copied to clipboard!",
      error: "Failed to copy to clipboard",
    });
  }

  return (
    <Popover.Root open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <Popover.Anchor asChild>
        <div onContextMenu={handleContextMenu} className="max-w-fit">
          {variant === "full" ? (
            <Wordmark className={className} />
          ) : (
            <Logo
              className={cn(
                "h-8 w-8 transition-all duration-75 active:scale-95",
                className,
              )}
            />
          )}
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          sideOffset={14}
          align="start"
          className={cn(
            "z-50 -mt-1.5",
            !isInApp && "-translate-x-8",
            theme === "dark" && "dark",
          )}
          onClick={(e) => {
            e.stopPropagation();
            setIsPopoverOpen(false);
          }}
        >
          <div className="grid gap-1 rounded-lg border border-neutral-200 bg-white p-2 drop-shadow-sm sm:min-w-[240px] dark:border-white/[0.15] dark:bg-black">
            <ContextMenuButton
              text="Copy Logo as SVG"
              variant="outline"
              onClick={() => copy(logoSvg)}
              icon={<Logo className="h-4 w-4" />}
            />
            <ContextMenuButton
              text="Copy Wordmark as SVG"
              variant="outline"
              onClick={() => copy(wordmarkSvg)}
              icon={<Type strokeWidth={2} className="h-4 w-4" />}
            />
            {!isInApp && (
              <ContextMenuButton
                text="Dashboard"
                variant="outline"
                onClick={() => window.open(APP_DOMAIN, "_blank")}
                icon={<LayoutGrid strokeWidth={2} className="h-4 w-4" />}
              />
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ContextMenuButton({ className, ...rest }: ButtonProps) {
  return (
    <Button
      className={cn(
        "h-9 justify-start px-3 font-medium hover:text-neutral-700 dark:text-white/70 dark:hover:bg-white/[0.15] dark:hover:text-white",
        className,
      )}
      {...rest}
    />
  );
}
