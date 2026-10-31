import { PageContent } from "@/ui/layout/page-content";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import TelegramPageClient from "./page-client";

export default function TelegramSettingsPage() {
  return (
    <PageContent title="Telegram Integration">
      <PageWidthWrapper>
        <TelegramPageClient />
      </PageWidthWrapper>
    </PageContent>
  );
}
