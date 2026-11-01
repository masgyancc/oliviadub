import useDomains from "@/lib/swr/use-domains";
import useWorkspace from "@/lib/swr/use-workspace";
import { DomainProps } from "@/lib/types";
import { fetcher } from "@dub/utils";
import { useMemo } from "react";
import useSWR from "swr";

// Sort domains alphabetically, with a specific domain prioritized
const sortDomains = (domains: any[], prioritySlug?: string) => {
  return domains.sort((a, b) => {
    if (prioritySlug) {
      if (a.slug === prioritySlug && b.slug !== prioritySlug) return -1;
      if (a.slug !== prioritySlug && b.slug === prioritySlug) return 1;
    }
    // Sort by primary status first, then alphabetically
    if (a.primary && !b.primary) return -1;
    if (!a.primary && b.primary) return 1;
    return a.slug.localeCompare(b.slug);
  });
};

/**
 * BrewCC: short links are only created on verified custom domains (the workspace's own
 * plus the shared pool). The default domains (lilac-orbit.com, brewcc.online) are never
 * offered; an existing link keeps its current domain selectable while it's edited.
 *
 * @param {string} [options.currentDomain] The current domain of a link being updated
 * @param {boolean} [options.onboarding] Onboarding: no workspace domains yet, so only shared ones
 * @returns {Array} An array of available domains for creating or updating a link.
 */
export function useAvailableDomains(
  options: {
    currentDomain?: string;
    onboarding?: boolean;
    search?: string;
  } = {},
) {
  const { currentDomain } = options;

  const { activeWorkspaceDomains, allDomains, allWorkspaceDomains, loading } =
    useDomains({
      ignoreParams: true,
      opts: options.search ? { search: options.search } : undefined,
    });

  // BrewCC: verified custom domains contributed by other workspaces
  const { id: workspaceId } = useWorkspace();
  const { data: sharedData, error: sharedError } = useSWR<DomainProps[]>(
    workspaceId ? `/api/domains/shared?workspaceId=${workspaceId}` : null,
    fetcher,
    { dedupingInterval: 60000 },
  );
  const sharedDomains = useMemo(
    () =>
      sortDomains(
        (sharedData || []).filter(
          (d) =>
            !options.search ||
            d.slug.toLowerCase().includes(options.search.toLowerCase()),
        ),
      ).map((domain) => ({ ...domain, isWorkspaceDomain: false })),
    [sharedData, options.search],
  );

  // unverified domains can't be used until their DNS is set up
  const verifiedWorkspaceDomains = useMemo(
    () =>
      options.onboarding
        ? []
        : sortDomains(
            (activeWorkspaceDomains || []).filter(({ verified }) => verified),
          ).map((domain) => ({ ...domain, isWorkspaceDomain: true })),
    [options.onboarding, activeWorkspaceDomains],
  );

  const domains = useMemo(() => {
    const available = [...verifiedWorkspaceDomains, ...sharedDomains];

    // keep the current domain of a link being edited selectable (archived, unverified
    // or a default domain), so editing other fields doesn't force a domain change
    if (
      currentDomain &&
      !available.some(({ slug }) => slug === currentDomain)
    ) {
      const domain = allDomains.find(({ slug }) => slug === currentDomain);
      if (domain) {
        available.push(domain);
      }
    }

    return available;
  }, [verifiedWorkspaceDomains, sharedDomains, currentDomain, allDomains]);

  const primaryDomain = useMemo(
    () =>
      verifiedWorkspaceDomains.find(({ primary }) => primary)?.slug ||
      verifiedWorkspaceDomains[0]?.slug ||
      sharedDomains[0]?.slug,
    [verifiedWorkspaceDomains, sharedDomains],
  );

  return {
    domains,
    allWorkspaceDomains,
    activeWorkspaceDomains,
    loading:
      (options.onboarding ? false : loading) ||
      Boolean(workspaceId && !sharedData && !sharedError),
    primaryDomain,
  };
}
