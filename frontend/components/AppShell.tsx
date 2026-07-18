'use client';

import Sidebar from './Sidebar';
import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { usePathname } from 'next/navigation';

/**
 * MobileNavContext
 * -----------------
 * Lets any descendant (notably TopBar) open/close the mobile sidebar drawer
 * without prop-drilling. The desktop sidebar collapse state lives separately
 * because they have different semantics:
 *   - Desktop: collapsed = 64px rail, expanded = 220px
 *   - Mobile:  drawer is fully off-canvas or fully on-canvas (overlay)
 */
interface MobileNavContextValue {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function useMobileNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext);
  if (!ctx) {
    throw new Error('useMobileNav must be used inside <AppShell>');
  }
  return ctx;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isLanding = pathname === '/';
  const hideNav =
    isLanding ||
    pathname.startsWith('/customer/review') ||
    pathname.startsWith('/manufacturer/review') ||
    pathname.startsWith('/design-approval') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/new-login') ||
    pathname.startsWith('/new-signup') ||
    pathname.startsWith('/payment-success') ||
    pathname.startsWith('/payment-failed') ||
    pathname.startsWith('/terms-and-conditions') ||
    pathname.startsWith('/privacy-policy');

  // Track desktop sidebar width for left margin on the main content.
  // Uses ResizeObserver instead of polling for better performance.
  const sidebarRef = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSidebarCollapsed((entry.target as HTMLElement).offsetWidth <= 64);
      }
    });
    observer.observe(node);
    // Set initial value
    setSidebarCollapsed(node.offsetWidth <= 64);
    return () => observer.disconnect();
  }, []);

  // Close the drawer when the route changes — common mobile-nav UX.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent body scroll while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [drawerOpen]);

  // Close drawer on Escape — accessibility.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setDrawerOpen((v) => !v), []);

  if (hideNav) {
    return (
      <MobileNavContext.Provider value={{ drawerOpen, openDrawer, closeDrawer, toggleDrawer }}>
        {children}
      </MobileNavContext.Provider>
    );
  }

  const mainBaseClasses = hideNav
    ? 'flex-1 min-h-screen overflow-visible'
    : 'flex-1 h-screen min-h-screen overflow-y-auto';

  return (
    <MobileNavContext.Provider value={{ drawerOpen, openDrawer, closeDrawer, toggleDrawer }}>
      <div className={`flex min-h-screen bg-surface-page ${hideNav ? 'bg-surface-page-alt' : 'bg-surface-page'}`}>
        {!hideNav && <Sidebar drawerOpen={drawerOpen} onDrawerClose={closeDrawer} shellRef={sidebarRef} />}
        <main
          // Safe-area insets ensure content clears the iPhone notch / Dynamic
          // Island at the top and the home-indicator bar at the bottom. The
          // env() values fall back to 0 on devices without insets, so this is
          // a no-op on desktop and most Android. The CSS vars below come from
          // tailwind's `pt-safe` / `pb-safe-bottom` utilities (defined in the
          // spacing scale in tailwind.config.js).
          className={`${mainBaseClasses} transition-[margin] duration-300 ease-out pt-safe pb-safe-bottom  ${
            hideNav
              ? ''
              : // On mobile (< lg): no left margin, sidebar is an overlay drawer.
                // On desktop (lg+): margin matches sidebar's expanded/collapsed width.
                sidebarCollapsed
                ? 'ml-0 lg:ml-[64px]'
                : 'ml-0 lg:ml-[220px]'
          }`}
        >
          {children}
        </main>
      </div>
    </MobileNavContext.Provider>
  );
}
