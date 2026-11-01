import { APP_DOMAIN } from "@dub/utils";
import { NextRequest, NextResponse } from "next/server";
import { parse } from "./utils/parse";

export function ApiMiddleware(req: NextRequest) {
  const { fullPath } = parse(req);

  // /metatags isn't served on the api host; send it to the app
  if (fullPath.startsWith("/metatags")) {
    return NextResponse.redirect(APP_DOMAIN, {
      status: 301,
    });
  }
  // Note: we don't have to account for paths starting with `/api`
  // since they're automatically excluded via our middleware matcher
  return NextResponse.rewrite(new URL(`/api${fullPath}`, req.url));
}
