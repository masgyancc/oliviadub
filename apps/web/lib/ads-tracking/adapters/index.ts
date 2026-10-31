import { TrackingAdapter, TrackingPlatform } from "../types";
import { googleAdsAdapter } from "./google-ads";
import { metaAdapter } from "./meta";
import { tiktokAdapter } from "./tiktok";

export const TRACKING_ADAPTERS: Record<TrackingPlatform, TrackingAdapter> = {
  meta: metaAdapter,
  tiktok: tiktokAdapter,
  google_ads: googleAdsAdapter,
};

export const TRACKING_PLATFORMS = Object.keys(
  TRACKING_ADAPTERS,
) as TrackingPlatform[];
