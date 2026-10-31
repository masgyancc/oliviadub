import { getLinkOrThrow } from "@/lib/api/links/get-link-or-throw";
import { verifyFolderAccess } from "@/lib/folder/permissions";
import { WorkspaceWithUsers } from "@/lib/types";

// Same ownership checks as /api/links/[linkId]: the link must belong to the workspace and
// the user must have access to its folder.
export async function getOwnedLinkForTracking({
  workspace,
  userId,
  linkId,
  write,
}: {
  workspace: WorkspaceWithUsers;
  userId: string;
  linkId: string;
  write: boolean;
}) {
  const link = await getLinkOrThrow({ workspaceId: workspace.id, linkId });
  if (link.folderId) {
    await verifyFolderAccess({
      workspace,
      userId,
      folderId: link.folderId,
      requiredPermission: write ? "folders.links.write" : "folders.read",
    });
  }
  return link;
}
