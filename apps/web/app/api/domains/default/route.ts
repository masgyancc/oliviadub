import { withWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultDomainsQuerySchema } from "@/lib/zod/schemas/domains";
import {
  DEFAULT_DOMAIN_COLUMNS,
  DUB_DOMAINS_ARRAY,
  defaultDomainColumnToSlug,
} from "@dub/utils";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

// GET /api/domains/default - get default domains
export const GET = withWorkspace(
  async ({ workspace, searchParams }) => {
    const { search } = getDefaultDomainsQuerySchema.parse(searchParams);

    const data = await prisma.defaultDomains.findUnique({
      where: {
        projectId: workspace.id,
      },
      select: {
        dubsh: true,
        chatgpt: true,
        sptifi: true,
        gitnew: true,
        callink: true,
        amznid: true,
        ggllink: true,
        figpage: true,
      },
    });

    let defaultDomains: string[] = [];

    if (data) {
      defaultDomains = Object.keys(data)
        .filter((key) => data[key])
        .map((column) => defaultDomainColumnToSlug(column))
        .filter((domain): domain is string => Boolean(domain))
        .filter((domain) =>
          search ? domain.toLowerCase().includes(search.toLowerCase()) : true,
        );
    }

    return NextResponse.json(defaultDomains);
  },
  {
    requiredPermissions: ["domains.read"],
  },
);

const updateDefaultDomainsSchema = z.object({
  defaultDomains: z.array(z.enum(DUB_DOMAINS_ARRAY as [string, ...string[]])),
});

// PATCH /api/domains/default - edit default domains
export const PATCH = withWorkspace(
  async ({ req, workspace }) => {
    const { defaultDomains } = await updateDefaultDomainsSchema.parseAsync(
      await req.json(),
    );

    // one boolean column per default-domain slot (see DEFAULT_DOMAIN_COLUMNS)
    const data = Object.fromEntries(
      DEFAULT_DOMAIN_COLUMNS.map((column) => {
        const slug = defaultDomainColumnToSlug(column);
        return [column, Boolean(slug && defaultDomains.includes(slug))];
      }),
    ) as Record<(typeof DEFAULT_DOMAIN_COLUMNS)[number], boolean>;

    const response = await prisma.defaultDomains.update({
      where: {
        projectId: workspace.id,
      },
      data,
    });

    return NextResponse.json(response);
  },
  {
    requiredPermissions: ["domains.write"],
  },
);
