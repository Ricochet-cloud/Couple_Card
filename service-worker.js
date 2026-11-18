// 서비스 워커: 한 번 받은 파일을 기기에 저장해 두고, 느리거나 오프라인일 때 꺼내 써요.
// 원칙: 코드(html/js/css/json)는 항상 서버 것을 먼저 쓰고(그래서 업데이트가 바로 반영돼요), 서버가 안 되거나 느릴 때만 저장본을 써요.
//       글꼴·이미지는 저장본을 먼저 보여주고 뒤에서 새로 받아 둬요. 파이어베이스 SDK 는 버전이 주소에 있어서 저장본을 그대로 써요.
//       Firestore/로그인 같은 API 요청, 음악 파일, GET 이 아닌 요청은 건드리지 않아요.
// 저장된 파일 내용을 바꾸고 싶을 땐 아래 VERSION 숫자만 올리면, 예전 저장본은 자동으로 지워져요.
const VERSION = 1;
const CACHE = `couplecard-v${VERSION}`;
const NETWORK_TIMEOUT_MS = 3000;
const SDK_PREFIX = 'https://www.gstatic.com/firebasejs/';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('couplecard-') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// 정상 응답(200, 내용을 읽을 수 있는 것)만 저장해요
function cacheable(res) {
  return res && res.status === 200 && (res.type === 'basic' || res.type === 'cors');
}

async function put(request, res) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, res);
  } catch (e) { /* 저장 공간이 없어도 사이트는 그대로 동작해요 */ }
}

// 서버 먼저 (HTTP 캐시에 묵은 파일이 있어도 서버에 확인), 실패하거나 느리면 저장본
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const fresh = fetch(new Request(request.url, { cache: 'no-cache', credentials: 'same-origin' })).then((res) => {
    if (cacheable(res)) put(request.url, res.clone());
    return res;
  });
  const cached = await cache.match(request.url, { ignoreSearch: request.mode === 'navigate' });
  if (!cached) return fresh;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS));
  return Promise.race([fresh.catch(() => cached), timeout]);
}

// 저장본 먼저, 뒤에서 새로 받아 두기 (브라우저가 들고 있는 묵은 사본이 아니라 서버에 확인해서 받아요)
async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request.url);
  const refresh = fetch(new Request(request.url, { cache: 'no-cache' })).then((res) => {
    if (cacheable(res)) put(request.url, res.clone());
    return res;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => {}));
    return cached;
  }
  return refresh;
}

// 저장본이 있으면 그대로, 없으면 받아서 저장
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  const res = await fetch(request);
  if (cacheable(res)) put(request.url, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return; // 음악 등 부분 요청은 브라우저에 맡겨요
  const url = new URL(request.url);

  if (request.url.startsWith(SDK_PREFIX)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin !== self.location.origin) return; // Firestore·로그인 등 다른 사이트 요청은 그대로

  const path = url.pathname;
  if (/\.(mp3|mp4|webm|ogg|wav)$/i.test(path)) return;
  if (/\.(woff2?|ttf|otf|png|jpe?g|gif|webp|svg|ico)$/i.test(path)) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }
  if (request.mode === 'navigate' || /\.(html|js|css|json)$/i.test(path)) {
    event.respondWith(networkFirst(request));
  }
});
