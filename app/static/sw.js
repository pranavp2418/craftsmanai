// Service Worker for WebPush notifications - v2
// Place this file in your frontend's public/ directory for production use

self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : {};
    console.log('[SW] Push received:', data.title);
    // Generate a unique tag for EVERY notification so they NEVER replace each other
    const uniqueTag = 'n-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    event.waitUntil(
        self.registration.showNotification(data.title || 'Notification', {
            body: data.body || '',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            data: data.data || {},
            tag: uniqueTag,
            renotify: true   // Play sound/vibrate even with unique tag
        })
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
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