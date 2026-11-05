import { redis } from "@/lib/upstash/redis";
import { SESSION_TTL_SECONDS } from "./config";

// Short-lived conversation state per Telegram user (multi-step add/edit/search flows),
// plus the workspace the user picked in the bot.

export type Flow =
  | {
      type: "add";
      step: "domain" | "url" | "key" | "title" | "confirm";
      domain?: string;
      url?: string;
      key?: string;
      title?: string;
    }
  | {
      type: "edit";
      linkId: string;
      field?: "url" | "key" | "domain" | "title";
      value?: string;
    }
  | { type: "search" }
  | { type: "delete"; linkId: string }
  | {
      type: "bulk";
      step: "old" | "new" | "confirm";
      oldDomain?: string;
      newDomain?: string;
    };

export type ListFilter = { search?: string; domain?: string };

const filterKey = (telegramId: string) => `tg:filter:${telegramId}`;

export const getListFilter = async (telegramId: string) =>
  (await redis.get<ListFilter>(filterKey(telegramId))) ?? {};

export const setListFilter = (telegramId: string, filter: ListFilter) =>
  redis.set(filterKey(telegramId), filter, { ex: 60 * 60 });

const flowKey = (telegramId: string) => `tg:flow:${telegramId}`;
const workspaceKey = (telegramId: string) => `tg:ws:${telegramId}`;

export const getFlow = (telegramId: string) =>
  redis.get<Flow>(flowKey(telegramId));

export const setFlow = (telegramId: string, flow: Flow) =>
  redis.set(flowKey(telegramId), flow, { ex: SESSION_TTL_SECONDS });

export const clearFlow = (telegramId: string) => redis.del(flowKey(telegramId));

export const getSelectedWorkspace = (telegramId: string) =>
  redis.get<string>(workspaceKey(telegramId));

export const setSelectedWorkspace = (telegramId: string, workspaceId: string) =>
  redis.set(workspaceKey(telegramId), workspaceId, { ex: 60 * 60 * 24 * 30 });

// Telegram may resend an update; process each update_id once
export async function isDuplicateUpdate(updateId: number) {
  const fresh = await redis.set(`tg:update:${updateId}`, 1, {
    nx: true,
    ex: 60 * 60,
  });
  return fresh === null;
}
