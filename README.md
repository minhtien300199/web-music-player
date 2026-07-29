# Music Control

Chrome extension điều khiển audio/video trên các tab web, có mini-player ghim, YouTube search bằng API key của chính người dùng, và tùy chọn nhập video đang hiển thị trong YouTube **All/Tất cả**.

## Cài đặt

1. Mở `chrome://extensions/` và bật **Developer mode**.
2. Chọn **Load unpacked** rồi chọn thư mục chứa `manifest.json`.
3. Mở một trang có media, bấm biểu tượng Music Control, rồi dùng tab **Control** hoặc **Search**.

Chrome không cho content script chạy trên các trang nội bộ như `chrome://`; các trang đó không được hỗ trợ.

## Điều khiển và queue

- Play/Pause, Stop, tua ±10 giây, âm lượng, Next/Previous và mini-player ghim hoạt động trên các trang media được cấu hình.
- Với YouTube/Spotify có playlist đang hiển thị, mục **Playlist** ưu tiên danh sách playlist đó.
- Khi không có playlist, tính năng thử nghiệm có thể nhập tối đa 20 video đang hiển thị từ chip **All/Tất cả** của tab YouTube đang active.
- Chọn một mục đã nhập hoặc một kết quả Search sẽ mở đúng video đó trong tab YouTube phù hợp.
- Next/Previous luôn dùng điều khiển native của website. Danh sách đã nhập không thay đổi nút transport hay thuật toán autoplay của YouTube.

| Nguồn | Điều khiển media | Playlist | All import/Search |
| --- | --- | --- | --- |
| YouTube | Có | Playlist hiển thị trên trang | Có, với API key riêng |
| Spotify Web | Có | Playlist hiển thị trên trang | Không |
| SoundCloud | Có | Không | Không |
| HTML5 audio/video | Có | Không | Không |

YouTube được bật sẵn. Bật Spotify, SoundCloud hoặc Other websites trong Settings trước khi điều khiển các nguồn đó.

`<all_urls>` vẫn được giữ trong manifest để tính năng điều khiển media tổng quát tiếp tục hoạt động trên mọi website mà người dùng chọn; đây không phải quyền chỉ dành cho YouTube.

## YouTube All suggestions (thử nghiệm)

Tính năng này **tắt mặc định** và không dùng YouTube Data API:

1. Trong Settings, bật **Show YouTube All suggestions in the popup** rồi lưu.
2. Mở YouTube Home hoặc trang watch trong tab đang active và chọn chip đầu tiên có nhãn **All** hoặc **Tất cả**.
3. Trong popup Control, bấm **Import from YouTube All**. Có thể Browse, Play, Remove hoặc Refresh danh sách.

Adapter chỉ nhận nhãn tiếng Anh `All` và tiếng Việt `Tất cả`. Mọi locale/nhãn khác fail closed: không nhập dữ liệu, không đoán theo vị trí chip. Extension không tự click chip, tự scroll, đọc account identity/cookie hay gọi endpoint YouTube không công khai.

Snapshot chỉ chứa video ID, title, channel và metadata kiểm tra context; **không lưu thumbnail**. Danh sách, item đã Remove và metadata điều hướng chỉ nằm trong `chrome.storage.session`, bị giới hạn theo tab/document/surface và mất khi browser/extension session kết thúc. Setting bật/tắt có thể được lưu, nhưng dữ liệu video không được chuyển sang local storage.

**Remove** chỉ ẩn item khỏi danh sách của extension trên cùng snapshot. Nó không xoá hoặc thay đổi YouTube recommendations, history, playlist hay tài khoản. Play item giữ danh sách qua đúng navigation do extension khởi tạo; navigation không liên quan làm danh sách stale bị xoá.

Do phụ thuộc DOM hiển thị của YouTube, tính năng vẫn phải giữ default-off cho đến khi policy/disclosure review và [manual Chrome matrix](docs/manual-chrome-validation.md) pass.

## Thiết lập YouTube Search (BYOK)

Search không có key dùng chung. Mỗi người dùng tự tạo và tự quản lý API key của mình:

1. [Tạo hoặc chọn Google Cloud project](https://console.cloud.google.com/projectcreate), rồi [bật YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com).
2. [Tạo API key](https://console.cloud.google.com/apis/credentials) và giới hạn key cho API này.
3. Mở **Settings** của extension, dán key, chọn cách lưu rồi **Test key** và **Save API key**.
4. Dùng **Forget key & search data** khi không còn cần key hoặc trước khi chia sẻ máy/profile.

Nên dùng một key riêng cho extension và xoay (rotate) key nếu nghi bị lộ. Kiểm tra các giới hạn ứng dụng của Google Cloud trong profile Chrome thực tế trước khi dựa vào chúng: extension gửi request từ service worker và tài liệu này không khẳng định một kiểu application restriction cụ thể sẽ luôn hoạt động.

### Lưu key và giới hạn bảo mật

Mặc định **Use for this session** lưu key trong `chrome.storage.session`. Key mất khi Chrome hoặc extension được khởi động lại/tải lại. Chọn **Remember on this device** chỉ khi chấp nhận rủi ro: mode này dùng `chrome.storage.local`, không được mã hóa và không phải secret vault.

Không có tuỳ chọn đọc key từ một đường dẫn hay file local arbitrary. File plaintext không làm key an toàn hơn, dễ bị copy/commit nhầm, và extension không nên có quyền đọc filesystem rộng. Không đặt key thật trong source, `.env`, ảnh chụp màn hình, logs, issue hoặc commit. Repository không chứa key.

## Search, cache và quota

- Search chỉ chạy khi bạn submit form; mở popup, chuyển tab Search và gõ không gọi YouTube API.
- Kết quả cùng truy vấn/ngôn ngữ được cache tối đa 24 giờ trong session hiện tại, tối đa 30 entry. Khởi động lại Chrome/extension sẽ xoá cache session.
- Test key là một request riêng. Các lỗi key, quota hoặc mạng được trả về UI mà không hiển thị key.

YouTube All import là luồng DOM riêng và không gọi YouTube Data API; nó không dùng quota Search.

## Seek trong popup

- Kéo thanh progress bằng chuột/pointer để preview; extension chỉ commit một lần khi thả.
- Pointer cancel hoặc mất capture khôi phục thời gian media đã xác nhận, không seek.
- Keyboard: Arrow Left/Down `-5s`, Arrow Right/Up `+5s`, Page Down `-30s`, Page Up `+30s`, Home về đầu, End tới cuối.
- Media không có duration hữu hạn sẽ để slider disabled và không commit seek.

YouTube Data API có quota theo Google Cloud project; giới hạn có thể thay đổi theo project/chính sách. Theo dõi quota trong Google Cloud Console và tránh submit lặp lại. Tham khảo [quota and compliance guidance](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits) và [YouTube API policies](https://developers.google.com/youtube/terms/developer-policies).

## Phát triển và kiểm tra

Mã nguồn được chia theo trách nhiệm:

```text
background/  API key, search cache/service, routing tab
content/     media provider, queue DOM, mini-player
popup/       Control/Search UI
options/     cài đặt và API-key UI
shared/      message contracts và ranking
tests/       Node regression/unit tests
```

Chạy các test không dùng API key thật hoặc request YouTube thật:

```powershell
node --test tests/*.test.js
```

Automated validation hiện ghi nhận 29/29 tests, 35/35 syntax checks, manifest/diff/security checks pass, và review 9/10 với 0 critical. Xem [release checklist v1.0.0](docs/release-checklist-v1-0-0.md) và [manual Chrome validation](docs/manual-chrome-validation.md) trước khi phát hành. Live Chrome matrix vẫn pending vì Chrome automation bootstrap không khả dụng; các số automated không thay thế kiểm tra browser thật.

## License

MIT
