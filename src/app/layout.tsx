import type { Metadata } from "next";
import { DM_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { AuthProvider } from "@/app/context/AuthContext";
import { RestaurantProvider } from "@/app/context/RestaurantContext";
import { TableProvider } from "@/app/context/TableContext";
import { PaymentProvider } from "@/app/context/PaymentContext";
import { GuestProvider } from "./context/GuestContext";
import { SocketProvider } from "./context/SocketContext";
import Script from "next/script";

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Even Tap & Pay",
  description: "Tu menú digital con un toque de NFC",
  icons: {
    icon: [
      {
        url: "/even/even-asterisk-evergreen.svg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/even/even-asterisk-grass.svg",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? undefined;
  void nonce;

  return (
    <html lang="es">
      <body
        className={`${dmMono.variable} ${jakarta.variable} antialiased`}
        style={{ fontFamily: "var(--font-dm-mono)" }}
      >
        <Script
          src="https://ecartpay.com/sdk/pay.js?v=2"
          strategy="afterInteractive"
        />
        <AuthProvider>
          <GuestProvider>
            <RestaurantProvider>
              <SocketProvider>
                <TableProvider>
                  <PaymentProvider>{children}</PaymentProvider>
                </TableProvider>
              </SocketProvider>
            </RestaurantProvider>
          </GuestProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
