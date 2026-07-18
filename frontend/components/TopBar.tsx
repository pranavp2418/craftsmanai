'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMobileNav } from './AppShell';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { logoutUser, resetLogout } from '@/redux/slices/logout/logoutSlice';
import useNotifications from '@/src/hooks/useNotifications';

const PAGE_TITLES: Record<string, string> = {
  '/retailer': 'Dashboard',
  '/retailer/requests': 'Request Details',
  '/retailer/customers': 'Customers',
  '/retailer/manufacturers': 'Manufacturers',
  '/retailer/analytics': 'Analytics',
  '/retailer/settings': 'Settings',
  '/retailer/sketch': 'Sketch',

  '/admin': 'Dashboard',
  '/admin/dashboard': 'Dashboard',
  '/admin/customers': 'Customers',
  '/admin/manufacturers': 'Manufacturers',
  '/admin/retailers': 'Retailers',
  '/admin/settings': 'Settings',
  '/admin/subscriptions': 'Subscriptions',
  '/admin/jewelleryconfig': 'Jewellery Config',
  '/admin/quiz-config': 'Quiz Config',
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const basePath = `/${pathname.split('/').filter(Boolean).slice(0, 2).join('/')}`;
  const title = PAGE_TITLES[pathname] || PAGE_TITLES[basePath] || 'Dashboard';
  const { openDrawer } = useMobileNav();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.login.user);
  const profileUser = useAppSelector((state) => state.retailerProfile.profileItem);
  const userId = user?.user_id ?? profileUser?.id;
  const isLoggingOut = useAppSelector((state) => state.logout.loading);

  const {
    notifications,
    unreadCount,
    loaded,
    markAllRead,
    markRead,
  } = useNotifications({ userId: userId ? String(userId) : undefined });

  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isLoading = !loaded && notifications.length === 0;

  const getTitle = (item: any) => item?.title || item?.message || item?.body || 'Notification';
  const getBody = (item: any) => {
    if (item?.title) return item?.body || item?.message || '';
    return item?.body || '';
  };
  const getSourceLabel = (item: any) => item?.source || item?.notification_source || item?.source_type || '';
  const getTypeLabel = (value: any) => {
    if (!value) return '';
    return String(value)
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  };
  const getTimeLabel = (item: any) => {
    const value = item?.created_at || item?.createdAt || item?.timestamp;
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const ShimmerRow = () => (
    <div className="px-4 py-3 border-b border-default dark:border-border-default last:border-b-0">
      <div className="flex items-start gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-transparent mt-1.5 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 rounded-card skeleton-shimmer" />
          <div className="h-3 w-48 rounded-card skeleton-shimmer" />
          <div className="h-2 w-20 rounded-card skeleton-shimmer" />
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const initials = (() => {
    if (profileUser) {
      const first = profileUser.first_name || '';
      const last = profileUser.last_name || '';
      if (first || last) {
        return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
      }
      return '';
    }

    const source = user?.full_name || user?.username || '';
    if (!source) return '';

    const parts = source
      .replace(/[@._-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
  })();
  const visibleInitials = mounted ? initials : '';

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goToUsagePlan = () => {
    setProfileOpen(false);
    router.push('/retailer/settings#usage-plan');
  };

  const handleLogout = async () => {
    setProfileOpen(false);
    const result = await dispatch(logoutUser());
    if (logoutUser.fulfilled.match(result) || logoutUser.rejected.match(result)) {
      dispatch(resetLogout());
      router.push('/login');
    }
  };

  const handleNotifToggle = () => {
    const nextOpen = !notifOpen;
    setNotifOpen(nextOpen);
    if (nextOpen && unreadCount > 0) {
      markAllRead();
    }
  };

  return (
    <div className="sticky top-0 z-sticky-header flex items-center justify-between px-4 sm:px-6 lg:px-8 pt-4 lg:pt-5 pb-3 border-b border-default dark:border-border-default gap-2 bg-surface-page dark:bg-surface-page text-ink dark:text-ink">
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile-only hamburger — opens the sidebar drawer. */}
        <button
          type="button"
          onClick={openDrawer}
          aria-label="Open navigation"
          className="touch-target rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors lg:hidden -ml-2"
        >
            <i className="ri-menu-line text-heading text-ink-500 dark:text-[#A1A8B3" />
        </button>

        <span
          className="text-ui font-semibold text-ink dark:text-[#E7EAEE] truncate font-satoshi">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={handleNotifToggle}
            aria-label="Notifications"
            aria-expanded={notifOpen}
            className="w-9 h-9 touch-target rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative flex items-center justify-center"
          >
              <i className="ri-notification-3-line text-xl text-ink-500 dark:text-[#A1A8B3 mb-1 ml-1" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-brand rounded-full ring-1 ring-white dark:ring-border-default" />
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-[-40px] sm:right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[360px] bg-white dark:bg-surface-100 rounded-xl shadow-lg border border-default dark:border-border-default overflow-hidden z-50"
              role="menu"
            >
              <div className="px-4 pt-3 pb-2 border-b border-default dark:border-border-default">
                <span className="text-body-sm font-semibold text-ink dark:text-ink">Notifications</span>
              </div>
              <div className="max-h-[60vh] sm:max-h-[280px] overflow-y-auto">
                {isLoading && (
                  <>
                    <ShimmerRow />
                    <ShimmerRow />
                    <ShimmerRow />
                  </>
                )}
                {!isLoading && notifications.length === 0 && (
                  <div className="px-4 py-3 text-label-sm text-ink-500 dark:text-[#D1D5DB]">No notifications yet.</div>
                )}
                {!isLoading && notifications.map((n, index) => (
                  <div
                    key={n.id ?? `notif-${index}`}
                    onClick={() => n.id && markRead(String(n.id))}
                    className="px-4 py-3 border-b border-default dark:border-border-default last:border-b-0 hover:bg-surface-hover dark:hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="w-1.5 h-1.5 bg-brand rounded-full mt-1.5 shrink-0" />}
                      {n.read && <span className="w-1.5 h-1.5 bg-transparent rounded-full mt-1.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-label-md font-semibold text-ink dark:text-ink leading-tight">
                          {getTitle(n)}
                        </p>
                        {getBody(n) && (
                          <p className="text-label-sm text-ink-500 dark:text-[#D1D5DB] mt-1 leading-normal break-words">
                            {getBody(n)}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-label-xs text-ink-400 dark:text-[#A1A8B3] mt-2 gap-2">
                          <span className="shrink-0">{getTimeLabel(n)}</span>
                          {n.type && (
                            <span className="inline-flex items-center rounded-full bg-surface-hover dark:bg-white/5 px-2 py-0.5 font-medium truncate max-w-[150px]" title={getTypeLabel(n.type)}>
                              {getTypeLabel(n.type)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-label="Account menu"
            aria-expanded={profileOpen}
            className="touch-target rounded-full"
          >
            <span
              className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white dark:ring-border-default shadow-sm bg-gradient-indigo flex items-center justify-center text-[11px] font-bold text-white uppercase relative"
              suppressHydrationWarning
            >
              {profileUser?.profile_picture_url ? (
                <img
                  src={profileUser.profile_picture_url}
                  alt={profileUser.full_name || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                visibleInitials
              )}
            </span>
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-[200px] bg-white dark:bg-surface-100 rounded-xl shadow-lg border border-default dark:border-border-default overflow-hidden z-50"
              role="menu"
            >
              <Link
                href="/retailer/settings"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 px-3.5 min-h-touch text-body-sm font-medium text-ink-700 dark:text-ink-700 hover:bg-surface-hover dark:hover:bg-white/5 transition-colors"
                role="menuitem"
              >
                  <span className="w-[16px] h-[16px] flex items-center justify-center ri-settings-3-line text-ui dark:text-[#A1A8B3" />
                Settings
              </Link>
              <button
                type="button"
                onClick={goToUsagePlan}
                className="w-full flex items-center gap-2.5 px-3.5 min-h-touch text-body-sm font-medium text-ink-700 dark:text-ink-700 hover:bg-surface-hover dark:hover:bg-white/5 transition-colors text-left"
                role="menuitem"
              >
                  <span className="w-[16px] h-[16px] flex items-center justify-center ri-pie-chart-2-line text-ui dark:text-[#A1A8B3" />
                Usage &amp; plan
              </button>
              <div className="border-t border-default dark:border-border-default" />
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-2.5 px-3.5 min-h-touch text-body-sm font-medium text-danger-bright hover:bg-surface-hover dark:hover:bg-white/5 transition-colors text-left"
                role="menuitem"
              >
                  <span className="w-[16px] h-[16px] flex items-center justify-center ri-logout-box-r-line text-ui dark:text-[#A1A8B3" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
