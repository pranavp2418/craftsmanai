// Service Worker for WebPush notifications - v3
// Place this file in your frontend's public/ directory for production use

// Activate immediately on install so the SW isn't stuck in "waiting" phase
self.addEventListener('install', function (event) {
    self.skipWaiting();
});

// Take control of all open pages immediately
self.addEventListener('activate', function (event) {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
    const data = event.data ? event.data.json() : {};
    console.log('[SW] Push received:', data.title);

    // Resolve relative URLs to absolute URLs so they are visible in notifications
    let iconUrl = '/logo_new.png';
    if (iconUrl.startsWith('/')) {
        iconUrl = self.location.origin + iconUrl;
    }
    let badgeUrl = '/logo_new.png';
    if (badgeUrl.startsWith('/')) {
        badgeUrl = self.location.origin + badgeUrl;
    }

    // Generate a unique tag for EVERY notification so they NEVER replace each other
    const uniqueTag = 'n-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    event.waitUntil(
        self.registration.showNotification(data.title || 'Notification', {
            body: data.body || '',
            icon: iconUrl,
            badge: badgeUrl,
            data: data.data || {},
            tag: uniqueTag,
            renotify: true   // Play sound/vibrate even with unique tag
        })
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (const client of clientList) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
