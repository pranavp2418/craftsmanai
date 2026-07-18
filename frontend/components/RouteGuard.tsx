'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { getStoredUser } from '@/src/utils/auth';
import { fetchUserProfile } from '@/redux/slices/retailer/settings/profileSlice';

interface RouteGuardProps {
  children: React.ReactNode;
}

export default function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const dispatch = useAppDispatch();

  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const isInitialized = useAppSelector((state) => state.auth.isInitialized);
  const currentUser = useAppSelector((state) => state.login.user);
  const profileItem = useAppSelector((state) => state.retailerProfile.profileItem);
  const profileStatus = useAppSelector((state) => state.retailerProfile.profileStatus);

  const [showSpinner, setShowSpinner] = React.useState(false);

  useEffect(() => {
    if (isInitialized && accessToken) {
      const storedUser = getStoredUser<{ is_superuser?: boolean }>();
      const isSuperuser =
        currentUser?.is_superuser ??
        profileItem?.is_superuser ??
        storedUser?.is_superuser ??
        false;

      if (!isSuperuser && profileStatus === 'idle') {
        dispatch(fetchUserProfile());
      }
    }
  }, [isInitialized, accessToken, currentUser, profileItem, profileStatus, dispatch]);

  useEffect(() => {
    if (!isInitialized) {
      const hasSession = typeof window !== 'undefined' && window.localStorage.getItem('auth:hasSession') === 'true';
      if (!hasSession) {
        setShowSpinner(true);
      }
    } else {
      setShowSpinner(false);
    }
  }, [isInitialized]);

  const isAuthRoute =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/signup' ||
    pathname.startsWith('/signup/') ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/forgot-password/');

  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isRetailerRoute = pathname === '/retailer' || pathname.startsWith('/retailer/');
  
  const isPublicRoute =
    pathname === '/' ||
    isAuthRoute ||
    pathname.startsWith('/new-login') ||
    pathname.startsWith('/new-signup') ||
    pathname.startsWith('/customer/review') ||
    pathname.startsWith('/manufacturer/review') ||
    pathname.startsWith('/design-approval') ||
    pathname.startsWith('/payment-success') ||
    pathname.startsWith('/payment-failed') ||
    pathname.startsWith('/terms-and-conditions') ||
    pathname.startsWith('/privacy-policy');

  const isProtectedRoute = !isPublicRoute;

  useEffect(() => {
    if (!isInitialized) return;

    const storedUser = getStoredUser<{ is_superuser?: boolean }>();
    const hasRoleInfo = !!currentUser || !!profileItem || !!storedUser;

    // If the user has a session/token but we don't have role info yet,
    // wait for the profile to load before making routing decisions.
    if (accessToken && !hasRoleInfo && (profileStatus === 'idle' || profileStatus === 'loading')) {
      return;
    }

    const isSuperuser =
      currentUser?.is_superuser ??
      profileItem?.is_superuser ??
      storedUser?.is_superuser ??
      false;

    if (!accessToken) {
      // Unauthenticated users trying to access protected routes
      if (isProtectedRoute) {
        router.replace('/login');
      }
    } else {
      // Authenticated users
      if (isSuperuser) {
        // Admins blocked from retailer routes or auth routes
        if (isRetailerRoute || isAuthRoute) {
          router.replace('/admin/dashboard');
        }
      } else {
        // Retailers blocked from admin routes or auth routes
        if (isAdminRoute || isAuthRoute) {
          router.replace('/retailer');
        }
      }
    }
  }, [isInitialized, accessToken, currentUser, profileItem, profileStatus, pathname, isProtectedRoute, isRetailerRoute, isAuthRoute, isAdminRoute, router]);

  const storedUser = getStoredUser<{ is_superuser?: boolean }>();
  const hasRoleInfo = !!currentUser || !!profileItem || !!storedUser;
  const isProfileLoading = accessToken && !hasRoleInfo && (profileStatus === 'idle' || profileStatus === 'loading');

  const shouldBlockRender = isProtectedRoute && (!isInitialized || isProfileLoading || showSpinner);

  if (shouldBlockRender) {
    return null;
  }

  // Prevent flash of protected/incorrect content before transition starts
  if (isInitialized) {
    const isSuperuser =
      currentUser?.is_superuser ??
      profileItem?.is_superuser ??
      storedUser?.is_superuser ??
      false;

    if (!accessToken && isProtectedRoute) {
      return null;
    }
    if (accessToken) {
      if (isSuperuser && (isRetailerRoute || isAuthRoute)) {
        return null;
      }
      if (!isSuperuser && (isAdminRoute || isAuthRoute)) {
        return null;
      }
    }
  }

  return <>{children}</>;
}
