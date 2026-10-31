import { googleAdsAdapter } from "@/lib/ads-tracking/adapters/google-ads";
import { metaAdapter } from "@/lib/ads-tracking/adapters/meta";
import { tiktokAdapter } from "@/lib/ads-tracking/adapters/tiktok";
import { describe, expect, test } from "vitest";

describe("meta adapter", () => {
  test("validates manual ids", () => {
    expect(metaAdapter.validate({ pixelId: " 123456789012345 " })).toEqual({
      ok: true,
      value: { pixelId: "123456789012345", conversionLabel: "" },
    });
    expect(metaAdapter.validate({ pixelId: "12345" }).ok).toBe(false);
    expect(metaAdapter.validate({ pixelId: "123');alert(1)//" }).ok).toBe(
      false,
    );
  });

  test("extracts ids from the official snippet", () => {
    const code = `<script>!function(f,b,e,v,n,t,s){...}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1234567890123456');
fbq('track', 'PageView');</script>
<noscript><img height="1" width="1" src="https://www.facebook.com/tr?id=1234567890123456&ev=PageView&noscript=1"/></noscript>`;
    expect(metaAdapter.parseFullCode(code)).toEqual([
      { pixelId: "1234567890123456", conversionLabel: "" },
    ]);
  });

  test("renders only validated ids", () => {
    const { src, init } = metaAdapter.render([
      { pixelId: "123456789012345", conversionLabel: "" },
    ]);
    expect(src).toBe("https://connect.facebook.net/en_US/fbevents.js");
    expect(init).toContain(`fbq('init',"123456789012345");`);
    expect(init).toContain("fbq('track','PageView');");
  });
});

describe("tiktok adapter", () => {
  test("validates and normalizes", () => {
    expect(tiktokAdapter.validate({ pixelId: "c4abcdefghij1234567k" })).toEqual(
      {
        ok: true,
        value: { pixelId: "C4ABCDEFGHIJ1234567K", conversionLabel: "" },
      },
    );
    expect(tiktokAdapter.validate({ pixelId: "C4ABC" }).ok).toBe(false);
  });

  test("extracts ids from the official snippet", () => {
    const code = `<script>!function (w, d, t) { w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[]; ...
  ttq.load('C4ABCDEFGHIJ1234567K');
  ttq.page();
}(window, document, 'ttq');</script>`;
    expect(tiktokAdapter.parseFullCode(code)).toEqual([
      { pixelId: "C4ABCDEFGHIJ1234567K", conversionLabel: "" },
    ]);
  });
});

describe("google ads adapter", () => {
  test("keeps conversion id and label separate", () => {
    expect(
      googleAdsAdapter.validate({
        pixelId: "123456789",
        conversionLabel: "AbC-D_efG-h12",
      }),
    ).toEqual({
      ok: true,
      value: { pixelId: "AW-123456789", conversionLabel: "AbC-D_efG-h12" },
    });
    expect(googleAdsAdapter.validate({ pixelId: "G-ABC123" }).ok).toBe(false);
    expect(
      googleAdsAdapter.validate({
        pixelId: "AW-123456789",
        conversionLabel: "bad label'",
      }).ok,
    ).toBe(false);
  });

  test("extracts id-only and id+label tags from snippets", () => {
    const globalTag = `<script async src="https://www.googletagmanager.com/gtag/js?id=AW-111111111"></script>
<script>window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'AW-111111111');</script>`;
    expect(googleAdsAdapter.parseFullCode(globalTag)).toEqual([
      { pixelId: "AW-111111111", conversionLabel: "" },
    ]);

    const eventSnippet = `<script>gtag('event', 'conversion', {'send_to': 'AW-222222222/AbCdEfGhIj-kl'});</script>`;
    expect(googleAdsAdapter.parseFullCode(eventSnippet)).toEqual([
      { pixelId: "AW-222222222", conversionLabel: "AbCdEfGhIj-kl" },
    ]);
  });

  test("renders config and conversion events", () => {
    const { src, init } = googleAdsAdapter.render([
      { pixelId: "AW-222222222", conversionLabel: "AbCdEfGhIj-kl" },
    ]);
    expect(src).toBe(
      "https://www.googletagmanager.com/gtag/js?id=AW-222222222",
    );
    expect(init).toContain(`gtag('config',"AW-222222222");`);
    expect(init).toContain(`send_to:"AW-222222222/AbCdEfGhIj-kl"`);
  });
});
