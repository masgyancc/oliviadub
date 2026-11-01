import { fetcher } from "@dub/utils";
import useSWR from "swr";

// BrewCC: whether the current user may add custom domains (see /api/domains/add-permission)
export default function useAddDomainPermission() {
  const { data } = useSWR<{ allowed: boolean; message: string | null }>(
    "/api/domains/add-permission",
    fetcher,
    { dedupingInterval: 30000 },
  );

  return {
    // treated as blocked until known, so the button never flashes enabled
    allowed: data?.allowed ?? false,
    message: data ? data.message : null,
    loading: !data,
  };
}
