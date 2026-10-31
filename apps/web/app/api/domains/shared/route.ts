import { withWorkspace } from "@/lib/auth";
import { getSharedDomains } from "@/lib/brewcc/shared-domains";
import { NextResponse } from "next/server";

// GET /api/domains/shared – BrewCC: verified custom domains of other workspaces that this
// workspace can use for its own links (only the hostname is exposed, not the owner's settings)
export const GET = withWorkspace(
  async ({ workspace }) => {
    const domains = await getSharedDomains({
      excludeWorkspaceId: workspace.id,
    });

    return NextResponse.json(
      domains.map((d) => ({
        id: d.id,
        slug: d.slug,
        verified: true,
        primary: false,
        archived: false,
        createdAt: d.createdAt,
        shared: true,
      })),
    );
  },
  {
    requiredPermissions: ["domains.read"],
  },
);
