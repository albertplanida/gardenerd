import type { Metadata } from "next";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
