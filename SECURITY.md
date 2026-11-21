<!-- SPDX-FileCopyrightText: 2026 Junctura Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Chính sách bảo mật

Junctura MyHealth xử lý dữ liệu y tế (ở bản demo là dữ liệu giả lập), nên lỗi bảo mật được coi trọng hơn lỗi thông thường.

## Phiên bản được hỗ trợ

| Phiên bản | Hỗ trợ bản vá bảo mật |
| --- | --- |
| Nhánh `main` và bản phát hành mới nhất | Có |
| Bản cũ hơn | Không |

## Báo cáo lỗ hổng

**Vui lòng không mở Issue công khai cho lỗ hổng bảo mật.**

1. Vào tab **Security** của repo [junctura-myhealth](https://github.com/vku2-open-source-2026/junctura-myhealth/security) và chọn **Report a vulnerability** (báo cáo riêng tư của GitHub).
2. Nếu không dùng được cách trên, mở một Issue công khai chỉ ghi "cần báo cáo bảo mật" và **không** nêu chi tiết; người duy trì sẽ liên hệ lại để trao đổi riêng.

Nên kèm theo:

- Mô tả lỗ hổng và tác động (ai bị ảnh hưởng, dữ liệu nào lộ).
- Các bước tái hiện, phiên bản hoặc commit.
- Đề xuất cách sửa, nếu có.

Nhóm là nhóm sinh viên nên không cam kết thời hạn cố định, nhưng sẽ cố gắng phản hồi trong vòng 7 ngày, thông báo hướng xử lý và ghi nhận người báo cáo (nếu họ đồng ý) khi phát hành bản vá.

## Phạm vi

**Trong phạm vi:** đăng nhập và kiểm tra token; việc chuyển tiếp yêu cầu đồng thuận và nhật ký truy cập tới Junctura (một người bệnh không được thấy hay đổi dữ liệu của người khác); thông tin tự khai; xử lý đầu vào; lộ bí mật trong mã nguồn hoặc lịch sử git.

**Ngoài phạm vi:** lỗi chỉ xảy ra khi cố tình cấu hình thiếu an toàn (ví dụ tắt HTTPS); tấn công từ chối dịch vụ bằng lưu lượng lớn; lỗi trong thư viện bên thứ ba chưa có bản sửa (hãy báo cho tác giả thư viện); dữ liệu mẫu (đều là giả lập, không có người thật).

## Khi tự chạy ứng dụng

- Không commit `.env`, khóa, token; dùng biến môi trường.
- Không đưa dữ liệu người bệnh thật vào bản demo.
- Đặt MyHealth sau HTTPS khi đưa ra ngoài máy cá nhân; ứng dụng chuyển token của người bệnh tới Junctura nên đường truyền phải được mã hóa.
