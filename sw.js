/* 이그니스 코트 · Service Worker
   전략: 앱 셸은 캐시 우선(빠른 실행), Supabase API는 항상 네트워크(최신 정원/참석 보장) */
const VERSION = 'ignis-v1';
const SHELL = [
  '/',
  '/index.html',
  '/pwa/manifest.webmanifest',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Supabase·외부 API: 네트워크 우선, 실패 시 캐시된 마지막 응답
  if (url.hostname.endsWith('supabase.co')) {
    e.respondWith(
      fetch(e.request)
        .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 앱 셸·정적 자산: 캐시 우선
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('/index.html')))
  );
});

// 푸시 알림 (대기승급 / 3번코트 확보 / 결산보고)
self.addEventListener('push', (e) => {
  let data = { title: '이그니스 코트', body: '새 알림이 있습니다', url: '/' };
  try { data = { ...data, ...e.data.json() }; } catch (err) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/pwa/icon-192.png',
    badge: '/pwa/icon-192.png',
    data: { url: data.url },
    vibrate: [40, 30, 40]
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(target); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
