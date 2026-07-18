"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMobileNav } from '@/components/AppShell';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { logoutUser, resetLogout } from '@/redux/slices/logout/logoutSlice';
import { getStoredUser } from '@/src/utils/auth';
import useNotifications from '@/src/hooks/useNotifications';
import { Bell } from 'lucide-react';

type StoredUser = {
  email?: string;
  username?: string;
  full_name?: string | null;
  user_id?: string | number;
  is_superuser?: boolean;
};

interface AppLayoutProps {
  appName?: string;
  headerTitle: string;
  headerDescription?: string;
  notificationCount?: number;
  onLogout?: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  appName,
  headerTitle,
  headerDescription,
  notificationCount,
  onLogout,
  children,
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-surface-page dark:bg-surface-page text-ink dark:text-ink">
      <InnerHeader headerTitle={headerTitle} headerDescription={headerDescription} onLogout={onLogout} />
      <main className="flex-1 overflow-auto bg-surface-page dark:bg-surface-page">
        <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1350px] mx-auto">{children}</div>
      </main>
    </div>
  );
};

function InnerHeader({ headerTitle, headerDescription, onLogout }: { headerTitle: string; headerDescription?: string; onLogout?: () => void }) {
  const { openDrawer } = useMobileNav();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isLoggingOut = useAppSelector((state) => state.logout.loading);
  const currentUser = useAppSelector((state) => state.login.user);
  const profileUser = useAppSelector((state) => state.retailerProfile.profileItem);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const storedUser = getStoredUser<StoredUser>();
  const userEmail = currentUser?.email ?? storedUser?.email ?? profileUser?.email ?? '';
  const userId = String(currentUser?.user_id ?? storedUser?.user_id ?? profileUser?.id ?? '');
  const role = (currentUser?.is_superuser ?? storedUser?.is_superuser ?? profileUser?.is_superuser) ? 'ADMIN' : undefined;
  const {
    notifications,
    unreadCount,
    connected,
    loaded,
    markAllRead,
    markRead,
  } = useNotifications({ role, userId: userId || undefined });
  const recentNotifications = useMemo(() => notifications.slice(0, 6), [notifications]);

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

  const formatNotificationTime = (value?: string) => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return value;
    }
  };

  const handleLogout = async () => {
    setProfileOpen(false);
    if (isLoggingOut) return;

    if (onLogout) {
      try {
        await dispatch(logoutUser()).unwrap();
      } catch {
        // Logout thunk already clears client state on failure.
      }
      onLogout();
      router.replace('/login');
      return;
    }

    try {
      await dispatch(logoutUser()).unwrap();
    } catch {
      // Logout thunk already clears client state on failure.
    }

    dispatch(resetLogout());
    router.replace('/login');
  };

  return (
    <header className="sticky top-0  border-b border-gray-200 dark:border-border-default bg-surface-page dark:bg-surface-page z-30">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={openDrawer} aria-label="Open navigation" className="touch-target rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors lg:hidden -ml-2">
                <i className="ri-menu-line text-heading text-ink-500 dark:text-[#A1A8B3]" />
            </button>
            <div>
              <h1 className="text-lg sm:text-2xl font-medium text-gray-900 dark:text-ink">{headerTitle}</h1>
              {headerDescription && (
                <p className="hidden md:inline text-sm sm:text-base text-gray-600 dark:text-ink-600">{headerDescription}</p>
              )}
            </div>
          </div>

          <div className="ml-4 flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="sm:relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  const nextOpen = !notifOpen;
                  setNotifOpen(nextOpen);
                  if (nextOpen) markAllRead();
                }}
                aria-label="Notifications"
                aria-expanded={notifOpen}
                className="w-8 h-8 touch-target rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative flex items-center justify-center"
              >
                  <Bell className="w-5 h-5 text-ink-500 dark:text-[#A1A8B3]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center font-medium">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-4 left-4 sm:left-auto sm:right-0 top-full mt-2 sm:w-[360px] bg-white dark:bg-surface-100 rounded-xl shadow-lg border border-default dark:border-border-default overflow-hidden z-50" role="menu">
                  <div className="px-4 pt-3 pb-2 border-b border-default dark:border-border-default">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-body-sm font-semibold text-ink dark:text-ink">Notifications</span>
                      <span className="text-[11px] text-ink-400">
                        {connected ? 'Live' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  <div className="max-h-[60vh] sm:max-h-[320px] overflow-y-auto">
                    {!loaded && recentNotifications.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-ink-500">Connecting to notifications...</div>
                    ) : recentNotifications.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-ink-500">No notifications</div>
                    ) : (
                      recentNotifications.map((notification) => {
                        const title = notification.title ?? notification.message ?? 'Notification';
                        const body = notification.body ?? notification.message ?? '';
                        return (
                          <button
                            key={notification.id ?? `${title}-${notification.created_at ?? ''}`}
                            type="button"
                            onClick={() => {
                              if (notification.id) markRead(notification.id);
                            }}
                            className={`w-full text-left px-4 py-3 border-b border-default dark:border-border-default last:border-b-0 hover:bg-surface-hover dark:hover:bg-white/5 transition-colors ${
                              notification.read ? 'opacity-80' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-ink dark:text-ink truncate">{title}</p>
                                {body && <p className="text-xs text-ink-500 dark:text-[#D1D5DB] mt-1 line-clamp-2">{body}</p>}
                              </div>
                              {!notification.read && (
                                <span className="mt-1 w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                              )}
                            </div>
                            {notification.created_at && (
                              <p className="text-[11px] text-ink-400 mt-2">{formatNotificationTime(notification.created_at)}</p>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={profileRef}>
              <button type="button" onClick={() => setProfileOpen(!profileOpen)} aria-label="Account menu" aria-expanded={profileOpen} className="touch-target rounded-full">
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="44" height="44" rx="12" fill="white" fillOpacity="0.39"/>
                  <g clipPath="url(#clip0_466_14627)">
                    <path d="M22 16C23.1 16 24 16.9 24 18C24 19.1 23.1 20 22 20C20.9 20 20 19.1 20 18C20 16.9 20.9 16 22 16ZM22 25C24.7 25 27.8 26.29 28 27V28H16V27.01C16.2 26.29 19.3 25 22 25ZM22 14C19.79 14 18 15.79 18 18C18 20.21 19.79 22 22 22C24.21 22 26 20.21 26 18C26 15.79 24.21 14 22 14ZM22 23C19.33 23 14 24.34 14 27V30H30V27C30 24.34 24.67 23 22 23Z" fill="#323232"/>
                  </g>
                  <defs>
                    <clipPath id="clip0_466_14627">
                      <rect width="24" height="24" fill="white" transform="translate(10 10)"/>
                    </clipPath>
                  </defs>
                </svg>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-[200px] bg-white dark:bg-surface-100 rounded-xl shadow-lg border border-default dark:border-border-default overflow-hidden z-50" role="menu">
                  <button type="button" onClick={goToUsagePlan} className="w-full  px-3.5 min-h-touch text-body-sm font-medium text-ink-700 dark:text-ink-700 hover:bg-surface-hover dark:hover:bg-white/5 transition-colors text-left border-b border-default dark:border-border-default" role="menuitem">
                    <h5>Admin User</h5>
                    <p className="text-xs font-normal text-ink-500 dark:text-[#D1D5DB] truncate">{userEmail}</p>
                  </button>
                  <Link href="/admin/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3.5 min-h-touch text-body-sm font-medium text-ink-700 dark:text-ink-700 hover:bg-surface-hover dark:hover:bg-white/5 transition-colors" role="menuitem">
                      <span className="w-[16px] h-[16px] flex items-center justify-center ri-settings-3-line text-ui dark:text-[#A1A8B3]" />
                    Settings
                  </Link>
                  
                  <div className="border-t border-default dark:border-border-default" />
                  <button type="button" onClick={handleLogout} disabled={isLoggingOut} className="w-full flex items-center gap-2.5 px-3.5 min-h-touch text-body-sm font-medium text-danger-bright hover:bg-surface-hover dark:hover:bg-white/5 transition-colors text-left" role="menuitem">
                      <span className="w-[16px] h-[16px] flex items-center justify-center ri-logout-box-r-line text-ui dark:text-[#A1A8B3]" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default AppLayout;
