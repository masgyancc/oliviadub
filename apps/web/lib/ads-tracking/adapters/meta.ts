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

  // PageView sent as Meta's pixel request with the destination as the page URL (dl), the
  // same request the AMP integration sends: Events Manager shows the landing page, not the
  // short link. fbclid from the ad click is passed on as fbc for attribution.
  render(tags: TrackingTag[]) {
    const ids = JSON.stringify([...new Set(tags.map((t) => t.pixelId))]);
    return {
      init:
        "(function(dest){var e=encodeURIComponent,now=Date.now(),ref=document.referrer||''," +
        "m=location.search.match(/[?&]fbclid=([^&#]+)/)," +
        "fbc=m?'fb.1.'+now+'.'+decodeURIComponent(m[1]):'';" +
        `${ids}.forEach(function(id){var img=new Image();img.referrerPolicy='no-referrer';` +
        "img.src='https://www.facebook.com/tr/?id='+id+'&ev=PageView&dl='+e(dest)+'&rl='+e(ref)" +
        "+'&if=false&ts='+now+(fbc?'&fbc='+e(fbc):'');});})(window.__brewDest);",
    };
  },
};
