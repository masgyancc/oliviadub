import useWorkspace from "@/lib/swr/use-workspace";
import {
  LinkFormData,
  useLinkBuilderContext,
} from "@/ui/links/link-builder/link-builder-provider";
import { useLinkBuilderKeyboardShortcut } from "@/ui/links/link-builder/use-link-builder-keyboard-shortcut";
import { SavedPixelPicker } from "@/ui/links/saved-pixel-picker";
import { Button, Modal } from "@dub/ui";
import { cn } from "@dub/utils";
import { Crosshair } from "lucide-react";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useFormContext } from "react-hook-form";

// BrewCC: pick saved pixels for a link. The choice lives in the form as
// `trackingPixelIds` (undefined = untouched) and is applied after the link is saved,
// see use-link-builder-submit.
export type PixelFormData = LinkFormData & { trackingPixelIds?: string[] };

function usePixelSelection() {
  const { props } = useLinkBuilderContext();
  const { id: workspaceId } = useWorkspace();
  const { watch, setValue } = useFormContext<PixelFormData>();
  const selected = watch("trackingPixelIds");
  const [loaded, setLoaded] = useState<string[] | null>(null);

  // existing link: start from the pixels it already uses
  useEffect(() => {
    if (!props?.id || !workspaceId || selected !== undefined) return;
    let cancelled = false;
    fetch(`/api/links/${props.id}/tracking/saved?workspaceId=${workspaceId}`)
      .then((res) => (res.ok ? res.json() : { savedPixelIds: [] }))
      .then((data) => !cancelled && setLoaded(data.savedPixelIds ?? []))
      .catch(() => !cancelled && setLoaded([]));
    return () => {
      cancelled = true;
    };
  }, [props?.id, workspaceId, selected]);

  const current = selected ?? loaded ?? [];
  const set = (ids: string[]) =>
    setValue("trackingPixelIds", ids, { shouldDirty: true });

  return { current, set };
}

function PixelsModalInner({
  setShowPixelsModal,
}: {
  setShowPixelsModal: Dispatch<SetStateAction<boolean>>;
}) {
  const { current, set } = usePixelSelection();
  const [draft, setDraft] = useState<string[]>(current);

  useEffect(() => setDraft(current), [current.join(",")]);

  return (
    <div className="px-5 py-4">
      <h3 className="text-lg font-medium">Pixels</h3>
      <p className="mt-1 text-sm text-neutral-500">
        Tick the pixels to fire when someone opens this link. Your saved pixels
        are only visible to you.
      </p>

      <div className="mt-4 max-h-[55vh] overflow-y-auto">
        <SavedPixelPicker
          selectedIds={draft}
          onToggle={(id, checked) =>
            setDraft((d) =>
              checked ? [...new Set([...d, id])] : d.filter((x) => x !== id),
            )
          }
        />
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          text="Cancel"
          className="h-9 w-fit"
          onClick={() => setShowPixelsModal(false)}
        />
        <Button
          type="button"
          text="Apply"
          className="h-9 w-fit"
          onClick={() => {
            set(draft);
            setShowPixelsModal(false);
          }}
        />
      </div>
    </div>
  );
}

function PixelsButton({
  setShowPixelsModal,
}: {
  setShowPixelsModal: Dispatch<SetStateAction<boolean>>;
}) {
  const { watch } = useFormContext<PixelFormData>();
  const key = watch("key");
  const { current } = usePixelSelection();

  useLinkBuilderKeyboardShortcut("i", () => setShowPixelsModal(true));

  // root domain links don't redirect through the tracking page
  if (key === "_root") return null;

  return (
    <Button
      variant="secondary"
      text={current.length ? `Pixels (${current.length})` : "Pixels"}
      icon={
        <Crosshair
          className={cn("size-4", current.length > 0 && "text-blue-500")}
        />
      }
      className="h-8 w-fit gap-1.5 px-2.5 text-xs font-medium text-neutral-700"
      onClick={() => setShowPixelsModal(true)}
    />
  );
}

export function usePixelsModal() {
  const [showPixelsModal, setShowPixelsModal] = useState(false);

  const PixelsModalCallback = useCallback(
    () => (
      <Modal
        showModal={showPixelsModal}
        setShowModal={setShowPixelsModal}
        className="sm:max-w-md"
      >
        <PixelsModalInner setShowPixelsModal={setShowPixelsModal} />
      </Modal>
    ),
    [showPixelsModal],
  );

  const PixelsButtonCallback = useCallback(
    () => <PixelsButton setShowPixelsModal={setShowPixelsModal} />,
    [],
  );

  return useMemo(
    () => ({
      setShowPixelsModal,
      PixelsModal: PixelsModalCallback,
      PixelsButton: PixelsButtonCallback,
    }),
    [PixelsModalCallback, PixelsButtonCallback],
  );
}
