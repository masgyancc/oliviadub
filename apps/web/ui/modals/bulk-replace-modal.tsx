import { mutatePrefix } from "@/lib/swr/mutate";
import useWorkspace from "@/lib/swr/use-workspace";
import { Button, Modal } from "@dub/ui";
import { fetcher, formatDateTime } from "@dub/utils";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";

// BrewCC Bulk Destination Replacement. Scope "all" = every link the current user created in
// this workspace; scope "selected" = the links checked in the list. The server enforces both.

interface PreviewItem {
  linkId: string;
  shortLink: string;
  oldUrl: string;
  newUrl: string;
  otherTargetsWarning: boolean;
}
interface Preview {
  checked: number;
  matched: number;
  limit: number;
  items: PreviewItem[];
}
interface Result {
  runId: string;
  checked: number;
  matched: number;
  updated: number;
  skipped: number;
  failed: number;
}
interface Run {
  runId: string;
  createdAt: string;
  count: number;
  reverted: number;
  sample: { oldUrl: string; newUrl: string };
}

const LARGE_RUN = 50;

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || "Something went wrong.");
  return json as T;
}

function BulkReplaceInner({
  linkIds,
  setShowModal,
}: {
  linkIds?: string[];
  setShowModal: Dispatch<SetStateAction<boolean>>;
}) {
  const { id: workspaceId } = useWorkspace();
  const qs = `?workspaceId=${workspaceId}`;
  const scope = linkIds?.length ? "selected" : "all";

  const [oldDomain, setOldDomain] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [confirmCount, setConfirmCount] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: runs, mutate: mutateRuns } = useSWR<Run[]>(
    workspaceId ? `/api/links/bulk-replace/runs${qs}` : null,
    fetcher,
  );

  const runPreview = async () => {
    setLoading(true);
    setResult(null);
    try {
      setPreview(
        await post<Preview>(`/api/links/bulk-replace${qs}`, {
          action: "preview",
          oldDomain,
          newDomain,
          scope,
          ...(scope === "selected" && { linkIds }),
        }),
      );
      setConfirmCount("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const res = await post<Result>(`/api/links/bulk-replace${qs}`, {
        action: "apply",
        oldDomain,
        newDomain,
        items: preview.items.map((i) => ({
          linkId: i.linkId,
          expectedUrl: i.oldUrl,
        })),
      });
      setResult(res);
      setPreview(null);
      mutatePrefix("/api/links");
      mutateRuns();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const undo = async (run: Run) => {
    if (
      !confirm(
        `Undo this replacement? Links you edited afterwards are left unchanged.`,
      )
    )
      return;
    try {
      const res = await post<{
        reverted: number;
        skipped: number;
        failed: number;
      }>(`/api/links/bulk-replace/runs${qs}`, { runId: run.runId });
      toast.success(
        `Reverted ${res.reverted}, skipped ${res.skipped}, failed ${res.failed}.`,
      );
      mutatePrefix("/api/links");
      mutateRuns();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const needsTypedConfirm = (preview?.items.length ?? 0) > LARGE_RUN;
  const canApply =
    !!preview?.items.length &&
    (!needsTypedConfirm || confirmCount === String(preview.items.length));

  return (
    <>
      <div className="space-y-1 border-b border-neutral-200 p-4 sm:p-6">
        <h3 className="text-lg font-medium leading-none">
          Bulk Destination Replacement
        </h3>
        <p className="text-sm text-neutral-500">
          {scope === "selected"
            ? `Only the ${linkIds!.length} selected link(s) you created are checked.`
            : "All links you created in this workspace are checked."}
        </p>
      </div>

      <div className="max-h-[70vh] space-y-5 overflow-y-auto bg-neutral-50 p-4 sm:p-6">
        {/* input */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium text-neutral-800">Old domain</span>
            <input
              value={oldDomain}
              onChange={(e) => {
                setOldDomain(e.target.value);
                setPreview(null);
              }}
              placeholder="toko1a.com"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-neutral-800">New domain</span>
            <input
              value={newDomain}
              onChange={(e) => {
                setNewDomain(e.target.value);
                setPreview(null);
              }}
              placeholder="sepedalipat.com"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>
        </div>
        <div className="rounded-lg bg-white p-3 text-xs text-neutral-600 ring-1 ring-neutral-200">
          Only the domain changes. Path, <code>?query</code> and{" "}
          <code>#fragment</code> are kept.
          <code>www.</code> and http/https are ignored when matching.
          <br />
          <span className="font-mono">
            https://www.toko1a.com/lokasi/bali?source=ads#kontak →
            https://sepedalipat.com/lokasi/bali?source=ads#kontak
          </span>
        </div>
        <Button
          text="Preview changes"
          variant="secondary"
          loading={loading && !preview}
          disabled={!oldDomain.trim() || !newDomain.trim()}
          onClick={runPreview}
          className="h-9"
        />

        {/* preview */}
        {preview && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-700">
              Checked <b>{preview.checked}</b> link(s) ·{" "}
              <b>{preview.matched}</b> match
              {preview.matched > preview.limit &&
                `. Only the first ${preview.limit} are processed in this run, run it again for the rest.`}
            </p>
            {preview.items.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No destination URL matches. Nothing will change.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-neutral-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-neutral-50 text-neutral-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Short link</th>
                      <th className="px-3 py-2 font-medium">
                        Old → new destination
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {preview.items.map((item) => (
                      <tr key={item.linkId} className="align-top">
                        <td className="whitespace-nowrap px-3 py-2 font-medium text-neutral-900">
                          {item.shortLink.replace(/^https?:\/\//, "")}
                        </td>
                        <td className="break-all px-3 py-2">
                          <div className="text-neutral-400 line-through">
                            {item.oldUrl}
                          </div>
                          <div className="text-neutral-900">{item.newUrl}</div>
                          {item.otherTargetsWarning && (
                            <div className="mt-1 text-amber-700">
                              iOS / Android / geo / A-B targets of this link
                              still use the old domain and are not changed.
                              Check them in the link editor.
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {preview.items.length > 0 && (
              <div className="space-y-2">
                {needsTypedConfirm && (
                  <label className="block text-sm text-neutral-700">
                    Type <b>{preview.items.length}</b> to confirm this large
                    replacement:
                    <input
                      value={confirmCount}
                      onChange={(e) => setConfirmCount(e.target.value)}
                      className="mt-1 w-32 rounded-md border border-neutral-300 px-3 py-1.5"
                    />
                  </label>
                )}
                <Button
                  text={`Confirm: replace ${preview.items.length} destination URL(s)`}
                  loading={loading}
                  disabled={!canApply}
                  onClick={apply}
                  className="h-9"
                />
              </div>
            )}
          </div>
        )}

        {/* result */}
        {result && (
          <div className="rounded-lg bg-white p-4 text-sm ring-1 ring-neutral-200">
            <p className="font-medium text-neutral-900">Replacement finished</p>
            <ul className="mt-2 grid grid-cols-2 gap-1 text-neutral-700 sm:grid-cols-5">
              <li>
                Checked: <b>{result.checked}</b>
              </li>
              <li>
                Matched: <b>{result.matched}</b>
              </li>
              <li className="text-green-700">
                Updated: <b>{result.updated}</b>
              </li>
              <li>
                Skipped: <b>{result.skipped}</b>
              </li>
              <li className="text-red-700">
                Failed: <b>{result.failed}</b>
              </li>
            </ul>
            {result.skipped > 0 && (
              <p className="mt-2 text-xs text-neutral-500">
                Skipped links were changed or removed after the preview and were
                left untouched.
              </p>
            )}
          </div>
        )}

        {/* history / undo */}
        {!!runs?.length && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Recent replacements
            </p>
            {runs.map((run) => (
              <div
                key={run.runId}
                className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-xs ring-1 ring-neutral-200"
              >
                <div className="min-w-0">
                  <div className="text-neutral-500">
                    {formatDateTime(run.createdAt)}
                  </div>
                  <div className="truncate text-neutral-800">
                    {run.count} link(s), e.g. {run.sample.oldUrl} →{" "}
                    {run.sample.newUrl}
                  </div>
                </div>
                {run.reverted >= run.count ? (
                  <span className="shrink-0 text-neutral-400">Undone</span>
                ) : (
                  <Button
                    variant="secondary"
                    text="Undo"
                    className="h-7 w-fit shrink-0 px-2 text-xs"
                    onClick={() => undo(run)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end border-t border-neutral-200 bg-neutral-50 px-4 py-4 sm:px-6">
        <Button
          variant="secondary"
          text="Close"
          onClick={() => setShowModal(false)}
          className="h-8 w-fit px-3"
        />
      </div>
    </>
  );
}

export function useBulkReplaceModal({ linkIds }: { linkIds?: string[] } = {}) {
  const [showBulkReplaceModal, setShowBulkReplaceModal] = useState(false);

  const BulkReplaceModal = useCallback(
    () => (
      <Modal
        showModal={showBulkReplaceModal}
        setShowModal={setShowBulkReplaceModal}
        className="max-w-2xl"
      >
        <BulkReplaceInner
          linkIds={linkIds}
          setShowModal={setShowBulkReplaceModal}
        />
      </Modal>
    ),
    [showBulkReplaceModal, linkIds],
  );

  return useMemo(
    () => ({ setShowBulkReplaceModal, BulkReplaceModal }),
    [BulkReplaceModal],
  );
}
