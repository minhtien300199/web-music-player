# Chrome Music Control Extension – Kế hoạch triển khai

## 1. Mục tiêu

Tạo một **Chrome Extension** cho phép:

* ▶️ Play / ⏸ Pause
* ⏹ Stop
* ⏭ Next / ⏮ Previous (bài hát)
* ⏩ Skip +10 giây / ⏪ Back −10 giây
* 🎵 Hiển thị & **chọn bài hát từ danh sách nhạc (playlist)** nếu nguồn hỗ trợ

Extension ưu tiên hoạt động với:

* Các tab đang phát nhạc/video (HTML5 audio/video)
* Các nền tảng phổ biến: YouTube, Spotify Web, SoundCloud (qua Media Session API)

---

## 2. Phạm vi & Giả định

### In-scope

* Điều khiển media trong **tab hiện tại** hoặc **tab đang phát nhạc**
* UI popup đơn giản
* Không cần backend

### Out-of-scope (giai đoạn 1)

* DRM/native Spotify app
* Đồng bộ playlist giữa nhiều nền tảng
* Account/login

---

## 3. Kiến trúc tổng thể

```
Chrome Extension
├── manifest.json
├── popup.html
├── popup.js
├── popup.css
├── background.js (service worker)
├── content-script.js
└── icons/
```

### Thành phần

#### 1. Popup UI

* Nút điều khiển: Play/Pause, Stop, Next, Prev
* Nút: +10s / −10s
* Danh sách bài hát (nếu detect được playlist)

#### 2. Content Script

* Inject vào trang web
* Tương tác với:

  * `HTMLAudioElement`
  * `HTMLVideoElement`
  * `navigator.mediaSession`

#### 3. Background (Service Worker)

* Quản lý message giữa popup ↔ content-script
* Xác định tab nào đang phát media

---

## 4. Công nghệ & API sử dụng

### Chrome Extension APIs

* `chrome.tabs`
* `chrome.scripting`
* `chrome.runtime.sendMessage`

### Web APIs

* **Media Session API**

  ```js
  navigator.mediaSession.playbackState
  navigator.mediaSession.setActionHandler('nexttrack', fn)
  ```

* **HTML5 Media API**

  ```js
  audio.play()
  audio.pause()
  audio.currentTime += 10
  ```

---

## 5. Chi tiết tính năng

### 5.1 Play / Pause

Logic:

* Nếu `media.paused` → play
* Ngược lại → pause

### 5.2 Stop

* `media.pause()`
* `media.currentTime = 0`

### 5.3 Next / Previous Track

Ưu tiên thứ tự:

1. `navigator.mediaSession` action
2. Click DOM button (YouTube/Spotify selector)
3. Playlist index nội bộ (fallback)

### 5.4 Skip ±10 giây

```js
media.currentTime = Math.max(0, media.currentTime - 10)
media.currentTime = Math.min(media.duration, media.currentTime + 10)
```

### 5.5 Chọn bài hát từ danh sách (Playlist)

#### Cách 1: Media Session Metadata (ưu tiên)

* Đọc `navigator.mediaSession.metadata`
* Chỉ hiển thị bài hiện tại + basic info

#### Cách 2: DOM Scraping (per-site)

Ví dụ:

* YouTube: `.ytd-playlist-panel-video-renderer`
* Spotify Web: `[role="row"]`

Popup hiển thị:

* Title
* Artist
* Click → gửi message → trigger play bài đó

⚠️ Lưu ý: mỗi nền tảng cần **adapter riêng**

---

## 6. Message Flow

```
[Popup]
  ↓ sendMessage(action)
[Background]
  ↓ forward
[Content Script]
  ↓ control media
[Web Page]
```

---

## 7. Phân quyền (manifest.json)

```json
{
  "manifest_version": 3,
  "permissions": ["tabs", "scripting"],
  "host_permissions": ["<all_urls>"],
  "action": {
    "default_popup": "popup.html"
  }
}
```

---

## 8. UX/UI gợi ý

* Popup dạng compact (320x480)
* Icon:

  * ⏮ ⏯ ⏭
  * −10 | +10
* Playlist scrollable
* Highlight bài đang phát

---

## 9. Roadmap

### Phase 1 (MVP)

* Play/Pause
* Skip ±10s
* Detect audio/video element

### Phase 2

* Next/Prev track
* Media Session support

### Phase 3

* Playlist selection (YouTube, Spotify Web)
* Site adapter system

### Phase 4 (Optional)

* Global hotkeys
* Floating mini-player

---

## 10. Rủi ro & Lưu ý

* DOM thay đổi theo từng platform
* DRM hạn chế một số hành động
* Chrome policy về injected scripts

---

## 11. Kết luận

Extension này khả thi, **MVP có thể hoàn thành nhanh** nếu tập trung HTML5 Media + Media Session API trước. Playlist selection nên làm theo hướng **adapter per site** để dễ mở rộng.

---

📌 Nếu cần, có thể tách riêng file:

* `playlist-adapters/youtube.js`
* `playlist-adapters/spotify.js`

(End of document)
