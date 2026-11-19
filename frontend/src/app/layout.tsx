import type { Metadata } from "next";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import { GardenProvider } from "@/components/GardenProvider";
import { AppNavigation } from "@/components/AppNavigation";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import "@fontsource/playfair-display/400.css";
import "./garden.css";

export const metadata: Metadata = {
  title: "Gardenerd",
  description: "Local gardening journal and growing trial tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript forceColorScheme="light" />
      </head>
      <body>
        <GardenProvider>
          <AppNavigation />
          <main className="garden-main" id="main-content">
            {children}
          </main>
        </GardenProvider>
      </body>
    </html>
  );
}
