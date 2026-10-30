import { prisma } from "@/lib/prisma";
import {
  API_DOMAIN,
  APP_DOMAIN,
  DUB_DOMAINS_ARRAY,
  SHORT_DOMAIN,
  getApexDomain,
  getDomainWithoutWWW,
} from "@dub/utils";
import { DubApiError } from "../errors";
import { isValidDomain, isValidDomainFormat } from "./is-valid-domain";
import { validateDubLinkSubdomain } from "./validate-dub-link-subdomain";

export const validateDomain = async (
  domain: string,
): Promise<{ error: string | null; code?: DubApiError["code"] }> => {
  if (!domain || typeof domain !== "string") {
    return { error: "Missing domain", code: "unprocessable_entity" };
  }
  if (!isValidDomain(domain)) {
    return { error: "Invalid domain", code: "unprocessable_entity" };
  }
  if (domain.startsWith("www.")) {
    return {
      error: "Custom domain cannot start with www.",
      code: "unprocessable_entity",
    };
  }
  if (isPlatformDomain(domain)) {
    return {
      error: "This domain belongs to the BrewCC platform and cannot be added.",
      code: "forbidden",
    };
  }
  const dubLinkError = validateDubLinkSubdomain(domain);
  if (dubLinkError) {
    return dubLinkError;
  }
  const exists = await domainExists(domain);
  if (exists) {
    return { error: "Domain is already in use.", code: "conflict" };
  }
  return { error: null };
};

// BrewCC: platform hostnames (app/API/short/shared default domains and their subdomains,
// plus Vercel-owned hostnames) can never be claimed as a user's custom domain
const PLATFORM_DOMAINS = [
  getDomainWithoutWWW(APP_DOMAIN),
  getDomainWithoutWWW(API_DOMAIN),
  SHORT_DOMAIN,
  ...DUB_DOMAINS_ARRAY,
  "vercel.app",
  "vercel-dns.com",
  "vercel.com",
]
  .filter((d): d is string => Boolean(d))
  .map((d) => getApexDomain(`https://${d}`) || d);

export const isPlatformDomain = (domain: string) => {
  const d = domain.toLowerCase();
  return PLATFORM_DOMAINS.some((p) => d === p || d.endsWith(`.${p}`));
};

// Subdomain checks request `*.apex`, which we build from the apex hostname.
export function assertValidDomainFormat(domain: string) {
  const hostname =
    typeof domain === "string" && domain.startsWith("*.")
      ? domain.slice(2)
      : domain;
  if (typeof hostname !== "string" || !isValidDomainFormat(hostname)) {
    throw new DubApiError({
      code: "unprocessable_entity",
      message: "Invalid domain",
    });
  }
}

export const domainExists = async (domain: string) => {
  const response = await prisma.domain.findFirst({
    where: {
      slug: domain,
    },
    select: {
      slug: true,
    },
  });
  return !!response;
};

export interface CustomResponse extends Response {
  json: () => Promise<any>;
  error?: { code: string; projectId: string; message: string };
}

// special case for domains that use a reverse proxy in front of Dub (not recommended)
export const isProxiedDomain = (domain: string) => {
  return ["go.zillow.com"].includes(domain);
};
