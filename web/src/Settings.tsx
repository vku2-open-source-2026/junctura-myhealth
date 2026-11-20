// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { Card, PageHeader, TextSizeSelector, ThemeToggle } from "@junctura/health-ui";
import { useSession } from "./session";

export function Settings() {
  const { me } = useSession();
  return (
    <div className="space-y-5">
      <PageHeader title="Cài đặt" description="Cách hiển thị và những gì ứng dụng này lưu về bạn." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Hiển thị">
          <div className="space-y-4 text-base text-ink">
            <div className="flex items-center justify-between gap-3"><span>Cỡ chữ</span><TextSizeSelector /></div>
            <div className="flex items-center justify-between gap-3"><span>Giao diện tối</span><ThemeToggle /></div>
            <p className="text-sm text-muted">Lưu trên trình duyệt này.</p>
          </div>
        </Card>
        <Card title="Tài khoản">
          <dl className="space-y-2 text-base">
            <div><dt className="text-sm text-muted">Họ tên</dt><dd className="font-medium text-ink">{me.displayName}</dd></div>
            <div><dt className="text-sm text-muted">Tên đăng nhập</dt><dd className="text-ink-2">{me.username}</dd></div>
          </dl>
        </Card>
        <Card title="Ứng dụng này lưu gì về bạn" className="lg:col-span-2">
          <ul className="list-disc space-y-2 pl-5 text-base text-ink-2">
            <li>Chỉ phần bạn tự khai ở mục Thông tin của tôi (liên hệ khẩn cấp, nhóm máu, ghi chú).</li>
            <li>Đồng thuận và nhật ký truy cập do Junctura giữ, ứng dụng chỉ hiển thị và gửi yêu cầu của bạn.</li>
            <li>Bệnh án nằm ở trạm y tế và bệnh viện, không nằm ở đây.</li>
            <li>Mật khẩu chỉ nhập trên trang đăng nhập của Junctura.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
