import {
  TRACKING_ADAPTERS,
  TRACKING_PLATFORMS,
} from "@/lib/ads-tracking/adapters";
import { TrackingPlatform } from "@/lib/ads-tracking/types";
import useWorkspace from "@/lib/swr/use-workspace";
import { Button } from "@dub/ui";
import { Trash } from "@dub/ui/icons";
import { cn, fetcher } from "@dub/utils";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

export interface SavedPixel {
  id: string;
  platform: TrackingPlatform;
  pixelId: string;
  conversionLabel: string;
  name: string;
}

export const PLATFORM_COLORS: Record<TrackingPlatform, string> = {
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

// The current user's saved pixels as a checklist, with add and delete.
// Only the user's own pixels are returned by the API.
export function SavedPixelPicker({
  selectedIds,
  onToggle,
  disabled,
}: {
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  const { id: workspaceId } = useWorkspace();
  const {
    data: pixels,
    mutate,
    isLoading,
  } = useSWR<SavedPixel[]>(
    workspaceId ? `/api/tracking-pixels?workspaceId=${workspaceId}` : null,
    fetcher,
  );

  const [adding, setAdding] = useState(false);

  const remove = async (pixel: SavedPixel) => {
    if (
      !confirm(
        `Delete "${pixel.name}" from your pixels? Links that already use it keep tracking with it.`,
      )
    ) {
      return;
    }
    try {
      await request(
        `/api/tracking-pixels/${pixel.id}?workspaceId=${workspaceId}`,
        "DELETE",
      );
      if (selectedIds.includes(pixel.id)) onToggle(pixel.id, false);
      mutate();
      toast.success("Pixel deleted.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-2">
      {isLoading ? (
        <div className="h-12 animate-pulse rounded-lg bg-neutral-100" />
      ) : !pixels?.length ? (
        <p className="text-sm text-neutral-500">
          No saved pixels yet. Add one below, then tick it for any link.
        </p>
      ) : (
        <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {pixels.map((pixel) => (
            <label
              key={pixel.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              )}
            >
              <input
                type="checkbox"
                className="rounded border-neutral-300"
                checked={selectedIds.includes(pixel.id)}
                disabled={disabled}
                onChange={(e) => onToggle(pixel.id, e.target.checked)}
              />
              <div className="min-w-0 grow">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-neutral-900">
                    {pixel.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium",
                      PLATFORM_COLORS[pixel.platform],
                    )}
                  >
                    {TRACKING_ADAPTERS[pixel.platform].label}
                  </span>
                </div>
                <p className="truncate font-mono text-xs text-neutral-500">
                  {pixel.pixelId}
                  {pixel.conversionLabel && ` / ${pixel.conversionLabel}`}
                </p>
              </div>
              <button
                type="button"
                title="Delete from my pixels"
                className="shrink-0 rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                onClick={(e) => {
                  e.preventDefault();
                  remove(pixel);
                }}
              >
                <Trash className="size-4" />
              </button>
            </label>
          ))}
        </div>
      )}

      {adding ? (
        <AddPixelForm
          workspaceId={workspaceId!}
          onCancel={() => setAdding(false)}
          onSaved={(pixel) => {
            mutate();
            setAdding(false);
            if (!disabled) onToggle(pixel.id, true);
          }}
        />
      ) : (
        <button
          type="button"
          className="text-sm font-medium text-neutral-700 underline-offset-2 hover:underline"
          onClick={() => setAdding(true)}
        >
          + Add new pixel
        </button>
      )}
    </div>
  );
}

function AddPixelForm({
  workspaceId,
  onCancel,
  onSaved,
}: {
  workspaceId: string;
  onCancel: () => void;
  onSaved: (pixel: SavedPixel) => void;
}) {
  const [platform, setPlatform] = useState<TrackingPlatform>("meta");
  const [pixelId, setPixelId] = useState("");
  const [conversionLabel, setConversionLabel] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // client-side preview only; the server validates again
  const check = useMemo(
    () =>
      pixelId.trim()
        ? TRACKING_ADAPTERS[platform].validate({ pixelId, conversionLabel })
        : null,
    [platform, pixelId, conversionLabel],
  );

  const save = async () => {
    setSaving(true);
    try {
      const pixel = await request(
        `/api/tracking-pixels?workspaceId=${workspaceId}`,
        "POST",
        {
          platform,
          pixelId,
          conversionLabel: conversionLabel || undefined,
          name,
        },
      );
      toast.success("Pixel saved.");
      onSaved(pixel);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap gap-1">
        {TRACKING_PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatform(p)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs",
              platform === p
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50",
            )}
          >
            {TRACKING_ADAPTERS[p].label}
          </button>
        ))}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name, e.g. FB Ads – Campaign November"
        maxLength={60}
        className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
      />
      <input
        value={pixelId}
        onChange={(e) => setPixelId(e.target.value)}
        placeholder={
          platform === "google_ads"
            ? "Conversion ID, e.g. AW-123456789"
            : platform === "tiktok"
              ? "Pixel ID, e.g. C4ABCDEFGHIJ1234567K"
              : "Pixel ID, e.g. 123456789012345"
        }
        className="w-full rounded-md border border-neutral-300 px-3 py-1.5 font-mono text-sm"
      />
      {platform === "google_ads" && (
        <input
          value={conversionLabel}
          onChange={(e) => setConversionLabel(e.target.value)}
          placeholder="Conversion Label (optional)"
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 font-mono text-sm"
        />
      )}
      {check && !check.ok && (
        <p className="text-xs text-red-600">{check.error}</p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          text="Cancel"
          className="h-8 w-fit px-3"
          onClick={onCancel}
        />
        <Button
          type="button"
          text="Save pixel"
          className="h-8 w-fit px-3"
          loading={saving}
          disabled={!check?.ok || !name.trim()}
          onClick={save}
        />
      </div>
    </div>
  );
}
