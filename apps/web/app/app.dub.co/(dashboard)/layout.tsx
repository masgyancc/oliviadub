import { MainNav } from "@/ui/layout/main-nav";
import { AppSidebarNav } from "@/ui/layout/sidebar/app-sidebar-nav";
import Toolbar from "@/ui/layout/toolbar/toolbar";
import { UpgradeBanner } from "@/ui/layout/upgrade-banner";
import { ModalProvider } from "@/ui/modals/modal-provider";
import { constructMetadata } from "@dub/utils";
import { ReactNode } from "react";

export const dynamic = "force-static";
export const metadata = constructMetadata();

export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <ModalProvider>
      <div className="min-h-screen w-full bg-white">
        <UpgradeBanner />
        {/* BrewCC: no upstream help link or news feed in the sidebar */}
        <MainNav sidebar={AppSidebarNav}>{children}</MainNav>
      </div>
      <Toolbar show={["onboarding"]} />
    </ModalProvider>
  );
}
