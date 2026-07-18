'use client';

import { useEffect, useRef } from 'react';
import { useAppSelector } from '@/redux/hooks';
import { registerPushSubscription } from '@/lib/pushNotifications';

export default function PushNotificationManager() {
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const hasSyncedRef = useRef(false);

  // 1. Register service worker on app load
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[ServiceWorker] Registered successfully with scope:', reg.scope);
        })
        .catch((err) => {
          console.error('[ServiceWorker] Registration failed:', err);
        });
    }
  }, []);

  // 2. Automatically sync subscription if permission is already granted and user is logged in
  useEffect(() => {
    if (accessToken && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        if (hasSyncedRef.current) return;
        hasSyncedRef.current = true;
        registerPushSubscription().catch((err) => {
          console.error('[PushManager] Failed to auto-sync subscription:', err);
          hasSyncedRef.current = false; // Reset on error to allow retrying
        });
      }
    } else if (!accessToken) {
      hasSyncedRef.current = false;
    }
  }, [accessToken]);

  return null;
}
