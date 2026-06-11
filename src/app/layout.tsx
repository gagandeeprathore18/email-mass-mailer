import "./globals.css";
import React from "react";

export const metadata = {
  title: "MailPulse - Mass Mailer Infrastructure",
  description: "Manage your high-performance delivery tunnels and ensure your outbound mail remains reliable across global nodes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-bg-main text-text-main transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
