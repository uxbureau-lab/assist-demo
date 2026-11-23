import type { Metadata, Viewport } from "next";
import { interTight, jetbrainsMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assist — an AI assistant for support operators",
  description:
    "Prototype by UX Bureau: answers with evidence, actions with confirmation, autonomy per action type.",
  robots: { index: false },
};

export const viewport: Viewport = { themeColor: "#f4f4f1" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
