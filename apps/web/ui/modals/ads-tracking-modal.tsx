import {
  TRACKING_ADAPTERS,
  TRACKING_PLATFORMS,
} from "@/lib/ads-tracking/adapters";
import { TrackingPlatform, TrackingTag } from "@/lib/ads-tracking/types";
import useWorkspace from "@/lib/swr/use-workspace";
import { LinkProps } from "@/lib/types";
import { SavedPixelPicker } from "@/ui/links/saved-pixel-picker";
import { Button, Modal } from "@dub/ui";
import { cn, fetcher, linkConstructor } from "@dub/utils";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";

interface TagRow {
  id: string;
  platform: TrackingPlatform;
  pixelId: string;
  conversionLabel: string;
  name: string | null;
  enabled: boolean;
}

const PLATFORM_HINTS: Record<TrackingPlatform, string> = {
  meta: "Meta Pixel ID (15–16 digits), Events Manager → Data sources.",
  tiktok: "TikTok Pixel ID (20 characters), Events Manager → Web events.",
  google_ads:
    "Conversion ID (AW-…) and optional Conversion Label, Goals → Conversions → Tag setup.",
};

const PLATFORM_COLORS: Record<TrackingPlatform, string> = {
  meta: "bg-blue-100 text-blue-800",
  tiktok: "bg-neutral-900 text-white",
  google_ads: "bg-amber-100 text-amber-800",
};

async function request(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message || "Something went wrong.");
  }
  return res.json();
}

function AdsTrackingModalInner({
  link,
  setShowModal,
}: {
  link: LinkProps;
  setShowModal: Dispatch<SetStateAction<boolean>>;
}) {
  const { id: workspaceId } = useWorkspace();
  const base = `/api/links/${link.id}/tracking`;
  const qs = `?workspaceId=${workspaceId}`;

  const {
    data: tags,
    mutate,
    isLoading,
  } = useSWR<TagRow[]>(workspaceId ? `${base}${qs}` : null, fetcher);

  // the user's saved pixels on this link; ticking one applies it right away
  const { data: saved, mutate: mutateSaved } = useSWR<{
    savedPixelIds: string[];
  }>(workspaceId ? `${base}/saved${qs}` : null, fetcher);
  const [savingPixels, setSavingPixels] = useState(false);

  const toggleSaved = async (id: string, checked: boolean) => {
    const currentIds = saved?.savedPixelIds ?? [];
    const savedPixelIds = checked
      ? [...new Set([...currentIds, id])]
      : currentIds.filter((x) => x !== id);
    setSavingPixels(true);
    try {
      await request(`${base}/saved${qs}`, "PUT", { savedPixelIds });
      await Promise.all([mutateSaved(), mutate()]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingPixels(false);
    }
  };

  // add form
  const [platform, setPlatform] = useState<TrackingPlatform>("meta");
  const [mode, setMode] = useState<"manual" | "code">("manual");
  const [pixelId, setPixelId] = useState("");
  const [conversionLabel, setConversionLabel] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const adapter = TRACKING_ADAPTERS[platform];

  // client-side preview only; the server parses and validates again
  const manualCheck = useMemo(
    () =>
      pixelId.trim() ? adapter.validate({ pixelId, conversionLabel }) : null,
    [adapter, pixelId, conversionLabel],
  );
  const parsed: TrackingTag[] = useMemo(
    () => (code.trim() ? adapter.parseFullCode(code) : []),
    [adapter, code],
  );

  const canSubmit =
    mode === "manual" ? manualCheck?.ok === true : parsed.length > 0;

  const resetForm = () => {
    setPixelId("");
    setConversionLabel("");
    setCode("");
    setName("");
  };

  const add = async () => {
    setSaving(true);
    try {
      await request(`${base}${qs}`, "POST", {
        mode,
        platform,
        name: name || undefined,
        ...(mode === "manual"
          ? { pixelId, conversionLabel: conversionLabel || undefined }
          : { code }),
      });
      toast.success("Tracking added.");
      resetForm();
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const update = async (tag: TagRow, data: Partial<TagRow>) => {
    try {
      await request(`${base}/${tag.id}${qs}`, "PATCH", data);
      mutate();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  };

  const remove = async (tag: TagRow) => {
    if (
      !confirm(
        `Remove ${TRACKING_ADAPTERS[tag.platform].label} ${tag.pixelId}?`,
      )
    ) {
      return;
    }
    try {
      await request(`${base}/${tag.id}${qs}`, "DELETE");
      toast.success("Tracking removed.");
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <div className="space-y-1 border-b border-neutral-200 p-4 sm:p-6">
        <h3 className="text-lg font-medium leading-none">Ads Tracking</h3>
        <p className="truncate text-sm text-neutral-500">
          {linkConstructor({
            domain: link.domain,
            key: link.key,
            pretty: true,
          })}
        </p>
      </div>

      <div className="max-h-[70vh] space-y-6 overflow-y-auto bg-neutral-50 p-4 sm:p-6">
        {/* the user's saved pixels */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-neutral-900">My pixels</h4>
          <SavedPixelPicker
            selectedIds={saved?.savedPixelIds ?? []}
            onToggle={toggleSaved}
            disabled={!saved || savingPixels}
          />
        </div>

        {/* existing tags */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-neutral-900">
            Active on this link
          </h4>
          {isLoading ? (
            <div className="h-12 animate-pulse rounded-lg bg-neutral-100" />
          ) : !tags?.length ? (
            <p className="text-sm text-neutral-500">
              No tracking yet. Visitors are redirected instantly. Once you add a
              tag, they pass through a short page (about 1 s) that fires it.
            </p>
          ) : (
            tags.map((tag) => (
              <TagItem
                key={tag.id}
                tag={tag}
                onUpdate={update}
                onRemove={remove}
              />
            ))
          )}
        </div>

        {/* add form */}
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap gap-1">
            {TRACKING_PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-sm",
                  platform === p
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50",
                )}
              >
                {TRACKING_ADAPTERS[p].label}
              </button>
            ))}
          </div>

          <div className="flex gap-4 border-b border-neutral-200 text-sm">
            {(["manual", "code"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "-mb-px border-b-2 pb-1.5",
                  mode === m
                    ? "border-neutral-900 font-medium text-neutral-900"
                    : "border-transparent text-neutral-500",
                )}
              >
                {m === "manual" ? "Manual ID" : "Full Code"}
              </button>
            ))}
          </div>

          <p className="text-xs text-neutral-500">{PLATFORM_HINTS[platform]}</p>

          {mode === "manual" ? (
            <div className="space-y-2">
              <input
                value={pixelId}
                onChange={(e) => setPixelId(e.target.value)}
                placeholder={
                  platform === "google_ads"
                    ? "Conversion ID, e.g. AW-123456789"
                    : platform === "tiktok"
                      ? "e.g. C4ABCDEFGHIJ1234567K"
                      : "e.g. 123456789012345"
                }
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              {platform === "google_ads" && (
                <input
                  value={conversionLabel}
                  onChange={(e) => setConversionLabel(e.target.value)}
                  placeholder="Conversion Label (optional), e.g. AbC-D_efG-h12"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              )}
              {manualCheck && !manualCheck.ok && (
                <p className="text-xs text-red-600">{manualCheck.error}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={5}
                placeholder={`Paste the official ${adapter.label} code here. Only the ID is extracted; the code itself is never stored or run.`}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs"
              />
              {code.trim() &&
                (parsed.length ? (
                  <div className="rounded-md bg-green-50 p-2 text-xs text-green-800">
                    Found:{" "}
                    {parsed
                      .map((t) =>
                        t.conversionLabel
                          ? `${t.pixelId} / ${t.conversionLabel}`
                          : t.pixelId,
                      )
                      .join(", ")}
                  </div>
                ) : (
                  <p className="text-xs text-red-600">
                    No valid {adapter.label} ID found in this code.
                  </p>
                ))}
            </div>
          )}

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional), e.g. Campaign November"
            maxLength={60}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />

          <Button
            text="Add tracking"
            onClick={add}
            loading={saving}
            disabled={!canSubmit}
            className="h-9"
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-neutral-200 bg-neutral-50 px-4 py-4 sm:px-6">
        <Button
          variant="secondary"
          text="Done"
          onClick={() => setShowModal(false)}
          className="h-8 w-fit px-3"
        />
      </div>
    </>
  );
}

function TagItem({
  tag,
  onUpdate,
  onRemove,
}: {
  tag: TagRow;
  onUpdate: (tag: TagRow, data: Partial<TagRow>) => Promise<boolean>;
  onRemove: (tag: TagRow) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pixelId, setPixelId] = useState(tag.pixelId);
  const [label, setLabel] = useState(tag.conversionLabel);
  const [name, setName] = useState(tag.name ?? "");

  const check = TRACKING_ADAPTERS[tag.platform].validate({
    pixelId,
    conversionLabel: label,
  });

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs font-medium",
            PLATFORM_COLORS[tag.platform],
          )}
        >
          {TRACKING_ADAPTERS[tag.platform].label}
        </span>
        <span className="font-mono text-sm text-neutral-900">
          {tag.pixelId}
          {tag.conversionLabel && ` / ${tag.conversionLabel}`}
        </span>
        {tag.name && (
          <span className="text-xs text-neutral-500">{tag.name}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={tag.enabled}
              onChange={(e) => onUpdate(tag, { enabled: e.target.checked })}
            />
            {tag.enabled ? "Enabled" : "Disabled"}
          </label>
          <button
            type="button"
            className="text-xs text-neutral-600 underline"
            onClick={() => setEditing(!editing)}
          >
            Edit
          </button>
          <button
            type="button"
            className="text-xs text-red-600 underline"
            onClick={() => onRemove(tag)}
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-2">
          <input
            value={pixelId}
            onChange={(e) => setPixelId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          {tag.platform === "google_ads" && (
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Conversion Label (optional)"
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            maxLength={60}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          {!check.ok && <p className="text-xs text-red-600">{check.error}</p>}
          <Button
            text="Save"
            disabled={!check.ok}
            className="h-8 w-fit px-3"
            onClick={async () => {
              const ok = await onUpdate(tag, {
                pixelId,
                conversionLabel: label,
                name: name || null,
              });
              if (ok) setEditing(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function useAdsTrackingModal({ link }: { link: LinkProps }) {
  const [showAdsTrackingModal, setShowAdsTrackingModal] = useState(false);

  const AdsTrackingModal = useCallback(
    () => (
      <Modal
        showModal={showAdsTrackingModal}
        setShowModal={setShowAdsTrackingModal}
        className="max-w-lg"
      >
        <AdsTrackingModalInner
          link={link}
          setShowModal={setShowAdsTrackingModal}
        />
      </Modal>
    ),
    [showAdsTrackingModal, link],
  );

  return useMemo(
    () => ({ setShowAdsTrackingModal, AdsTrackingModal }),
    [AdsTrackingModal],
  );
}
