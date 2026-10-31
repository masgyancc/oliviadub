import { TrackingAdapter, TrackingTag } from "../types";

// Meta Pixel (Facebook & Instagram Ads): numeric pixel id, PageView on load.
// https://developers.facebook.com/docs/meta-pixel/get-started
const PIXEL_ID = /^\d{15,16}$/;

export const metaAdapter: TrackingAdapter = {
  platform: "meta",
  label: "Meta Pixel",

  validate({ pixelId }) {
    const id = pixelId.trim();
    if (!PIXEL_ID.test(id)) {
      return {
        ok: false,
        error: "Meta Pixel ID must be 15–16 digits (e.g. 123456789012345).",
      };
    }
    return { ok: true, value: { pixelId: id, conversionLabel: "" } };
  },

  parseFullCode(code) {
    const ids = new Set<string>();
    for (const m of code.matchAll(
      /fbq\(\s*['"]init['"]\s*,\s*['"](\d{15,16})['"]/g,
    )) {
      ids.add(m[1]);
    }
    // <noscript><img src="https://www.facebook.com/tr?id=...&ev=PageView">
    for (const m of code.matchAll(/facebook\.com\/tr\?id=(\d{15,16})/g)) {
      ids.add(m[1]);
    }
    return [...ids].map((pixelId) => ({ pixelId, conversionLabel: "" }));
  },

  render(tags: TrackingTag[]) {
    return {
      src: "https://connect.facebook.net/en_US/fbevents.js",
      init: [
        "!function(f){if(f.fbq)return;var n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[]}(window);",
        ...tags.map((t) => `fbq('init',${JSON.stringify(t.pixelId)});`),
        "fbq('track','PageView');",
      ].join(""),
    };
  },
};
