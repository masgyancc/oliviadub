// Minimal Telegram Bot API client (https://core.telegram.org/bots/api). No SDK dependency.

export type InlineKeyboard = {
  text: string;
  callback_data?: string;
  url?: string;
}[][];

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string; title?: string };
  from?: TelegramUser;
  text?: string;
  // a group upgraded to a supergroup gets a new chat id
  migrate_to_chat_id?: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

async function call<T = unknown>(
  method: string,
  body: Record<string, unknown>,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Telegram bot is not configured.");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => null)) as {
    ok: boolean;
    result?: T;
    description?: string;
  } | null;

  if (!json?.ok) {
    // never include the request URL (it contains the bot token)
    console.error(
      `[telegram] ${method} failed: ${json?.description ?? res.status}`,
    );
  }
  return json?.result;
}

const replyMarkup = (keyboard?: InlineKeyboard) =>
  keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {};

export const sendMessage = (
  chatId: number,
  text: string,
  keyboard?: InlineKeyboard,
) =>
  call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...replyMarkup(keyboard),
  });

// Opens the reply box for the mentioned / replied-to member only (selective). In groups with
// privacy mode on, the bot only receives replies to its own messages, so text prompts use this.
export const sendForceReply = (
  chatId: number,
  text: string,
  {
    replyToMessageId,
    placeholder,
  }: { replyToMessageId?: number; placeholder?: string } = {},
) =>
  call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(replyToMessageId && {
      reply_parameters: {
        message_id: replyToMessageId,
        allow_sending_without_reply: true,
      },
    }),
    reply_markup: {
      force_reply: true,
      selective: true,
      ...(placeholder && { input_field_placeholder: placeholder }),
    },
  });

export const editMessage = (
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
) =>
  call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...replyMarkup(keyboard),
  });

export const answerCallback = (callbackQueryId: string, text?: string) =>
  call("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text && { text }),
  });
