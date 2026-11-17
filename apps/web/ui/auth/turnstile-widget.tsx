"use client";

import Script from "next/script";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "flexible" | "compact";
    },
  ) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export type TurnstileHandle = { reset: () => void };

// Cloudflare Turnstile check. Renders nothing while no site key is configured (CAPTCHA
// off). Tokens are single use: call reset() after each submit so the next one gets a
// fresh token.
export const TurnstileWidget = forwardRef<
  TurnstileHandle,
  { onToken: (token: string | null) => void }
>(function TurnstileWidget({ onToken }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(
    typeof window !== "undefined" && Boolean(window.turnstile),
  );
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  const render = useCallback(() => {
    if (!TURNSTILE_SITE_KEY || !container.current || !window.turnstile) return;
    if (widgetId.current) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: TURNSTILE_SITE_KEY,
      size: "flexible",
      theme: "light",
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
    });
  }, []);

  useEffect(() => {
    if (loaded) render();
    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [loaded, render]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenRef.current(null);
      if (widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current);
      }
    },
  }));

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setLoaded(true)}
        onReady={() => setLoaded(true)}
      />
      <div ref={container} className="min-h-[65px] w-full" />
    </>
  );
});
