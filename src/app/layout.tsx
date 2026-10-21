import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Geist, Geist_Mono, Roboto_Condensed, Roboto_Slab } from "next/font/google";
import { ConditionalAppShell } from "@/components/conditional-app-shell";
import { MapsProvider } from "@/components/providers/maps-provider";
import { NavigationHistoryProvider } from "@/components/providers/navigation-history-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { UnsavedChangesProvider } from "@/components/providers/unsaved-changes-provider";
import "./globals.css";
import { RecordSyncProvider } from "@/components/providers/record-sync-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Slice 40.18: the titles' two families (alternative 13 of 40.05), only the weights the titles use, with latin-ext so
// ă â î ș ț are drawn by their own files. next/font self-hosts them: the browser never calls Google.
const robotoSlab = Roboto_Slab({
  variable: "--font-roboto-slab",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
});

const robotoCondensed = Roboto_Condensed({
  variable: "--font-roboto-condensed",
  subsets: ["latin", "latin-ext"],
  weight: ["600"],
});

export const metadata: Metadata = {
  title: "GA40",
  description: "People, documents, and properties",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${robotoSlab.variable} ${robotoCondensed.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <MapsProvider>
            <QueryProvider>
              <RecordSyncProvider>
              <UnsavedChangesProvider>
                <NavigationHistoryProvider>
                  <ConditionalAppShell>{children}</ConditionalAppShell>
                </NavigationHistoryProvider>
              </UnsavedChangesProvider>
              </RecordSyncProvider>
            </QueryProvider>
          </MapsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
