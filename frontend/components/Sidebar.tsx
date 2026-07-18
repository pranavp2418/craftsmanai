'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppearance } from '@/lib/appearance-context';

function NavJewelryConfigIcon(props: any) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M17.6988 7.62749C17.6766 7.79217 17.61 7.94771 17.5063 8.07749L10.7229 16.8075C10.5971 16.9658 10.4229 17.0792 10.2263 17.1292C10.0968 17.1607 9.96159 17.1607 9.83209 17.1292C9.61126 17.091 9.41204 16.9733 9.27209 16.7983L2.48875 8.07749C2.37156 7.92881 2.30327 7.74749 2.29327 7.55844C2.28327 7.36938 2.33206 7.18187 2.43292 7.02166L4.83792 3.27666L4.91125 3.18499C4.99655 3.08233 5.10324 2.99954 5.22386 2.9424C5.34448 2.88525 5.47612 2.85514 5.60959 2.85416H14.3846C14.4549 2.84516 14.526 2.84516 14.5963 2.85416C14.827 2.90848 15.0277 3.05005 15.1563 3.24916L17.5613 6.99416C17.6827 7.18149 17.7316 7.40668 17.6988 7.62749Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.8342 2.88171L13.1459 7.62755L10.2267 17.1192M9.83257 17.1292L6.48173 7.62755L8.16173 2.88171M2.2959 7.62755H17.6992H2.2959Z"
        fill="currentColor"
      />
      <path
        d="M11.8342 2.88171L13.1459 7.62755L10.2267 17.1192M9.83257 17.1292L6.48173 7.62755L8.16173 2.88171M2.2959 7.62755H17.6992"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const menuItems = [
  { label: 'Dashboard', href: '/retailer', icon: 'ri-layout-grid-line' },
  { label: 'Requests', href: '/retailer/requests', icon: 'ri-file-list-3-line' },
  { label: 'Customers', href: '/retailer/customers', icon: 'ri-user-3-line' },
  { label: 'Manufacturers', href: '/retailer/manufacturers', icon: 'ri-hammer-line' },
  { label: 'Analytics', href: '/retailer/analytics', icon: 'ri-line-chart-line' },
  { label: 'Usage & plan', href: '/retailer/settings#usage-plan', icon: 'ri-pie-chart-2-line' },
  // { label: 'Design Approval', href: '/design-approval/1', icon: 'ri-image-line' },
];

// Admin menu (uses same UI as retailer sidebar)
const adminMenuItems: Array<{ label: string; href: string; icon: string | any }> = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: 'ri-layout-grid-line' },
  { label: 'Customers', href: '/admin/customers', icon: 'ri-user-3-line' },
  { label: 'Manufacturers', href: '/admin/manufacturers', icon: 'ri-building-4-line' },
  { label: 'Retailers', href: '/admin/retailers', icon: 'ri-store-2-line' },
  { label: 'Subscriptions', href: '/admin/subscriptions', icon: 'ri-file-list-3-line' },
  // { label: 'Quiz Config', href: '/admin/quiz-config', icon: 'ri-questionnaire-line' },
  // { label: 'Jewellery Config', href: '/admin/jewelleryconfig', icon: NavJewelryConfigIcon },
  { label: 'Settings', href: '/admin/settings', icon: 'ri-settings-4-line' },
];

interface SidebarProps {
  /** Mobile drawer open state — controlled by AppShell. */
  drawerOpen: boolean;
  /** Called when the drawer should close (overlay tap, item click, Escape). */
  onDrawerClose: () => void;
  /** Ref callback from AppShell for ResizeObserver tracking. */
  shellRef?: (node: HTMLElement | null) => void;
}

export default function Sidebar({ drawerOpen, onDrawerClose, shellRef }: SidebarProps) {
  const pathname = usePathname();
  const { resolvedTheme } = useAppearance();
  const isDark = resolvedTheme === 'dark';

  // Desktop-only "collapsed rail" state. Ignored on mobile (where the
  // sidebar is always either fully off-canvas or fully on-canvas as a drawer).
  const [collapsed, setCollapsed] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const [currentHash, setCurrentHash] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);

    // Poll for changes to detect pushState/replaceState changes made by client router
    let lastHash = window.location.hash;
    const intervalId = setInterval(() => {
      if (window.location.hash !== lastHash) {
        lastHash = window.location.hash;
        setCurrentHash(lastHash);
      }
    }, 100);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
      clearInterval(intervalId);
    };
  }, [pathname]);

  // Choose which menu to render depending on route
  const effectiveMenu = pathname?.startsWith('/admin') ? adminMenuItems : menuItems;

  const isDesktopExpanded = !collapsed || hoverExpanded;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (hoverExpanded && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setHoverExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [hoverExpanded]);

  // const handleMouseEnter = useCallback(() => {
  //   if (collapsed) setHoverExpanded(true);
  // }, [collapsed]);

  // const handleMouseLeave = useCallback(() => {
  //   if (collapsed) setHoverExpanded(false);
  // }, [collapsed]);

  const [isBtnHovered, setIsBtnHovered] = useState(false);

  return (
    <>
      {/* Backdrop — only visible on mobile when drawer is open. */}
      <div
        onClick={onDrawerClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      />

      <aside
        ref={(node) => {
          (sidebarRef as React.MutableRefObject<HTMLElement | null>).current = node;
          shellRef?.(node);
        }}
        role="navigation"
        aria-label="Main navigation"
        className={[
          'h-screen flex flex-col fixed left-0 top-0 z-50 border-r border-default',
          // Slide-in transition for mobile drawer + width transition for desktop rail.
          'transition-[transform,width] duration-300 ease-out',
          // Mobile drawer width: min(260px, 80vw) for comfortable margin on 375px.
          // 'w-[min(260px,80vw)]',
          collapsed && !hoverExpanded ? 'lg:w-16' : 'lg:w-[220px]',
          'w-[min(260px,80vw)]',
          // Page background colour.
          'bg-surface-page',
          // Mobile: full drawer width (260px), slid off-canvas by default.
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop (lg+): always on-canvas; width is overridden via styled-jsx below.
          'lg:translate-x-0',
        ].join(' ')}
      // Desktop hover behaviour for the collapsed rail.
      // onMouseEnter={handleMouseEnter}
      // onMouseLeave={handleMouseLeave}
      >
        {/* Header row: logo + close (mobile) / collapse (desktop). */}
        <div className="flex items-center justify-between px-4 pt-5 pb-2 min-h-[60px]">
          {/* Logo — shown on mobile drawer and on expanded desktop. */}
          {(drawerOpen || isDesktopExpanded) && (
            <Link href={pathname?.startsWith('/admin') ? '/admin/dashboard' : '/retailer'}>
              <img
                src={isDark ? "/dark%20mode%20logo.png" : "/light%20mode%20logo.png"}
                alt="Craftsman AI"
                className="w-20 h-auto object-contain transition-opacity duration-300 cursor-pointer"
              />
            </Link>
          )}

          {/* Mobile: close button. Hidden on md+. */}
          <button
            type="button"
            onClick={onDrawerClose}
            aria-label="Close navigation"
            className="flex p-2 dark:bg-gray-800 dark:border-gray-600 bg-white border border-[#D1D5DB] touch-target hover:bg-black/5 transition-all duration-150 rounded-full md:hidden items-center justify-center ml-auto"
          >
            <i
              className={`ri-arrow-left-s-line w-3 h-3 text-heading-xs text-ink-500 flex items-center justify-center`}
            />
          </button>

          {/* Desktop: collapse toggle. Hidden below md. */}
          <button
            type="button"
            onClick={() => {
              onDrawerClose();
              setCollapsed(!collapsed);
              setHoverExpanded(false);
            }}
            onMouseEnter={() => setIsBtnHovered(true)}
            onMouseLeave={() => setIsBtnHovered(false)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className={`hidden touch-target transition-all duration-150 rounded-full md:flex items-center justify-center ml-auto ${
              collapsed && !isBtnHovered
                ? 'bg-transparent border-transparent p-0 w-8 h-8'
                : 'p-2 dark:bg-gray-800 bg-white border border-[#D1D5DB] dark:border-gray-600 hover:bg-black/5'
            }`}
          >
            {collapsed && !isBtnHovered ? (
              <img
                src="/logo_new.png"
                alt="Craftsman AI"
                className="w-5 h-5 object-contain flex-shrink-0"
              />
            ) : (
              <i
                className={`${collapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line'} w-3 h-3 text-heading-xs text-ink-500 flex items-center justify-center`}
              />
            )}
          </button>
        </div>

        {/* Nav items. */}
        <nav className="flex-1 px-2.5 flex flex-col gap-0.5 mt-2 overflow-y-auto z-50">
          {effectiveMenu.map((item) => {
            const [itemPath, itemHash] = item.href.split('#');
            const isActive =
              item.href === '/retailer'
                ? pathname === '/retailer'
                : (pathname === itemPath || pathname.startsWith(itemPath + '/')) &&
                  (!itemHash || currentHash === `#${itemHash}`);
            const showLabel =
              drawerOpen || isDesktopExpanded; /* show label on mobile drawer or expanded desktop */
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onDrawerClose}
                className={`flex items-center gap-3 px-3 py-2.5 min-h-touch rounded-xl text-body font-medium transition-all duration-150 whitespace-nowrap ${isActive ? 'text-brand bg-tint-brand' : 'text-ink-500 hover:text-ink'
                  }`}
                title={showLabel ? undefined : item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Icon: support both string classnames (remixicon) and React components */}
                {typeof item.icon === 'string' ? (
                  <span
                    className={`w-[18px] h-[18px] flex items-center justify-center ${item.icon} text-ui-lg flex-shrink-0`}
                  />
                ) : (
                  <span className="w-[18px] h-[18px] flex items-center justify-center text-ui-lg flex-shrink-0">
                    <item.icon />
                  </span>
                )}
                {showLabel && <span className="transition-opacity duration-300">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
