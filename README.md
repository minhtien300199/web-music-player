# 🎵 Music Control - Chrome Extension

Chrome Extension để điều khiển nhạc/video trên bất kỳ tab nào.

## Tính năng

- ▶️ **Play / Pause** - Phát hoặc tạm dừng media
- ⏹ **Stop** - Dừng và reset về đầu
- ⏭ **Next / ⏮ Previous** - Chuyển bài (hỗ trợ YouTube, Spotify, SoundCloud)
- ⏩ **+10s / ⏪ -10s** - Tua nhanh/lùi 10 giây
- 🔊 **Volume Control** - Điều chỉnh âm lượng bằng slider hoặc click mute
- 🎵 **Playlist** - Hiển thị và chọn bài từ playlist (YouTube, Spotify)
- 📌 **Floating Mini-Player** - Pin player nhỏ gọn trên trang web, có thể kéo thả

## Cài đặt

### Bước 1: Mở Chrome Extensions
1. Mở Chrome
2. Truy cập `chrome://extensions/`
3. Bật **Developer mode** (góc trên bên phải)

### Bước 2: Load Extension
1. Click **"Load unpacked"**
2. Chọn thư mục `youtube-list` (thư mục chứa file `manifest.json`)
3. Extension sẽ xuất hiện trong danh sách

### Bước 3: Sử dụng
1. Mở một trang có media (YouTube, Spotify Web, SoundCloud, hoặc bất kỳ trang nào có audio/video)
2. Click icon extension trên toolbar
3. Sử dụng các nút điều khiển
4. **Tính năng:**
   - **Seek**: Click vào progress bar (popup hoặc mini-player) để jump đến vị trí bất kỳ
   - **Volume**: Điều chỉnh bằng slider hoặc click icon 🔊 để mute/unmute
   - **Pin Player**: Click **"📌 Pin Player"** để bật floating mini-player trên trang web
   - Mini-player có thể kéo thả đến vị trí bất kỳ
   - Mini-player tự động hiện lại khi bạn reload hoặc đổi tab (persistent)
   - Extension tự động nhận biết tab đang phát nhạc, ngay cả khi bạn chuyển tab

## Cấu trúc thư mục

```
youtube-list/
├── manifest.json        # Cấu hình extension
├── popup.html           # Giao diện popup
├── popup.css            # Styles
├── popup.js             # Logic popup
├── background.js        # Service worker
├── content-script.js    # Script inject vào trang web
├── icons/               # Icons extension
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── plan.md              # Kế hoạch phát triển
└── README.md            # File này
```

## Hỗ trợ nền tảng

| Nền tảng | Play/Pause | Stop | Next/Prev | Skip ±10s | Playlist |
|----------|------------|------|-----------|-----------|----------|
| YouTube | ✅ | ✅ | ✅ | ✅ | ✅ |
| Spotify Web | ✅ | ✅ | ✅ | ✅ | ✅ |
| SoundCloud | ✅ | ✅ | ✅ | ✅ | ❌ |
| HTML5 Audio/Video | ✅ | ✅ | ❌ | ✅ | ❌ |

## Phát triển

Extension sử dụng:
- **Manifest V3** - Chrome Extension API mới nhất
- **Media Session API** - Để lấy thông tin media
- **DOM Scraping** - Để lấy playlist từ các nền tảng cụ thể

## License

MIT
