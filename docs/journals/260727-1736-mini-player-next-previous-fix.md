---
title: Sửa Next và Previous của mini-player ghim
date: 2026-07-27
status: completed
---

## Context

Nút Next và Previous trên mini-player ghim không điều khiển được playlist ở tab phát hiện tại.

## Root cause

Mini-player từ xa gửi tên command khác với protocol mà content script phía nhận xử lý, nên message bị bỏ qua.

## Decision

Chuẩn hoá command Next/Previous của mini-player từ xa theo đúng tên protocol phía nhận đang dùng. Nếu tab hiện tại có media thật thì giữ điều khiển local; tab nguồn không có media sẽ chuyển lệnh tới tab media đã chọn.

## Verification

Đã pass 5 Node tests. Vẫn cần xác minh trực tiếp trên trình duyệt với tab phát và tab hiển thị mini-player ghim.

## Next

Reload extension, mở mini-player ghim ở tab khác và kiểm tra cả Next lẫn Previous đổi đúng video trong playlist.
