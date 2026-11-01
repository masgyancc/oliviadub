import { CopyButton, Flag, LinkLogo } from "@dub/ui";
import { getApexDomain, linkConstructor } from "@dub/utils";
import Link from "next/link";

export default function LinkInspectorCard({
  domain,
  _key,
  url,
}: {
  domain: string;
  _key: string;
  url: string;
}) {
  const key = _key;
  const apexDomain = getApexDomain(url);
  return (
    <div className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-center space-x-3">
        <LinkLogo apexDomain={apexDomain} />
        <div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            <a
              className="font-semibold text-blue-800"
              href={linkConstructor({ domain, key })}
              target="_blank"
              rel="noreferrer"
            >
              {linkConstructor({ domain, key, pretty: true })}
            </a>
            <CopyButton value={linkConstructor({ domain, key })} />
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-1 text-left text-sm text-neutral-500 underline-offset-2 transition-all hover:text-neutral-800 hover:underline"
          >
            {url}
          </a>
        </div>
      </div>
    </div>
  );
}
