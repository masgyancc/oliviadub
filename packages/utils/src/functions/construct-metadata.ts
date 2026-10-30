import { Metadata } from "next";
import { APP_DOMAIN } from "../constants/main";

// BrewCC brand assets live in apps/web/public/brand and are served from the app domain
const BRAND_ASSETS = `${APP_DOMAIN}/brand`;

export function constructMetadata({
  title,
  fullTitle,
  description = "BrewCC is a modern link management platform for short links, custom domains and click analytics.",
  image = `${BRAND_ASSETS}/og.png`,
  video,
  icons = [
    {
      rel: "apple-touch-icon",
      sizes: "180x180",
      url: `${BRAND_ASSETS}/apple-touch-icon.png`,
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "32x32",
      url: `${BRAND_ASSETS}/favicon-32x32.png`,
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "16x16",
      url: `${BRAND_ASSETS}/favicon-16x16.png`,
    },
  ],
  url,
  canonicalUrl,
  noIndex = false,
  manifest,
}: {
  title?: string;
  fullTitle?: string;
  description?: string;
  image?: string | null;
  video?: string | null;
  icons?: Metadata["icons"];
  url?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  manifest?: string | URL | null;
} = {}): Metadata {
  return {
    title:
      fullTitle ||
      (title ? `${title} | BrewCC` : "BrewCC - Short Links & Custom Domains"),
    description,
    openGraph: {
      title,
      description,
      siteName: "BrewCC",
      ...(image && {
        images: image,
      }),
      url,
      ...(video && {
        videos: video,
      }),
    },
    twitter: {
      title,
      description,
      ...(image && {
        card: "summary_large_image",
        images: [image],
      }),
      ...(video && {
        player: video,
      }),
    },
    icons,
    metadataBase: new URL(APP_DOMAIN),
    ...((url || canonicalUrl) && {
      alternates: {
        canonical: url || canonicalUrl,
      },
    }),
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
    ...(manifest && {
      manifest,
    }),
  };
}
