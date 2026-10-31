import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";
import { Geist_Mono, Roboto, Roboto_Condensed, Roboto_Slab } from "next/font/google";
import { ConditionalAppShell } from "@/components/conditional-app-shell";
import { MapsProvider } from "@/components/providers/maps-provider";
import { NavigationHistoryProvider } from "@/components/providers/navigation-history-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { UnsavedChangesProvider } from "@/components/providers/unsaved-changes-provider";
import "./globals.css";
import { RecordSyncProvider } from "@/components/providers/record-sync-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { THEME_COOKIE_NAME, themeClass, themeOf } from "@/lib/ui/theme";
import { WIDTH_UNIT_COOKIE_NAME, widthUnitOf, widthUnitStyle } from "@/lib/ui/width-unit";
import { WidthUnitSync } from "@/components/providers/width-unit-sync";

// Slice 40.70: the body text — the plain member of the titles' family. The variable file, one per style and subset,
// carries every weight the app asks for (font-medium 500, font-semibold 600, font-bold 700) where static files would
// need one each and would draw 600 as 700; the italic is for the blank choices („fără valoare", globals.css). latin-ext
// so ă â î ș ț come from the same file. Geist is no longer loaded; Geist Mono stays for codes.
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
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
  // Slice 40.56: 400 for the fields' labels (`FIELD_LABEL`, src/lib/ui/field-box.ts) beside the column names' 600.
  weight: ["400", "600"],
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
  // Slice 40.19: the look from the ga40-theme cookie, on <html> from the first byte — a dark load is never white first.
  const jar = await cookies();
  const theme = themeOf(jar.get(THEME_COOKIE_NAME)?.value);
  // Slice 41.16: the width unit set on „Setări", from this browser's cookie — every tile is drawn in it from the first byte.
  const unitPx = widthUnitOf(jar.get(WIDTH_UNIT_COOKIE_NAME)?.value);

  return (
    <html
      lang={locale}
      className={`${roboto.variable} ${geistMono.variable} ${robotoSlab.variable} ${robotoCondensed.variable} h-full antialiased ${themeClass(theme)}`.trim()}
      style={{ colorScheme: theme, ...widthUnitStyle(unitPx) }}
    >
      <body className="h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider initial={theme}>
          <WidthUnitSync />
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
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
