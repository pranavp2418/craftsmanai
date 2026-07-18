import axiosInstance from '@/src/utils/hooks/axios';

/**
 * Converts a base64 string to a Uint8Array.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the push subscription by obtaining the public VAPID key
 * from the backend, subscribing via the browser Push API, and sending
 * the subscription details to the backend.
 */
export async function registerPushSubscription(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Service Worker or Push Manager not supported in this browser.');
    return;
  }

  try {
    // 1. Get VAPID public key from backend
    const resp = await axiosInstance.get('/api/v2/push-subscriptions/vapid-public-key');
    const publicKey = resp.data?.public_key;
    if (!publicKey) {
      throw new Error('No public key returned from backend.');
    }

    // 2. Register Service Worker and subscribe
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const sub = subscription.toJSON();
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      throw new Error('Subscription structure is invalid or incomplete.');
    }

    // 3. Register with backend
    await axiosInstance.post('/api/v2/push-subscriptions/', {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      device_type: 'chrome',
    });

    console.log('[Push] Subscription registered successfully.');
  } catch (error) {
    console.error('[Push] Error subscribing to push notifications:', error);
    throw error;
  }
}

/**
 * Retrieves the current push subscription, deletes it from the backend,
 * and unsubscribes the browser push manager.
 */
export async function unsubscribePushNotification(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;

      // Delete on backend
      try {
        await axiosInstance.delete(`/api/v2/push-subscriptions/${encodeURIComponent(endpoint)}`);
      } catch (err) {
        console.warn('[Push] Failed to delete subscription on backend:', err);
      }

      // Unsubscribe on browser
      await subscription.unsubscribe();
      console.log('[Push] Unsubscribed successfully.');
    }
  } catch (error) {
    console.error('[Push] Error unsubscribing from push notifications:', error);
    throw error;
  }
}
