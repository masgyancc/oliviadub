import { geistMono, inter, satoshi } from "@/styles/fonts";
import "@/styles/globals.css";
import { THEME_INIT_SCRIPT } from "@/ui/theme/theme-script";
import { cn, constructMetadata } from "@dub/utils";
import RootProviders from "./providers";

export const metadata = constructMetadata();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(satoshi.variable, inter.variable, geistMono.variable)}
      // data-theme is set by THEME_INIT_SCRIPT before React hydrates
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
