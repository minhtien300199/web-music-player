# Nhật ký thay đổi

## Unreleased

### Added

- Tab Search trong popup: tìm video YouTube theo title, artist hoặc video bằng API key do người dùng tự cung cấp.
- Settings cho API key với mode session mặc định, mode local opt-in, test key và xoá key/search data.
- Cache search theo session, TTL tối đa 24 giờ và giới hạn 30 entry để giảm quota request lặp lại.
- Tính năng thử nghiệm mặc định tắt để nhập tối đa 20 video visible từ YouTube Home/watch khi chip đầu tiên được chọn có nhãn English **All** hoặc Vietnamese **Tất cả**.
- Danh sách import có Browse/Play/Remove/Refresh, metadata session-only, không thumbnail và được bind theo active tab/document/surface.
- Popup progress slider hỗ trợ pointer drag preview với một seek commit khi release, cùng Arrow/Page/Home/End keyboard controls.
- Các module background/content/popup/options/shared riêng cho message contract, storage, routing, search và queue.
- Tài liệu roadmap, architecture, coding standards và manual Chrome validation.

### Changed

- Popup có hai view Control/Search, có keyboard navigation giữa tabs và trạng thái search accessible.
- Thay API-derived Similar queue bằng explicit YouTube All DOM snapshot; adapter fail closed với locale/label khác và không tự click/scroll.
- Queue ưu tiên playlist thực trên YouTube/Spotify. Imported list là browse/play/remove UI; native Next/Previous không đổi.
- Remove chỉ tác động danh sách extension, không thay đổi YouTube recommendation/history/playlist/account.
- Search chỉ gọi API khi người dùng submit; YouTube All import không gọi Data API.

### Fixed

- Khắc phục Settings và các nút điều khiển YouTube trong popup bị lỗi do handler ID không khớp; background nhận Options mở trong tab bằng URL `chrome-extension://` nhưng vẫn từ chối content script và sender không tin cậy.
- Chuẩn hoá lệnh Next/Previous từ mini-player ghim ở tab khác để khớp protocol phía nhận.
- Đồng bộ trạng thái ghim player tới các tab web đủ điều kiện đang mở qua thay đổi storage.
- Dọn dẹp mini-player đầy đủ hơn: xoá refresh interval và drag listeners khi đóng.

### Security

- Không có YouTube API key dùng chung hay key thật trong repository.
- Key không được trả lại popup/content script sau khi lưu; background service worker giữ trách nhiệm gọi YouTube API.
- Mode local được ghi rõ không mã hóa; session mode là mặc định.

### Verification status

- Automated: 29/29 tests, 35/35 syntax checks, manifest/diff/security pass; review 9/10, 0 critical.
- Live Chrome/API/restriction/DOM validation vẫn pending theo [manual validation guide](manual-chrome-validation.md); Chrome automation bootstrap không khả dụng trong lần kiểm tra này.
- YouTube All feature phải giữ default-off cho đến khi [release checklist v1.0.0](release-checklist-v1-0-0.md) hoàn tất policy/disclosure review và manual matrix.
