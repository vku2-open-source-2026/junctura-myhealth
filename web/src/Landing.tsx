// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { Badge, LandingPage, PreviewFrame, StatStrip, type LandingProps } from "@junctura/health-ui";
import { Eye, HeartPulse, Lock, ShieldCheck, Undo2 } from "lucide-react";

/** A small, fictional picture of the Overview screen (no real person's data). */
const HeroPicture = () => (
  <PreviewFrame label="Minh hoạ màn hình Tổng quan của MyHealth" title="MyHealth · Tổng quan">
    <div className="space-y-3">
      <StatStrip items={[{ label: "Nơi được phép xem", value: 2, tone: "ok" }, { label: "Lượt xem 30 ngày", value: 5 }]} />
      <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
        <span className="font-medium">Bệnh viện xem danh sách dị ứng</span><Badge tone="ok">Còn 90 ngày</Badge>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
        <span className="font-medium">Nhà thuốc</span><Badge tone="neutral">Đã thu hồi</Badge>
      </div>
    </div>
  </PreviewFrame>
);

const SOURCE = "https://github.com/vku2-open-source-2026/junctura-myhealth";

export const landingProps = (): Omit<LandingProps, "onSignIn"> => ({
  product: "MyHealth",
  badge: "Dành cho người bệnh và người nhà",
  headline: "Bạn quyết định ai được xem dữ liệu sức khỏe của mình",
  lead: "Cho phép từng nơi, từng mục đích, có thời hạn. Xem ai đã xem. Thu hồi bất cứ lúc nào.",
  note: "Dữ liệu trong bản demo là dữ liệu giả lập.",
  hero: <HeroPicture />,
  benefits: { title: "Rõ ràng, đơn giản, trong tay bạn", lead: "Chữ lớn, mỗi màn hình một việc, dùng được trên điện thoại.", items: [
    { icon: <ShieldCheck className="size-5" />, title: "Bạn quyết định", text: "Chưa đồng ý thì nơi khác không xem được, trừ cấp cứu." },
    { icon: <Eye className="size-5" />, title: "Biết ai đã xem", text: "Mỗi lần có nơi hỏi dữ liệu của bạn đều có dòng ghi lại." },
    { icon: <Undo2 className="size-5" />, title: "Thu hồi ngay", text: "Một lần bấm; nơi đó không xem được nữa." },
  ] },
  steps: { title: "Ba việc bạn làm ở đây", items: [
    { title: "Cho phép", text: "Chọn nơi, loại dữ liệu, mục đích và thời hạn." },
    { title: "Theo dõi", text: "Xem ai đã xem, lúc nào, để làm gì." },
    { title: "Thu hồi", text: "Đổi ý thì thu hồi, có hiệu lực ngay." },
  ] },
  audiences: { title: "Cho cả gia đình", items: [
    { icon: <HeartPulse className="size-5" />, title: "Người bệnh", text: "Biết dữ liệu của mình đi đâu." },
    { icon: <Lock className="size-5" />, title: "Người lớn tuổi", text: "Chữ lớn, nút to, lời lẽ đời thường." },
  ] },
  trust: { title: "Riêng tư là mặc định", items: [
    { icon: <Lock className="size-5" />, title: "Đăng nhập qua Junctura", text: "Mật khẩu chỉ nhập trên trang của Junctura." },
    { icon: <ShieldCheck className="size-5" />, title: "Mã nguồn mở", text: "Giấy phép Apache-2.0, kiểm tra được từng dòng." },
    { icon: <Eye className="size-5" />, title: "Không giữ bệnh án", text: "Ứng dụng chỉ lưu phần bạn tự khai." },
  ] },
  faq: { title: "Câu hỏi thường gặp", items: [
    { q: "Nếu tôi không đồng ý thì sao?", a: "Các nơi khác không xem được dữ liệu của bạn. Riêng cấp cứu, nơi khám có thể xin xem với lý do và bị rà soát; bạn thấy ở mục Cấp cứu." },
    { q: "Thu hồi có ngay không?", a: "Có. Từ lúc thu hồi, các lần hỏi sau đều bị chặn." },
    { q: "Ai đăng nhập được?", a: "Tài khoản người bệnh do Junctura cấp." },
  ] },
  cta: { title: "Xem ai đang xem dữ liệu của bạn", lead: "Đăng nhập bằng tài khoản Junctura." },
  footer: { links: [{ label: "Mã nguồn", href: SOURCE }, { label: "Báo lỗi", href: `${SOURCE}/issues` }, { label: "Giấy phép", href: "https://www.apache.org/licenses/LICENSE-2.0" }] },
});

export const Landing = ({ onSignIn }: { onSignIn: () => void }) => <LandingPage {...landingProps()} onSignIn={onSignIn} />;
