import { DubApiError } from "@/lib/api/errors";
import { PermissionAction } from "@/lib/api/rbac/permissions";
import { ratelimit } from "@/lib/upstash";
import { getUrlFromString, isValidUrl } from "@dub/utils";
import {
  applyReplacement,
  MAX_LINKS_PER_RUN,
  previewReplacement,
  undoRun,
} from "@/lib/bulk-replace/service";
import {
  Breakdown,
  getBreakdown,
  getClicksSummary,
  RANGE_LABELS,
} from "./analytics";
import {
  answerCallback,
  editMessage,
  InlineKeyboard,
  sendMessage,
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
} from "./api";
import { LINKS_PAGE_SIZE } from "./config";
import {
  BotUser,
  can,
  getUserWorkspaces,
  loadWorkspace,
  resolveBotUser,
} from "./context";
import { esc, formatCount, shortLinkOf, truncate } from "./format";
import { redeemTelegramLinkToken } from "./linking";
import {
  createLinkFromBot,
  deleteLinkFromBot,
  getAvailableDomains,
  getOwnedLink,
  listLinks,
  updateLinkFromBot,
} from "./links";
import {
  clearFlow,
  Flow,
  getFlow,
  getListFilter,
  getSelectedWorkspace,
  setFlow,
  setListFilter,
  setSelectedWorkspace,
} from "./session";

// Callback data (≤ 64 bytes):
//   m main · ws / ws:<id> workspace · l:<page> list · lsr search · ldm / ldf:<i> domain filter · lclr clear filters
//   d:<linkId> detail · n add · nd:<i> add-domain · nc confirm add
//   e:<linkId> edit · ef:<field>:<linkId> field · edd:<i> new domain · ec confirm edit
//   x:<linkId> delete · xy:<linkId> confirm delete · a analytics · as:<linkId> link analytics · c cancel
//   bd bulk domain change · bdy confirm · bdu:<runId> undo

type Reply = { text: string; keyboard?: InlineKeyboard };

interface Ctx {
  telegramId: string;
  chatId: number;
  user: BotUser;
}

const NOT_LINKED =
  "🔒 Telegram kamu belum terhubung ke akun BrewCC.\n\nBuka dashboard BrewCC → <b>Settings → Telegram</b> → <b>Connect Telegram</b>.";

const STATUS_MESSAGES = {
  pending: "⏳ Akun BrewCC kamu masih menunggu persetujuan admin.",
  rejected: "⛔ Pendaftaran akun BrewCC kamu tidak disetujui.",
  suspended: "⛔ Akun BrewCC kamu sedang disuspend.",
  missing: NOT_LINKED,
  unlinked: NOT_LINKED,
};

const LINK_ERRORS = {
  invalid: "❌ Link penghubung tidak valid. Buat link baru dari dashboard.",
  expired:
    "⌛ Link penghubung sudah kedaluwarsa (5 menit). Buat link baru dari dashboard.",
  used: "❌ Link penghubung sudah pernah dipakai. Buat link baru dari dashboard.",
  telegram_taken:
    "❌ Akun Telegram ini sudah terhubung ke akun BrewCC lain. Putuskan dulu dari akun tersebut.",
  not_approved: "⏳ Akun BrewCC kamu belum disetujui admin.",
};

const back: InlineKeyboard[number] = [
  { text: "🏠 Menu utama", callback_data: "m" },
];
const cancelRow: InlineKeyboard[number] = [
  { text: "✖️ Batal", callback_data: "c" },
];

// ───────────────────────────────── entry ─────────────────────────────────

export async function handleUpdate(update: TelegramUpdate) {
  const from = update.message?.from ?? update.callback_query?.from;
  const chatId =
    update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  if (!from || !chatId) return;

  // private chats only: links and analytics must not leak into groups
  const chatType =
    update.message?.chat.type ?? update.callback_query?.message?.chat.type;
  if (chatType !== "private") return;

  const telegramId = String(from.id);

  const { success } = await ratelimit(30, "1 m").limit(
    `telegram:${telegramId}`,
  );
  if (!success) {
    if (update.callback_query) {
      await answerCallback(
        update.callback_query.id,
        "Terlalu banyak permintaan, tunggu sebentar.",
      );
    }
    return;
  }

  // account linking: /start <token>
  const text = update.message?.text?.trim() ?? "";
  const startToken = text.match(/^\/start\s+(\S+)$/)?.[1];
  if (startToken) {
    const result = await redeemTelegramLinkToken({
      token: startToken,
      telegramId,
      telegramUsername: from.username,
    });
    if (!result.ok) {
      await sendMessage(chatId, LINK_ERRORS[result.reason]);
      return;
    }
    await clearFlow(telegramId);
    await sendMessage(
      chatId,
      "✅ Telegram berhasil terhubung ke akun BrewCC kamu.",
    );
  }

  // every update is re-authorized: linked + currently approved
  const resolved = await resolveBotUser(telegramId);
  if (!resolved.ok) {
    if (update.callback_query) await answerCallback(update.callback_query.id);
    await sendMessage(chatId, STATUS_MESSAGES[resolved.reason]);
    return;
  }

  const ctx: Ctx = { telegramId, chatId, user: resolved.user };

  try {
    if (update.callback_query) {
      await onCallback(ctx, update.callback_query);
    } else if (update.message) {
      await onMessage(ctx, update.message, Boolean(startToken));
    }
  } catch (error) {
    // DubApiError messages are user-facing validation messages; anything else stays generic
    const message =
      error instanceof DubApiError
        ? `⚠️ ${esc(error.message)}`
        : "⚠️ Terjadi kesalahan. Coba lagi beberapa saat lagi.";
    if (!(error instanceof DubApiError))
      console.error("[telegram] handler error", error);
    if (update.callback_query) await answerCallback(update.callback_query.id);
    await sendMessage(chatId, message, [back]);
  }
}

// ───────────────────────────── workspace context ─────────────────────────────

async function requireWorkspace(ctx: Ctx, permission: PermissionAction) {
  const workspaces = await getUserWorkspaces(ctx.user.id);
  if (workspaces.length === 0) {
    throw new DubApiError({
      code: "not_found",
      message:
        "Kamu belum punya workspace. Buat workspace dulu di dashboard BrewCC.",
    });
  }

  let workspaceId = await getSelectedWorkspace(ctx.telegramId);
  if (!workspaceId || !workspaces.some((w) => w.id === workspaceId)) {
    workspaceId = workspaces[0].id;
    await setSelectedWorkspace(ctx.telegramId, workspaceId);
  }

  const loaded = await loadWorkspace(ctx.user.id, workspaceId);
  if (!loaded) {
    throw new DubApiError({
      code: "not_found",
      message: "Workspace tidak ditemukan.",
    });
  }
  if (!can(loaded.permissions, permission)) {
    throw new DubApiError({
      code: "forbidden",
      message: "Peranmu di workspace ini tidak mengizinkan tindakan tersebut.",
    });
  }
  return { ...loaded, workspaces };
}

// ───────────────────────────────── screens ─────────────────────────────────

async function mainMenu(ctx: Ctx): Promise<Reply> {
  const { workspace, workspaces } = await requireWorkspace(ctx, "links.read");
  return {
    text: `👋 Halo <b>${esc(ctx.user.name || ctx.user.email)}</b>\nWorkspace: <b>${esc(workspace.name)}</b>\n\nPilih menu:`,
    keyboard: [
      [
        { text: "📋 List Shortlink", callback_data: "l:1" },
        { text: "➕ Add Shortlink", callback_data: "n" },
      ],
      [
        { text: "✏️ Edit Shortlink", callback_data: "l:1" },
        { text: "🗑 Delete Shortlink", callback_data: "l:1" },
      ],
      [{ text: "📊 Tracking & Analytics", callback_data: "a" }],
      [{ text: "🔁 Bulk Domain Changer", callback_data: "bd" }],
      [
        ...(workspaces.length > 1
          ? [{ text: "🔁 Ganti workspace", callback_data: "ws" }]
          : []),
        { text: "🔄 Refresh", callback_data: "m" },
      ],
    ],
  };
}

async function workspacePicker(ctx: Ctx): Promise<Reply> {
  const workspaces = await getUserWorkspaces(ctx.user.id);
  return {
    text: "Pilih workspace:",
    keyboard: [
      ...workspaces.map((w) => [{ text: w.name, callback_data: `ws:${w.id}` }]),
      back,
    ],
  };
}

async function listScreen(ctx: Ctx, page: number): Promise<Reply> {
  const { workspace } = await requireWorkspace(ctx, "links.read");
  const filter = await getListFilter(ctx.telegramId);
  const { links, hasNext } = await listLinks({
    workspace,
    userId: ctx.user.id,
    page,
    ...filter,
  });

  const filterLine = [
    filter.search && `🔎 "${esc(filter.search)}"`,
    filter.domain && `🌐 ${esc(filter.domain)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const lines = links.map((link, i) => {
    const n = (page - 1) * LINKS_PAGE_SIZE + i + 1;
    return `<b>${n}. ${esc(shortLinkOf(link))}</b>${link.archived ? " (archived)" : ""}\n→ ${esc(truncate(link.url || "—"))}\n👆 ${formatCount(link.clicks)} klik`;
  });

  return {
    text: `📋 <b>Shortlink</b> (halaman ${page})${filterLine ? `\n${filterLine}` : ""}\n\n${lines.join("\n\n") || "Belum ada shortlink."}`,
    keyboard: [
      ...links.map((link, i) => [
        {
          text: `${(page - 1) * LINKS_PAGE_SIZE + i + 1}. ${truncate(`${link.domain}/${link.key}`, 40)}`,
          callback_data: `d:${link.id}`,
        },
      ]),
      [
        ...(page > 1
          ? [{ text: "⬅️ Prev", callback_data: `l:${page - 1}` }]
          : []),
        ...(hasNext
          ? [{ text: "Next ➡️", callback_data: `l:${page + 1}` }]
          : []),
      ],
      [
        { text: "🔎 Cari slug", callback_data: "lsr" },
        { text: "🌐 Filter domain", callback_data: "ldm" },
        ...(filterLine ? [{ text: "🧹 Reset", callback_data: "lclr" }] : []),
      ],
      back,
    ].filter((row) => row.length > 0),
  };
}

async function detailScreen(ctx: Ctx, linkId: string): Promise<Reply> {
  const { workspace } = await requireWorkspace(ctx, "links.read");
  const link = await getOwnedLink({ workspace, userId: ctx.user.id, linkId });
  return {
    text: [
      `🔗 <b>${esc(shortLinkOf(link))}</b>`,
      `Tujuan: ${esc(link.url || "—")}`,
      `Domain: ${esc(link.domain)}`,
      `Slug: ${esc(link.key)}`,
      link.title ? `Judul: ${esc(link.title)}` : null,
      `Klik: ${formatCount(link.clicks)}`,
      `Status: ${link.archived ? "archived" : link.disabledAt ? "disabled" : "aktif"}`,
    ]
      .filter(Boolean)
      .join("\n"),
    keyboard: [
      [
        { text: "✏️ Edit", callback_data: `e:${link.id}` },
        { text: "🗑 Delete", callback_data: `x:${link.id}` },
      ],
      [{ text: "📊 Analytics", callback_data: `as:${link.id}` }],
      [{ text: "⬅️ Kembali ke list", callback_data: "l:1" }],
      back,
    ],
  };
}

async function domainButtons(ctx: Ctx, prefix: string) {
  const { workspace } = await requireWorkspace(ctx, "links.read");
  const domains = await getAvailableDomains(workspace);
  return {
    domains,
    rows: domains
      .slice(0, 30)
      .map((d, i) => [{ text: d, callback_data: `${prefix}:${i}` }]),
  };
}

function analyticsText(title: string, summary: Record<string, number>) {
  return `📊 <b>${title}</b>\n\n${Object.entries(RANGE_LABELS)
    .map(
      ([range, label]) =>
        `${label}: <b>${formatCount(summary[range] ?? 0)}</b>`,
    )
    .join("\n")}`;
}

function breakdownText(title: string, rows: Breakdown) {
  return `<b>${title}</b>\n${
    rows.length
      ? rows
          .map(
            (row, i) =>
              `${i + 1}. ${esc(row.label)}: <b>${formatCount(row.clicks)}</b>`,
          )
          .join("\n")
      : "Belum ada data."
  }`;
}

async function analyticsReply(
  title: string,
  args: Parameters<typeof getClicksSummary>[0],
) {
  const [summary, regions, devices] = await Promise.all([
    getClicksSummary(args),
    getBreakdown({ ...args, groupBy: "regions" }),
    getBreakdown({ ...args, groupBy: "devices" }),
  ]);
  return [
    analyticsText(title, summary),
    breakdownText("📍 Region (30 hari terakhir)", regions),
    breakdownText("📱 Device (30 hari terakhir)", devices),
  ].join("\n\n");
}

async function assertAnalyticsRate(ctx: Ctx) {
  const { success } = await ratelimit(10, "1 m").limit(
    `telegram:analytics:${ctx.telegramId}`,
  );
  if (!success) {
    throw new DubApiError({
      code: "rate_limit_exceeded",
      message: "Terlalu sering membuka analytics. Coba lagi dalam satu menit.",
    });
  }
}

function addPreview(flow: Extract<Flow, { type: "add" }>): Reply {
  return {
    text: [
      "🧾 <b>Preview shortlink baru</b>",
      `Short URL: ${esc(flow.key ? `${flow.domain}/${flow.key}` : `${flow.domain}/(acak)`)}`,
      `Tujuan: ${esc(flow.url)}`,
      flow.title ? `Judul: ${esc(flow.title)}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    keyboard: [
      [
        { text: "✅ Confirm", callback_data: "nc" },
        { text: "✖️ Cancel", callback_data: "c" },
      ],
    ],
  };
}

const FIELD_LABELS = {
  url: "URL tujuan",
  key: "slug",
  domain: "domain",
  title: "judul",
} as const;

// ───────────────────────────────── callbacks ─────────────────────────────────

async function onCallback(ctx: Ctx, query: TelegramCallbackQuery) {
  const data = query.data ?? "";
  const messageId = query.message?.message_id;
  // re-render the message without answering the callback again
  const render = async (reply: Reply) => {
    if (messageId)
      await editMessage(ctx.chatId, messageId, reply.text, reply.keyboard);
    else await sendMessage(ctx.chatId, reply.text, reply.keyboard);
  };
  const show = async (reply: Reply) => {
    await answerCallback(query.id);
    await render(reply);
  };

  const [action, arg1, arg2] = data.split(":");

  switch (action) {
    case "m":
    case "c":
      await clearFlow(ctx.telegramId);
      return show(await mainMenu(ctx));

    case "ws":
      if (arg1) {
        // only accept a workspace the user is a member of
        const workspaces = await getUserWorkspaces(ctx.user.id);
        if (workspaces.some((w) => w.id === arg1)) {
          await setSelectedWorkspace(ctx.telegramId, arg1);
          await setListFilter(ctx.telegramId, {});
        }
        return show(await mainMenu(ctx));
      }
      return show(await workspacePicker(ctx));

    case "l":
      return show(await listScreen(ctx, Math.max(1, Number(arg1) || 1)));

    case "lsr":
      await setFlow(ctx.telegramId, { type: "search" });
      return show({
        text: "🔎 Ketik slug (atau bagian URL) yang ingin dicari:",
        keyboard: [cancelRow],
      });

    case "ldm": {
      const { rows } = await domainButtons(ctx, "ldf");
      return show({
        text: "🌐 Filter berdasarkan domain:",
        keyboard: [...rows, back],
      });
    }

    case "ldf": {
      const { domains } = await domainButtons(ctx, "ldf");
      const domain = domains[Number(arg1)];
      const filter = await getListFilter(ctx.telegramId);
      await setListFilter(ctx.telegramId, { ...filter, domain });
      return show(await listScreen(ctx, 1));
    }

    case "lclr":
      await setListFilter(ctx.telegramId, {});
      return show(await listScreen(ctx, 1));

    case "d":
      return show(await detailScreen(ctx, arg1));

    // ── add ──
    case "n": {
      await requireWorkspace(ctx, "links.write");
      const { rows } = await domainButtons(ctx, "nd");
      await setFlow(ctx.telegramId, { type: "add", step: "domain" });
      return show({
        text: "➕ <b>Shortlink baru</b>\n\n1/4 Pilih domain:",
        keyboard: [...rows, cancelRow],
      });
    }

    case "nd": {
      const flow = await getFlow(ctx.telegramId);
      if (flow?.type !== "add") return show(await mainMenu(ctx));
      const { domains } = await domainButtons(ctx, "nd");
      const domain = domains[Number(arg1)];
      if (!domain) return show(await mainMenu(ctx));
      await setFlow(ctx.telegramId, { ...flow, domain, step: "url" });
      return show({
        text: `Domain: <b>${esc(domain)}</b>\n\n2/4 Kirim <b>URL tujuan</b> (contoh: https://example.com/promo):`,
        keyboard: [cancelRow],
      });
    }

    case "nc": {
      const flow = await getFlow(ctx.telegramId);
      if (
        flow?.type !== "add" ||
        flow.step !== "confirm" ||
        !flow.domain ||
        !flow.url
      ) {
        return show(await mainMenu(ctx));
      }
      const { workspace } = await requireWorkspace(ctx, "links.write");
      const link = await createLinkFromBot({
        workspace,
        userId: ctx.user.id,
        domain: flow.domain,
        url: flow.url,
        key: flow.key,
        title: flow.title,
      });
      await clearFlow(ctx.telegramId);
      return show({
        text: `✅ Shortlink dibuat:\n<b>${esc(shortLinkOf(link))}</b>\n→ ${esc(link.url)}`,
        keyboard: [
          [{ text: "🔗 Detail", callback_data: `d:${link.id}` }],
          back,
        ],
      });
    }

    // ── edit ──
    case "e": {
      const { workspace } = await requireWorkspace(ctx, "links.write");
      const link = await getOwnedLink({
        workspace,
        userId: ctx.user.id,
        linkId: arg1,
      });
      return show({
        text: `✏️ Edit <b>${esc(shortLinkOf(link))}</b>\nPilih yang ingin diubah:`,
        keyboard: [
          [
            { text: "URL tujuan", callback_data: `ef:url:${link.id}` },
            { text: "Slug", callback_data: `ef:key:${link.id}` },
          ],
          [
            { text: "Domain", callback_data: `ef:domain:${link.id}` },
            { text: "Judul", callback_data: `ef:title:${link.id}` },
          ],
          [{ text: "⬅️ Kembali", callback_data: `d:${link.id}` }],
        ],
      });
    }

    case "ef": {
      const field = arg1 as keyof typeof FIELD_LABELS;
      if (!(field in FIELD_LABELS)) return show(await mainMenu(ctx));
      const { workspace } = await requireWorkspace(ctx, "links.write");
      const link = await getOwnedLink({
        workspace,
        userId: ctx.user.id,
        linkId: arg2,
      });
      await setFlow(ctx.telegramId, { type: "edit", linkId: link.id, field });
      if (field === "domain") {
        const { rows } = await domainButtons(ctx, "edd");
        return show({
          text: `Domain sekarang: <b>${esc(link.domain)}</b>\nPilih domain baru:`,
          keyboard: [...rows, cancelRow],
        });
      }
      const current =
        field === "url" ? link.url : field === "key" ? link.key : link.title;
      return show({
        text: `Nilai ${FIELD_LABELS[field]} sekarang:\n<code>${esc(current || "—")}</code>\n\nKirim ${FIELD_LABELS[field]} baru:`,
        keyboard: [cancelRow],
      });
    }

    case "edd": {
      const flow = await getFlow(ctx.telegramId);
      if (flow?.type !== "edit" || flow.field !== "domain")
        return show(await mainMenu(ctx));
      const { domains } = await domainButtons(ctx, "edd");
      const domain = domains[Number(arg1)];
      if (!domain) return show(await mainMenu(ctx));
      return show(await editPreview(ctx, { ...flow, value: domain }));
    }

    case "ec": {
      const flow = await getFlow(ctx.telegramId);
      if (flow?.type !== "edit" || !flow.field || flow.value === undefined) {
        return show(await mainMenu(ctx));
      }
      const { workspace } = await requireWorkspace(ctx, "links.write");
      const link = await updateLinkFromBot({
        workspace,
        userId: ctx.user.id,
        linkId: flow.linkId,
        changes: { [flow.field]: flow.value },
      });
      await clearFlow(ctx.telegramId);
      return show({
        text: `✅ Shortlink diperbarui:\n<b>${esc(shortLinkOf(link))}</b>\n→ ${esc(link.url)}`,
        keyboard: [
          [{ text: "🔗 Detail", callback_data: `d:${link.id}` }],
          back,
        ],
      });
    }

    // ── delete ──
    case "x": {
      const { workspace } = await requireWorkspace(ctx, "links.write");
      const link = await getOwnedLink({
        workspace,
        userId: ctx.user.id,
        linkId: arg1,
      });
      await setFlow(ctx.telegramId, { type: "delete", linkId: link.id });
      return show({
        text: `🗑 Hapus shortlink ini?\n\n<b>${esc(shortLinkOf(link))}</b>\n→ ${esc(link.url)}\n👆 ${formatCount(link.clicks)} klik\n\nTindakan ini tidak bisa dibatalkan.`,
        keyboard: [
          [
            { text: "🗑 Confirm Delete", callback_data: `xy:${link.id}` },
            { text: "✖️ Cancel", callback_data: `d:${link.id}` },
          ],
        ],
      });
    }

    case "xy": {
      // the second step must follow the first for the same link (no one-tap deletes)
      const flow = await getFlow(ctx.telegramId);
      if (flow?.type !== "delete" || flow.linkId !== arg1)
        return show(await mainMenu(ctx));
      const { workspace } = await requireWorkspace(ctx, "links.write");
      const link = await deleteLinkFromBot({
        workspace,
        userId: ctx.user.id,
        linkId: arg1,
      });
      await clearFlow(ctx.telegramId);
      return show({
        text: `✅ <b>${esc(shortLinkOf(link))}</b> dihapus.`,
        keyboard: [[{ text: "📋 List", callback_data: "l:1" }], back],
      });
    }

    // ── analytics ──
    case "a": {
      const { workspace } = await requireWorkspace(ctx, "analytics.read");
      await assertAnalyticsRate(ctx);
      const text = await analyticsReply(
        `Klik workspace ${esc(workspace.name)}`,
        { workspace },
      );
      return show({
        text: `${text}\n\nUntuk analytics per shortlink, buka List → pilih link → Analytics.`,
        keyboard: [
          [{ text: "📋 Pilih shortlink", callback_data: "l:1" }],
          [{ text: "🔄 Refresh", callback_data: "a" }],
          back,
        ],
      });
    }

    case "as": {
      const { workspace } = await requireWorkspace(ctx, "analytics.read");
      const link = await getOwnedLink({
        workspace,
        userId: ctx.user.id,
        linkId: arg1,
      });
      await assertAnalyticsRate(ctx);
      return show({
        text: await analyticsReply(esc(shortLinkOf(link)), {
          workspace,
          linkId: link.id,
        }),
        keyboard: [
          [{ text: "🔄 Refresh", callback_data: `as:${link.id}` }],
          [{ text: "⬅️ Detail", callback_data: `d:${link.id}` }],
          back,
        ],
      });
    }

    // ── bulk domain changer ──
    case "bd": {
      await requireWorkspace(ctx, "links.write");
      await setFlow(ctx.telegramId, { type: "bulk", step: "old" });
      return show({
        text: "🔁 <b>Bulk Domain Changer</b>\nGanti domain tujuan di banyak shortlink sekaligus (hanya link yang kamu buat).\n\n1/2 Kirim <b>domain tujuan lama</b> (contoh: oldsite.com):",
        keyboard: [cancelRow],
      });
    }

    case "bdy": {
      const flow = await getFlow(ctx.telegramId);
      if (
        flow?.type !== "bulk" ||
        flow.step !== "confirm" ||
        !flow.oldDomain ||
        !flow.newDomain
      ) {
        return show(await mainMenu(ctx));
      }
      const { workspace } = await requireWorkspace(ctx, "links.write");
      await assertBulkRate(ctx);
      await clearFlow(ctx.telegramId);
      await show({ text: "⏳ Sedang mengganti domain tujuan…" });

      // re-read now; apply skips any link edited since the preview
      const preview = await previewReplacement({
        workspace,
        userId: ctx.user.id,
        oldDomain: flow.oldDomain,
        newDomain: flow.newDomain,
      });
      if (preview.items.length === 0) {
        return render({
          text: "Tidak ada link yang cocok lagi.",
          keyboard: [back],
        });
      }
      const result = await applyReplacement({
        workspace,
        userId: ctx.user.id,
        oldDomain: flow.oldDomain,
        newDomain: flow.newDomain,
        items: preview.items.map((i) => ({
          linkId: i.linkId,
          expectedUrl: i.oldUrl,
        })),
      });
      return render({
        text: [
          "✅ <b>Selesai</b>",
          `${esc(flow.oldDomain)} → ${esc(flow.newDomain)}`,
          `Diganti: <b>${result.updated}</b>`,
          result.skipped ? `Dilewati: ${result.skipped}` : null,
          result.failed ? `Gagal: ${result.failed}` : null,
          preview.matched > preview.items.length
            ? `\nMasih ada ${preview.matched - preview.items.length} link lagi. Jalankan Bulk Domain Changer sekali lagi.`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
        keyboard: [
          ...(result.updated
            ? [[{ text: "↩️ Undo", callback_data: `bdu:${result.runId}` }]]
            : []),
          back,
        ],
      });
    }

    case "bdu": {
      const { workspace } = await requireWorkspace(ctx, "links.write");
      await assertBulkRate(ctx);
      const result = await undoRun({
        workspace,
        userId: ctx.user.id,
        runId: arg1,
      });
      return show({
        text: [
          "↩️ <b>Undo selesai</b>",
          `Dikembalikan: <b>${result.reverted}</b>`,
          result.skipped
            ? `Dilewati: ${result.skipped} (sudah diubah lagi setelahnya)`
            : null,
          result.failed ? `Gagal: ${result.failed}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        keyboard: [back],
      });
    }

    default:
      return show(await mainMenu(ctx));
  }
}

// same limit as the dashboard's bulk replace
async function assertBulkRate(ctx: Ctx) {
  const { success } = await ratelimit(5, "1 m").limit(
    `bulk-replace:apply:${ctx.user.id}`,
  );
  if (!success) {
    throw new DubApiError({
      code: "rate_limit_exceeded",
      message: "Terlalu banyak penggantian. Tunggu satu menit.",
    });
  }
}

async function bulkPreview(
  ctx: Ctx,
  oldDomain: string,
  newDomain: string,
): Promise<Reply> {
  const { workspace } = await requireWorkspace(ctx, "links.write");
  const preview = await previewReplacement({
    workspace,
    userId: ctx.user.id,
    oldDomain,
    newDomain,
  });

  if (preview.matched === 0) {
    await clearFlow(ctx.telegramId);
    return {
      text: `Tidak ada shortlink milikmu yang tujuannya memakai <b>${esc(oldDomain)}</b> (dicek ${formatCount(preview.checked)} link).`,
      keyboard: [back],
    };
  }

  await setFlow(ctx.telegramId, {
    type: "bulk",
    step: "confirm",
    oldDomain,
    newDomain,
  });

  const count = preview.items.length;
  const warnings = preview.items.filter((i) => i.otherTargetsWarning).length;
  const sample = preview.items
    .slice(0, 5)
    .map(
      (i) =>
        `• <b>${esc(i.shortLink.replace(/^https?:\/\//, ""))}</b>\n  ${esc(truncate(i.oldUrl, 50))}\n  → ${esc(truncate(i.newUrl, 50))}`,
    )
    .join("\n");

  return {
    text: [
      "🧾 <b>Preview Bulk Domain Changer</b>",
      `${esc(oldDomain)} → ${esc(newDomain)}`,
      `Cocok: <b>${formatCount(preview.matched)}</b> dari ${formatCount(preview.checked)} link milikmu`,
      preview.matched > count
        ? `Satu kali proses maksimal ${MAX_LINKS_PER_RUN} link.`
        : null,
      "",
      sample,
      count > 5 ? `…dan ${count - 5} link lainnya` : null,
      warnings
        ? `\n⚠️ ${warnings} link juga punya target iOS/Android/geo/A-B dengan domain lama. Yang diganti hanya URL tujuan utama.`
        : null,
    ]
      .filter((line) => line !== null)
      .join("\n"),
    keyboard: [
      [
        { text: `✅ Ganti ${count} link`, callback_data: "bdy" },
        { text: "✖️ Batal", callback_data: "c" },
      ],
    ],
  };
}

async function editPreview(
  ctx: Ctx,
  flow: Extract<Flow, { type: "edit" }>,
): Promise<Reply> {
  const { workspace } = await requireWorkspace(ctx, "links.write");
  const link = await getOwnedLink({
    workspace,
    userId: ctx.user.id,
    linkId: flow.linkId,
  });
  await setFlow(ctx.telegramId, flow);
  const field = flow.field!;
  const before =
    field === "url"
      ? link.url
      : field === "key"
        ? link.key
        : field === "domain"
          ? link.domain
          : link.title;
  return {
    text: `🧾 <b>Preview perubahan</b> ${esc(shortLinkOf(link))}\n\n${FIELD_LABELS[field]}:\n<s>${esc(before || "—")}</s>\n→ <b>${esc(flow.value)}</b>`,
    keyboard: [
      [
        { text: "✅ Confirm", callback_data: "ec" },
        { text: "✖️ Cancel", callback_data: `d:${link.id}` },
      ],
    ],
  };
}

// ───────────────────────────────── text input ─────────────────────────────────

async function onMessage(
  ctx: Ctx,
  message: TelegramMessage,
  justLinked: boolean,
) {
  const text = (message.text ?? "").trim();
  const reply = (r: Reply) => sendMessage(ctx.chatId, r.text, r.keyboard);

  if (justLinked || text === "/start" || text === "/menu") {
    await clearFlow(ctx.telegramId);
    return reply(await mainMenu(ctx));
  }
  if (text === "/cancel") {
    await clearFlow(ctx.telegramId);
    return reply(await mainMenu(ctx));
  }

  const flow = await getFlow(ctx.telegramId);
  if (!flow || text.length === 0) return reply(await mainMenu(ctx));
  const value = text.slice(0, 2000);

  if (flow.type === "search") {
    await clearFlow(ctx.telegramId);
    const filter = await getListFilter(ctx.telegramId);
    await setListFilter(ctx.telegramId, {
      ...filter,
      search: value.slice(0, 100),
    });
    return reply(await listScreen(ctx, 1));
  }

  if (flow.type === "add") {
    if (flow.step === "url") {
      const url = getUrlFromString(value);
      if (!url || !isValidUrl(url)) {
        return reply({
          text: "❌ URL tidak valid. Kirim URL lengkap, contoh: https://example.com",
          keyboard: [cancelRow],
        });
      }
      await setFlow(ctx.telegramId, { ...flow, url, step: "key" });
      return reply({
        text: "3/4 Kirim <b>custom slug</b> (contoh: promo-november), atau kirim <code>-</code> untuk slug acak:",
        keyboard: [cancelRow],
      });
    }
    if (flow.step === "key") {
      const key = value === "-" ? undefined : value.replace(/^\/+/, "");
      await setFlow(ctx.telegramId, { ...flow, key, step: "title" });
      return reply({
        text: "4/4 Kirim <b>judul</b> (opsional), atau kirim <code>-</code> untuk lewati:",
        keyboard: [cancelRow],
      });
    }
    if (flow.step === "title") {
      const next = {
        ...flow,
        title: value === "-" ? undefined : value.slice(0, 190),
        step: "confirm" as const,
      };
      await setFlow(ctx.telegramId, next);
      return reply(addPreview(next));
    }
    return reply(addPreview(flow));
  }

  if (flow.type === "bulk") {
    const domain = value.slice(0, 300);
    if (flow.step === "old") {
      await setFlow(ctx.telegramId, {
        ...flow,
        oldDomain: domain,
        step: "new",
      });
      return reply({
        text: `Domain lama: <b>${esc(domain)}</b>\n\n2/2 Kirim <b>domain tujuan baru</b> (contoh: newsite.com):`,
        keyboard: [cancelRow],
      });
    }
    if (flow.step === "new" && flow.oldDomain) {
      return reply(await bulkPreview(ctx, flow.oldDomain, domain));
    }
    return reply(await mainMenu(ctx));
  }

  if (flow.type === "edit" && flow.field && flow.field !== "domain") {
    let newValue = value;
    if (flow.field === "url") {
      const url = getUrlFromString(value);
      if (!url || !isValidUrl(url)) {
        return reply({
          text: "❌ URL tidak valid. Kirim URL lengkap, contoh: https://example.com",
          keyboard: [cancelRow],
        });
      }
      newValue = url;
    }
    if (flow.field === "key") newValue = value.replace(/^\/+/, "");
    if (flow.field === "title") newValue = value.slice(0, 190);
    return reply(await editPreview(ctx, { ...flow, value: newValue }));
  }

  return reply(await mainMenu(ctx));
}
