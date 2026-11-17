"use client";

import { sendOtpAction } from "@/lib/actions/send-otp";
import { LoadingSpinner } from "@dub/ui";
import { cn } from "@dub/utils";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useRef, useState } from "react";
import {
  TURNSTILE_SITE_KEY,
  TurnstileHandle,
  TurnstileWidget,
} from "../turnstile-widget";

export const ResendOtp = ({ email }: { email: string }) => {
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [state, setState] = useState<"default" | "success" | "error">(
    "default",
  );
  // BrewCC: resending a code needs a fresh CAPTCHA token (Turnstile, when configured)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);
  const waitingForCaptcha = Boolean(TURNSTILE_SITE_KEY) && !captchaToken;

  const { executeAsync, isPending } = useAction(sendOtpAction, {
    onSuccess: () => setState("success"),
    onError: () => setState("error"),
  });

  useEffect(() => {
    if (state === "success") {
      setDelaySeconds(60);
    } else if (state === "error") {
      setDelaySeconds(5);
    }
  }, [state]);

  useEffect(() => {
    if (delaySeconds > 0) {
      const interval = setInterval(
        () => setDelaySeconds(delaySeconds - 1),
        1000,
      );

      return () => clearInterval(interval);
    } else {
      setState("default");
    }
  }, [delaySeconds]);

  return (
    <div className="relative mt-4 text-center text-sm font-medium text-neutral-500">
      {state === "default" && (
        <>
          <div className="mb-2">
            <TurnstileWidget ref={captcha} onToken={setCaptchaToken} />
          </div>

          {isPending && (
            <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 pr-1.5">
              <LoadingSpinner className="h-3 w-3" />
            </div>
          )}

          <p className={cn(isPending && "opacity-80")}>
            Didn't receive a code?{" "}
            <button
              disabled={waitingForCaptcha}
              onClick={async () => {
                await executeAsync({
                  email,
                  ...(captchaToken && { turnstileToken: captchaToken }),
                });
                captcha.current?.reset();
              }}
              className={cn(
                "font-semibold text-neutral-700 transition-colors hover:text-neutral-900 disabled:cursor-not-allowed disabled:text-neutral-400",
                isPending && "pointer-events-none",
              )}
            >
              Resend
            </button>
          </p>
        </>
      )}

      {state === "success" && (
        <p className="text-sm text-neutral-500">
          Code sent successfully. <Delay seconds={delaySeconds} />
        </p>
      )}

      {state === "error" && (
        <p className="text-sm text-neutral-500">
          Failed to send code. <Delay seconds={delaySeconds} />
        </p>
      )}
    </div>
  );
};

const Delay = ({ seconds }: { seconds: number }) => {
  return (
    <span className="ml-1 text-sm tabular-nums text-neutral-400">
      {seconds}s
    </span>
  );
};
