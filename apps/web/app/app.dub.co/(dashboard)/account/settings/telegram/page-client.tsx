"use client";

import { Button } from "@dub/ui";
import { fetcher, formatDateTime } from "@dub/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

interface TelegramStatus {
  configured: boolean;
  botUsername: string | null;
  connected: boolean;
  telegramUsername: string | null;
  connectedAt: string | null;
}

export default function TelegramPageClient() {
  const [deepLink, setDeepLink] = useState<{
    url: string;
    expiresAt: string;
  } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const { data, isLoading, mutate } = useSWR<TelegramStatus>(
    "/api/user/telegram",
    fetcher,
    // while a deep link is open, poll so the page flips to "Connected" on its own
    { refreshInterval: deepLink ? 3000 : 0 },
  );

  useEffect(() => {
    if (deepLink && data?.connected) {
      setDeepLink(null);
      toast.success("Telegram connected.");
    }
  }, [deepLink, data?.connected]);

  const connect = async () => {
    setConnecting(true);
    const res = await fetch("/api/user/telegram", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setConnecting(false);
    if (!res.ok) {
      toast.error(
        json?.error?.message || "Could not create a connection link.",
      );
      return;
    }
    setDeepLink({ url: json.deepLink, expiresAt: json.expiresAt });
    window.open(json.deepLink, "_blank", "noopener,noreferrer");
  };

  const disconnect = async () => {
    if (
      !confirm(
        "Disconnect Telegram? The bot will stop working for your account.",
      )
    ) {
      return;
    }
    setDisconnecting(true);
    const res = await fetch("/api/user/telegram", { method: "DELETE" });
    setDisconnecting(false);
    if (!res.ok) {
      toast.error("Could not disconnect Telegram.");
      return;
    }
    toast.success("Telegram disconnected.");
    mutate();
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-col gap-1 border-b border-neutral-200 p-6">
        <h2 className="text-base font-semibold">Telegram Bot</h2>
        <p className="text-sm text-neutral-500">
          Create, edit, delete and track your short links directly from
          Telegram. The bot uses your BrewCC account and only shows links from
          your workspaces.
        </p>
      </div>

      <div className="p-6">
        {isLoading || !data ? (
          <div className="h-10 w-48 animate-pulse rounded-lg bg-neutral-100" />
        ) : !data.configured ? (
          <p className="text-sm text-neutral-600">
            The Telegram bot is not configured yet. Please contact an
            administrator.
          </p>
        ) : data.connected ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  Connected
                </span>
                <span className="font-medium text-neutral-900">
                  {data.telegramUsername
                    ? `@${data.telegramUsername}`
                    : "Telegram account"}
                </span>
              </div>
              {data.connectedAt && (
                <p className="mt-1 text-neutral-500">
                  Since {formatDateTime(data.connectedAt)}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {data.botUsername && (
                <a
                  href={`https://t.me/${data.botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="secondary"
                    text="Open bot"
                    className="h-9 w-auto px-3"
                  />
                </a>
              )}
              <Button
                variant="danger"
                text="Disconnect"
                loading={disconnecting}
                onClick={disconnect}
                className="h-9 w-auto px-3"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-600">
              <li>
                Click <b>Connect Telegram</b>. Telegram opens the BrewCC bot.
              </li>
              <li>
                Press <b>Start</b> in Telegram.
              </li>
              <li>
                This page switches to <b>Connected</b> automatically.
              </li>
            </ol>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                text="Connect Telegram"
                loading={connecting}
                onClick={connect}
                className="h-9 w-auto px-4"
              />
              {deepLink && (
                <span className="text-sm text-neutral-500">
                  Didn&apos;t open?{" "}
                  <a
                    href={deepLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-neutral-900 underline"
                  >
                    Open the bot
                  </a>{" "}
                  (link valid until {formatDateTime(deepLink.expiresAt)}, one
                  use only)
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
