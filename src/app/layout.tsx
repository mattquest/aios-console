import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { TopNav } from "@/components/top-nav";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "opsz"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "aios — agent runtime console",
  description:
    "Session-oriented intelligence. Dev console for aios: live event log, span timings, triage decisions, reconstructed payloads — transparency as a first-class primitive.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${fraunces.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} antialiased`}
    >
      {/* h-dvh pins the app to the dynamic viewport height — without it, the
          session view's inner flex chain can grow past the screen and push the
          composer below the fold. overflow-hidden prevents the dot-grid fixed
          layer from introducing a scrollbar via subpixel rounding. */}
      <body className="h-dvh overflow-hidden flex flex-col bg-background text-foreground font-sans">
        <div className="pointer-events-none fixed inset-0 z-0 bg-[url('/noise.svg')] opacity-[0.04] mix-blend-overlay" />
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.25) 1px, transparent 0)",
            backgroundSize: "32px 32px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)",
          }}
        />
        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          <TopNav />
          <div className="flex-1 flex min-h-0 min-w-0">{children}</div>
        </div>
      </body>
    </html>
  );
}
