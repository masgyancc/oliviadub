import { TrackingAdapter, TrackingTag } from "../types";

// TikTok Pixel: 20-character uppercase alphanumeric pixel code, page() on load.
// https://ads.tiktok.com/help/article/standard-mode-tiktok-pixel
const PIXEL_ID = /^[A-Z0-9]{20}$/;

export const tiktokAdapter: TrackingAdapter = {
  platform: "tiktok",
  label: "TikTok Pixel",

  validate({ pixelId }) {
    const id = pixelId.trim().toUpperCase();
    if (!PIXEL_ID.test(id)) {
      return {
        ok: false,
        error:
          "TikTok Pixel ID must be 20 letters/digits (e.g. C4ABCDEFGHIJ1234567K).",
      };
    }
    return { ok: true, value: { pixelId: id, conversionLabel: "" } };
  },

  parseFullCode(code) {
    const ids = new Set<string>();
    for (const m of code.matchAll(/ttq\.load\(\s*['"]([A-Za-z0-9]{20})['"]/g)) {
      ids.add(m[1].toUpperCase());
    }
    for (const m of code.matchAll(/[?&]sdkid=([A-Za-z0-9]{20})/g)) {
      ids.add(m[1].toUpperCase());
    }
    return [...ids].map((pixelId) => ({ pixelId, conversionLabel: "" }));
  },

  render(tags: TrackingTag[]) {
    // queue stub from TikTok's base code; the loader script is added by the page
    return {
      src: "https://analytics.tiktok.com/i18n/pixel/events.js",
      init: [
        "!function(w){var t=w.ttq=w.ttq||[];t.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];t.setAndDefer=function(o,m){o[m]=function(){o.push([m].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<t.methods.length;i++)t.setAndDefer(t,t.methods[i]);t.instance=function(id){for(var e=t._i[id]||[],n=0;n<t.methods.length;n++)t.setAndDefer(e,t.methods[n]);return e};t.load=function(id,o){t._i=t._i||{};t._i[id]=[];t._i[id]._u='https://analytics.tiktok.com/i18n/pixel/events.js';t._t=t._t||{};t._t[id]=+new Date;t._o=t._o||{};t._o[id]=o||{}}}(window);",
        // official base-code order: load every pixel, then one page() for all of them
        ...tags.map((t) => `ttq.load(${JSON.stringify(t.pixelId)});`),
        "ttq.page();",
      ].join(""),
    };
  },
};
