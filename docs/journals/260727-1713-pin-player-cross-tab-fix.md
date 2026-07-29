---
title: Đồng bộ Pin player giữa các tab
date: 2026-07-27
status: completed
---

## Context

Nút Pin của mini player không hiển thị nhất quán trên các tab Chrome khác.

## What happened

Content script không xử lý thay đổi `musicControlMiniPlayerEnabled` từ storage, nên chỉ tab thao tác trực tiếp cập nhật trạng thái. Mini player cũng có thể giữ lại timer và drag listeners cũ.

## Decision

Đồng bộ visibility qua storage dùng chung cho mọi content script. Khi trạng thái đổi, dọn timer và drag listeners trước khi khởi tạo/hiển thị lại mini player.

## Verification

Đã pass 3 regression tests bằng Node, kiểm tra cú pháp JavaScript và kiểm tra JSON của manifest. Cần người dùng reload extension rồi xác nhận trực tiếp giữa nhiều tab Chrome.

## Next

Sau khi reload extension, bật/tắt Pin ở một tab và kiểm tra mini player xuất hiện/biến mất đúng trên các tab được hỗ trợ khác.
