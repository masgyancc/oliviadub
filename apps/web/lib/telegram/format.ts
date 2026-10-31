import { linkConstructor, nFormatter } from "@dub/utils";

// Telegram HTML parse mode: only &, < and > need escaping
export const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const truncate = (value: string, max = 60) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export const shortLinkOf = (link: { domain: string; key: string }) =>
  linkConstructor({ domain: link.domain, key: link.key, pretty: true });

export const formatCount = (n: number) => nFormatter(n, { full: true });
