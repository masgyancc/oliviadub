import { DUB_WORKSPACE_ID, IS_DUB_CO, SHORT_DOMAIN } from "./main";

const ALL_DUB_DOMAINS = [
  {
    id: "clce1z7ch00j0rbstbjufva4j",
    slug: SHORT_DOMAIN,
    verified: true,
    primary: true,
    archived: false,
    placeholder: "https://example.com",
    allowedHostnames: [],
    description: "The default domain for all new accounts.",
    projectId: DUB_WORKSPACE_ID,
  },
  {
    id: "clce1z7cs00y8rbstk4xtnj0k",
    slug: "chatg.pt",
    verified: true,
    primary: false,
    archived: false,
    placeholder: "https://chat.openai.com/g/g-UGjKKONEe-domainsgpt",
    allowedHostnames: ["openai.com", "chatgpt.com", "chatgpt.site"],
    description: "Branded domain for ChatGPT links (convos, custom GPTs).",
    projectId: DUB_WORKSPACE_ID,
  },
  {
    id: "cloxw8y2u0003js08a7mqg1j8",
    slug: "spti.fi",
    verified: true,
    primary: false,
    archived: false,
    placeholder: "https://open.spotify.com/album/1SCyi9a5pOasikidToUY5y",
    allowedHostnames: ["spotify.com"],
    description: "Branded domain for Spotify links (songs, playlists, etc.).",
    projectId: DUB_WORKSPACE_ID,
  },
  {
    id: "cltgtd6s5000341itdszz20u2",
    slug: "git.new",
    verified: true,
    primary: false,
    archived: false,
    placeholder: "https://github.com/dubinc/dub",
    allowedHostnames: ["github.com"],
    description: "Branded domain for GitHub links (repositories, gists, etc.).",
    projectId: DUB_WORKSPACE_ID,
  },
  {
    id: "cm23qevp4000412mqwvtkthzw",
    slug: "cal.link",
    verified: true,
    primary: false,
    archived: false,
    placeholder: "https://cal.com/steven",
    allowedHostnames: [
      "app.acuityscheduling.com",
      "app.apollo.io",
      "cal.com",
      "calendly.com",
      "calendar.app.google",
      "calendar.google.com",
      "calendar.notion.so",
      "chilipiper.com",
      "fantastical.app",
      "fillout.com",
      "hubspot.com",
      "mentordeck.com",
      "savvycal.com",
      "scheduler.default.com",
      "tidycal.com",
      "you.ashbyhq.com",
      "zcal.co",
    ],
    description:
      "Branded domain for your scheduling links (Cal.com, Calendly, etc.).",
    projectId: DUB_WORKSPACE_ID,
  },
  {
    id: "cloxw8qtk000bjt08n9b812vs",
    slug: "amzn.id",
    verified: true,
    primary: false,
    archived: false,
    placeholder: "https://www.amazon.com/dp/B0BW4SWNC8",
    allowedHostnames: [
      "amazon.com",
      "amazon.co.uk",
      "amazon.ca",
      "amazon.es",
      "amazon.fr",
    ],
    description: "Branded domain for Amazon links (products, wishlists, etc.).",
    projectId: DUB_WORKSPACE_ID,
  },
  {
    id: "clymd6zkc0001elilr1215tj9",
    slug: "ggl.link",
    verified: true,
    primary: false,
    archived: false,
    placeholder:
      "https://docs.google.com/document/d/15-GOZA12SXGEh8lNwU5QI1jBi04TCPgY2-LChTbXVpA",
    allowedHostnames: [
      "google.com",
      "google.co.uk",
      "google.co.id",
      "google.ca",
      "google.es",
      "google.fr",
      "googleblog.com",
      "blog.google",
      "g.co",
      "g.page",
      "youtube.com",
      "youtu.be",
    ],
    description:
      "Branded domain for Google links (Search, Docs, Sheets, Slides, Drive, Maps, etc.).",
    projectId: DUB_WORKSPACE_ID,
  },
  {
    id: "clymczttm0001jgkore3ltr37",
    slug: "fig.page",
    verified: true,
    primary: false,
    archived: false,
    placeholder:
      "https://www.figma.com/design/YAfTk6SGV2HcSvL2415oED/Dub.co-Brand-Assets-(Public)?node-id=1-36593&t=QMKQNtUzxSSzG3hX-1",
    allowedHostnames: ["figma.com"],
    description:
      "Branded domain for Figma links (portfolios, prototypes, presentations, etc.).",
    projectId: DUB_WORKSPACE_ID,
  },
];

// Self-hosting: shared ("default") short-link domains offered to every
// workspace, from NEXT_PUBLIC_DUB_DEFAULT_DOMAINS (comma-separated, first one
// is primary). Falls back to the single SHORT_DOMAIN. Max 8: each maps to a
// boolean column of the DefaultDomains table (see DEFAULT_DOMAIN_COLUMNS).
const SELF_HOST_DEFAULT_DOMAINS = Array.from(
  new Set(
    [
      SHORT_DOMAIN,
      ...(process.env.NEXT_PUBLIC_DUB_DEFAULT_DOMAINS || "").split(","),
    ]
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ),
).slice(0, 8);

export const DUB_DOMAINS = IS_DUB_CO
  ? ALL_DUB_DOMAINS
  : SELF_HOST_DEFAULT_DOMAINS.map((slug, i) => ({
      id: `default_${slug.replace(/[^a-z0-9]/g, "")}`,
      slug,
      verified: true,
      primary: i === 0,
      archived: false,
      placeholder: "https://example.com",
      allowedHostnames: [] as string[],
      description:
        i === 0
          ? "The default domain for all new accounts."
          : "Shared short-link domain available to every workspace.",
      projectId: DUB_WORKSPACE_ID,
    }));

export const DUB_DOMAINS_ARRAY = DUB_DOMAINS.map((domain) => domain.slug);

// Boolean columns of the DefaultDomains table, in slot order.
export const DEFAULT_DOMAIN_COLUMNS = [
  "dubsh",
  "chatgpt",
  "sptifi",
  "gitnew",
  "callink",
  "amznid",
  "ggllink",
  "figpage",
] as const;

// dub.co: column name is the slug without dots (dub.sh -> dubsh).
// self-hosted: slot i holds the i-th configured default domain.
export const defaultDomainColumnToSlug = (
  column: string,
): string | undefined =>
  IS_DUB_CO
    ? DUB_DOMAINS_ARRAY.find((d) => d.replace(".", "") === column)
    : DUB_DOMAINS_ARRAY[
        DEFAULT_DOMAIN_COLUMNS.indexOf(
          column as (typeof DEFAULT_DOMAIN_COLUMNS)[number],
        )
      ];

export const DUB_DEMO_LINKS = [
  {
    id: "clqo10sum0006js08vutzfxt3",
    domain: "d.to",
    key: "try",
    dashboardId: "dash_Rqy6tVEO5Ib4iVFvmYYTK4kO",
  },
  {
    id: "cltshzzpd0005126z3rd2lvo4",
    domain: "dub.sh",
    key: "try",
    dashboardId: "dash_bUNOfMQVcKS0VMDa2HaYhOjg",
  },
  {
    id: "clot0z5rg000djp08ue98hxkn",
    domain: "chatg.pt",
    key: "domains",
    dashboardId: "dash_lX4or5Yj6ZrPk3qW4SwgrQ5t",
  },
  {
    id: "clp4jh9av0001l308ormavtlu",
    domain: "spti.fi",
    key: "hans",
    dashboardId: "dash_v2Ygwn3hZNYx6kFYfBT4IApM",
  },
  {
    id: "cltgtsex40003ck8z444hum5u",
    domain: "git.new",
    key: "dub",
    dashboardId: "dash_FX5HKOKhtQ6uoIeSDxWM8eIb",
  },
  {
    id: "clymd5vqj0005jgkorsopklsk",
    domain: "fig.page",
    key: "dub",
    dashboardId: "dash_no9BFlfSjHDG6K7XIAuwLt5p",
  },
  {
    id: "clp3k3yoi0001ju0874nz899q",
    domain: "amzn.id",
    key: "tv",
    dashboardId: "dash_fKwai9V9nsLcC0IaY0rTF1yA",
  },
  {
    id: "clymd73o50001ulmzzxjumr8l",
    domain: "ggl.link",
    key: "dub",
    dashboardId: "dash_rx5c7pQPnx2MUCX3cL4t1Zpn",
  },
  {
    id: "cm24785ki0001ainw2qks4uq5",
    domain: "cal.link",
    key: "demo",
    dashboardId: "dash_zbzP2UVvTrv5SkIEPP2pV5pC",
  },
];
