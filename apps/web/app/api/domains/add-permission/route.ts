import { withSession } from "@/lib/auth";
import {
  ADD_DOMAIN_DISABLED_MESSAGE,
  canAddDomains,
} from "@/lib/brewcc/platform-settings";
import { NextResponse } from "next/server";

// GET /api/domains/add-permission – BrewCC: whether the session user may add custom
// domains ("Allow Users to Add Domains"; master admins always). Only drives the UI –
// every add-domain endpoint checks the same rule itself.
export const GET = withSession(async ({ session }) => {
  const allowed = await canAddDomains(session.user.id);
  return NextResponse.json({
    allowed,
    message: allowed ? null : ADD_DOMAIN_DISABLED_MESSAGE,
  });
});
