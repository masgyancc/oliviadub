import { TrackingAdapter, TrackingTag } from "../types";

// Google Ads Tag. The Conversion ID (AW-123456789) identifies the account tag; the
// Conversion Label identifies one conversion action. They are stored separately:
//   ID only        → gtag('config', 'AW-…')                                 (remarketing / page view)
//   ID + label     → also gtag('event', 'conversion', { send_to: 'AW-…/label' })
// https://support.google.com/google-ads/answer/6095821
const CONVERSION_ID = /^AW-\d{9,11}$/;
const CONVERSION_LABEL = /^[A-Za-z0-9_-]{6,40}$/;

const normalizeId = (raw: string) => {
  const id = raw.trim().toUpperCase();
  return /^\d{9,11}$/.test(id) ? `AW-${id}` : id;
};

export const googleAdsAdapter: TrackingAdapter = {
  platform: "google_ads",
  label: "Google Ads",

  validate({ pixelId, conversionLabel = "" }) {
    const id = normalizeId(pixelId);
    if (!CONVERSION_ID.test(id)) {
      return {
        ok: false,
        error: "Google Ads Conversion ID must look like AW-123456789.",
      };
    }
    const label = conversionLabel.trim();
    if (label && !CONVERSION_LABEL.test(label)) {
      return {
        ok: false,
        error:
          "Conversion Label must be 6–40 letters, digits, '-' or '_' (e.g. AbC-D_efG-h12_34-567).",
      };
    }
    return { ok: true, value: { pixelId: id, conversionLabel: label } };
  },

  parseFullCode(code) {
    const tags = new Map<string, TrackingTag>();
    // send_to: 'AW-123456789/AbC-D_efG' (event snippet) → id + label
    for (const m of code.matchAll(/AW-(\d{9,11})\/([A-Za-z0-9_-]{6,40})/g)) {
      const tag = { pixelId: `AW-${m[1]}`, conversionLabel: m[2] };
      tags.set(`${tag.pixelId}/${tag.conversionLabel}`, tag);
    }
    // gtag('config', 'AW-123456789') or gtag/js?id=AW-123456789 (global site tag) → id only
    for (const m of code.matchAll(/AW-(\d{9,11})(?![\d/])/g)) {
      const id = `AW-${m[1]}`;
      const hasLabel = [...tags.values()].some((t) => t.pixelId === id);
      if (!hasLabel) tags.set(id, { pixelId: id, conversionLabel: "" });
    }
    return [...tags.values()];
  },

  render(tags: TrackingTag[]) {
    const ids = [...new Set(tags.map((t) => t.pixelId))];
    return {
      src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids[0])}`,
      init: [
        "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());",
        ...ids.map((id) => `gtag('config',${JSON.stringify(id)});`),
        ...tags
          .filter((t) => t.conversionLabel)
          .map(
            (t) =>
              `gtag('event','conversion',{send_to:${JSON.stringify(`${t.pixelId}/${t.conversionLabel}`)}});`,
          ),
      ].join(""),
    };
  },
};
