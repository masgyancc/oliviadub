import { TRACKING_ADAPTERS } from "@/lib/ads-tracking/adapters";
import { getActiveTrackingTags } from "@/lib/ads-tracking/cache";
import { TrackingPlatform } from "@/lib/ads-tracking/types";
import { constructMetadata } from "@dub/utils";
import { notFound } from "next/navigation";

// BrewCC Ads Tracking interstitial. Only reachable through the link middleware's internal
// rewrite (every public path on a short-link domain is resolved as a link first).
// Fires the configured ad tags, then redirects to the link's final URL.

export const dynamic = "force-dynamic";

export const metadata = constructMetadata({
  title: "Redirecting…",
  noIndex: true,
});

const REDIRECT_DELAY_MS = 1200;

// JSON for an inline <script>: escape "<" so a URL can never close the script tag
const inlineJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

export default async function AdsTrackingPage(props: {
  params: Promise<{ workspaceId: string; linkId: string; url: string }>;
}) {
  const { workspaceId, linkId, url } = await props.params;

  let destination: URL;
  try {
    destination = new URL(decodeURIComponent(url));
  } catch {
    notFound();
  }
  if (!["http:", "https:"].includes(destination.protocol)) {
    notFound();
  }
  const href = destination.toString();

  const tags = await getActiveTrackingTags({ linkId, workspaceId });

  const byPlatform = new Map<TrackingPlatform, typeof tags>();
  for (const tag of tags) {
    byPlatform.set(tag.platform, [
      ...(byPlatform.get(tag.platform) ?? []),
      tag,
    ]);
  }

  // re-validate before rendering: only ids that pass the platform validator reach the page
  const rendered = [...byPlatform.entries()]
    .map(([platform, platformTags]) => {
      const adapter = TRACKING_ADAPTERS[platform];
      const valid = platformTags.flatMap((t) => {
        const result = adapter.validate(t);
        return result.ok ? [result.value] : [];
      });
      return valid.length ? adapter.render(valid) : null;
    })
    .filter((r): r is { src: string; init: string } => r !== null);

  return (
    <>
      {/* fallback if JavaScript is blocked or slow */}
      <meta httpEquiv="refresh" content={`3; url=${href}`} />
      {rendered.map(({ init }, i) => (
        <script key={`init-${i}`} dangerouslySetInnerHTML={{ __html: init }} />
      ))}
      {rendered.map(({ src }, i) => (
        <script key={`src-${i}`} async src={src} />
      ))}
      <script
        dangerouslySetInnerHTML={{
          __html: `setTimeout(function(){window.location.replace(${inlineJson(href)})},${REDIRECT_DELAY_MS});`,
        }}
      />
      <main
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#525252",
        }}
      >
        <p>
          Redirecting… <a href={href}>Continue</a>
        </p>
      </main>
    </>
  );
}
