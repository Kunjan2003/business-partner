import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Business Partner · Your neighborhood, connected",
  description:
    "Discover local businesses, find something you love, and start a conversation.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
