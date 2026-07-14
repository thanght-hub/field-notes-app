// Service worker thủ công cho Field Notes (mục 3.1 / kiến trúc 1.2).
// Chiến lược: stale-while-revalidate cho "app shell" (tài nguyên tĩnh: HTML điều hướng, CSS, JS, icon).
// KHÔNG cache bất kỳ request nào tới API động (transcript, audio, .../api/*) — dữ liệu này luôn phải mới nhất
// và một phần được cố tình xử lý ngoại tuyến bởi IndexedDB + hàng đợi đồng bộ ở tầng ứng dụng, không phải SW.

const APP_SHELL_CACHE = "field-notes-app-shell-v1";

// Danh sách tối thiểu cần có sẵn ngay cả khi mở ứng dụng lần đầu không có mạng.
// Next.js sinh thêm nhiều file JS/CSS có hash động — các file đó được cache "on the fly"
// theo chiến lược runtime bên dưới, không cần liệt kê trước ở đây.
const PRECACHE_URLS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        // Không chặn cài đặt SW nếu precache lỗi (vd offline lần đầu) — runtime cache sẽ bù lại.
      }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  // Không cache bất kỳ request nào hướng tới backend API (cùng-origin dạng /api/, /auth/,
  // hoặc origin khác được cấu hình qua NEXT_PUBLIC_API_BASE_URL).
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.origin !== self.location.origin
  );
}

function isAppShellRequest(request, url) {
  if (request.method !== "GET") return false;
  if (isApiRequest(url)) return false;
  // Trang điều hướng (App Router) hoặc tài nguyên tĩnh Next.js (_next/static, icons, css...).
  return (
    request.mode === "navigate" ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!isAppShellRequest(request, url)) {
    // Để trình duyệt xử lý bình thường (không can thiệp) — bao gồm mọi gọi API động.
    return;
  }

  event.respondWith(
    caches.open(APP_SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => undefined);

      // stale-while-revalidate: trả cache ngay nếu có, đồng thời âm thầm cập nhật từ mạng.
      return cached || (await networkFetch) || Response.error();
    }),
  );
});
