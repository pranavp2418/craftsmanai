import type { Metadata, Viewport } from "next";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { ThemeProvider } from "@/lib/appearance-context";
import { ToastProvider } from "@/components/Toast";
import ReduxProvider from "@/redux/provider";
import RouteGuard from "@/components/RouteGuard";
import PushNotificationManager from "@/components/PushNotificationManager";
import RealtimeNotificationManager from "@/components/RealtimeNotificationManager";

const APP_NAME = "Craftsman AI";
const APP_DESCRIPTION =
  "AI-powered Jewelry design platform for retailers — generate CAD-styled renders, manage customer approvals, and coordinate manufacturer quotes.";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Jewelry Design Platform`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: "Craftsman AI" }],
  keywords: [
    "jewelry",
    "AI design",
    "CAD render",
    "B2B SaaS",
    "manufacturing",
  ],
  robots: {
    // Default to noindex until the product is publicly launched.
    // Flip to `index: true, follow: true` when you go live.
    index: false,
    follow: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — Jewelry Design Platform`,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Jewelry Design Platform`,
    description: APP_DESCRIPTION,
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "android-chrome",
        url: "/favicon/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        rel: "android-chrome",
        url: "/favicon/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F0F2F4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true} className="scroll-smooth">
      <head>
        {/* Anti-FOUC theme bootstrap — runs synchronously before paint so the
            saved theme is applied before React hydrates. Without this, users
            reloading the page in dark mode briefly see the light theme flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=window.location.pathname;if(!p.startsWith('/retailer')&&!p.startsWith('/manufacturer')&&!p.startsWith('/login')&&!p.startsWith('/signup')&&!p.startsWith('/new-login')&&!p.startsWith('/new-signup'))return;var t=localStorage.getItem('appearance:theme');if(!t)return;var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap"
        />
        <link rel="manifest" href="/favicon/site.webmanifest" />
      </head>
      <body className="antialiased font-inter">
        <ReduxProvider>
          <PushNotificationManager />
          <RealtimeNotificationManager />
          <ThemeProvider>
            <ToastProvider>
              <RouteGuard>
                <AppShell>{children}</AppShell>
              </RouteGuard>
            </ToastProvider>
          </ThemeProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
