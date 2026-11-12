import type { TrackingPlatform } from "@prisma/client";

export type { TrackingPlatform };

// A validated tag. conversionLabel is "" for platforms/tags without one.
export interface TrackingTag {
  pixelId: string;
  conversionLabel: string;
}

export type ValidationResult =
  | { ok: true; value: TrackingTag }
  | { ok: false; error: string };

export interface TrackingAdapter {
  platform: TrackingPlatform;
  label: string;
  // validate a manually entered id (and label, for Google Ads)
  validate(input: {
    pixelId: string;
    conversionLabel?: string;
  }): ValidationResult;
  // extract ids from the official snippet a user pasted; the snippet itself is never stored or run
  parseFullCode(code: string): TrackingTag[];
  // loader URL (if the platform needs one) + init/event code built only from validated ids.
  // The code runs on the redirect page and reports the link's destination URL, which the
  // page provides as the global `__brewDest`, instead of the short link.
  render(tags: TrackingTag[]): { src?: string; init: string };
}
