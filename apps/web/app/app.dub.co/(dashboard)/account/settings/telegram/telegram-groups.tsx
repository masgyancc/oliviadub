"use client";

import useWorkspaces from "@/lib/swr/use-workspaces";
import { Button } from "@dub/ui";
import { fetcher, formatDateTime } from "@dub/utils";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

interface GroupMember {
  id: string;
  telegramUsername: string | null;
  displayName: string | null;
  status: "pending" | "approved";
  requestedAt: string;
}

interface TelegramGroup {
  id: string;
  title: string | null;
  connectedAt: string;
  workspace: { id: string; name: string; slug: string } | null;
  members: GroupMember[];
}

const memberName = (m: GroupMember) =>
  m.telegramUsername ? `@${m.telegramUsername}` : m.displayName || "Member";

async function request(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || "Something went wrong.");
  return json;
}

// BrewCC: connect Telegram groups to one workspace each and manage who may use the bot there
export function TelegramGroups({ connected }: { connected: boolean }) {
  const { workspaces } = useWorkspaces();
  const [workspaceId, setWorkspaceId] = useState("");
  const [creating, setCreating] = useState(false);
  const [deepLink, setDeepLink] = useState<{
    url: string;
    expiresAt: string;
  } | null>(null);

  const { data: groups, mutate } = useSWR<TelegramGroup[]>(
    "/api/user/telegram/groups",
    fetcher,
    { refreshInterval: deepLink ? 3000 : 0 },
  );

  const selectedWorkspace = workspaceId || workspaces?.[0]?.id || "";

  const connect = async () => {
    setCreating(true);
    try {
      const json = await request("/api/user/telegram/groups", "POST", {
        workspaceId: selectedWorkspace,
      });
      setDeepLink({ url: json.deepLink, expiresAt: json.expiresAt });
      window.open(json.deepLink, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const act = async (url: string, method: string, success: string) => {
    try {
      await request(url, method);
      toast.success(success);
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-col gap-1 border-b border-neutral-200 p-6">
        <h2 className="text-base font-semibold">Telegram Groups</h2>
        <p className="text-sm text-neutral-500">
          Use the bot together in a Telegram group. Each group is locked to one
          of your workspaces and acts as you. Members can only use it after you
          approve them.
        </p>
      </div>

      <div className="space-y-6 p-6">
        {!connected ? (
          <p className="text-sm text-neutral-600">
            Connect your own Telegram account above first. Only you can connect
            your groups and approve members.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-600">
              <li>Pick the workspace the group may use.</li>
              <li>
                Click <b>Connect a group</b>, choose the group in Telegram and
                add the bot.
              </li>
              <li>
                Members type <b>/menu</b> and press <b>Request access</b>; you
                approve them in the group or below.
              </li>
            </ol>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={selectedWorkspace}
                onChange={(e) => setWorkspaceId(e.target.value)}
                className="h-9 rounded-md border border-neutral-300 px-2 text-sm"
              >
                {workspaces?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <Button
                text="Connect a group"
                loading={creating}
                disabled={!selectedWorkspace}
                onClick={connect}
                className="h-9 w-auto px-4"
              />
            </div>
            {deepLink && (
              <p className="text-sm text-neutral-500">
                Didn&apos;t open?{" "}
                <a
                  href={deepLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-neutral-900 underline"
                >
                  Add the bot to a group
                </a>{" "}
                (valid until {formatDateTime(deepLink.expiresAt)}, one use only)
              </p>
            )}
          </div>
        )}

        {groups && groups.length > 0 && (
          <div className="space-y-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="rounded-lg border border-neutral-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-medium text-neutral-900">
                      {group.title || "Telegram group"}
                    </p>
                    <p className="text-neutral-500">
                      Workspace: {group.workspace?.name ?? "—"} · since{" "}
                      {formatDateTime(group.connectedAt)}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    text="Disconnect"
                    className="h-8 w-auto px-3"
                    onClick={() =>
                      confirm(
                        "Disconnect this group? The bot stops working there and all members lose access.",
                      ) &&
                      act(
                        `/api/user/telegram/groups/${group.id}`,
                        "DELETE",
                        "Group disconnected.",
                      )
                    }
                  />
                </div>

                <div className="mt-3 divide-y divide-neutral-100 rounded-md border border-neutral-100">
                  {group.members.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-neutral-500">
                      No members yet. Only you can use the bot in this group.
                    </p>
                  ) : (
                    group.members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-900">
                            {memberName(m)}
                          </span>
                          <span
                            className={
                              m.status === "approved"
                                ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800"
                                : "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                            }
                          >
                            {m.status === "approved" ? "Approved" : "Pending"}
                          </span>
                        </div>
                        <div className="flex gap-3 text-xs">
                          {m.status === "pending" && (
                            <button
                              type="button"
                              className="font-medium text-green-700 hover:underline"
                              onClick={() =>
                                act(
                                  `/api/user/telegram/groups/${group.id}/members/${m.id}`,
                                  "POST",
                                  `${memberName(m)} approved.`,
                                )
                              }
                            >
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            className="font-medium text-red-600 hover:underline"
                            onClick={() =>
                              act(
                                `/api/user/telegram/groups/${group.id}/members/${m.id}`,
                                "DELETE",
                                `${memberName(m)} removed.`,
                              )
                            }
                          >
                            {m.status === "pending" ? "Reject" : "Remove"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
