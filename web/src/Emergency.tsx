// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { AlertBanner, Badge, Card, EmptyState, PageHeader, formatDateTime } from "@junctura/health-ui";
import { getEmergency } from "./api";
import { reviewLabel } from "./format";
import { PlaceAvatar } from "./parts";
import { Remote, useRemote, useSession } from "./session";
import type { Review } from "./types";

const tone = (review: Review) => (review === "justified" ? "ok" : review === "unjustified" ? "danger" : "warn");

export function Emergency() {
  const { settings } = useSession();
  const { state, reload } = useRemote(signal => getEmergency(settings, signal), [settings]);
  return (
    <div className="space-y-6">
      <PageHeader title="Truy cập cấp cứu" description="Khi tính mạng nguy cấp, nơi khám có thể xin xem dữ liệu mà chưa cần bạn đồng ý. Mỗi lần như vậy phải nêu lý do và bị rà soát." />
      <Card title="Cấp cứu hoạt động thế nào">
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            ["1", "Nơi khám xin xem", "Khi bạn nguy kịch và chưa kịp đồng ý, nơi khám có thể xin xem dữ liệu, bắt buộc nêu lý do."],
            ["2", "Mọi lần đều ghi lại", "Lần xem hiện ở đây và trong mục Ai đã xem, đánh dấu Cấp cứu."],
            ["3", "Bị rà soát sau đó", "Cơ quan quản lý xem lý do và kết luận hợp lý hay không."],
          ].map(([number, title, text]) => (
            <li key={number} className="flex gap-3">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-on-brand">{number}</span>
              <span><span className="block font-semibold text-ink">{title}</span><span className="text-sm text-ink-2">{text}</span></span>
            </li>
          ))}
        </ol>
      </Card>
      <Remote state={state} reload={reload}>{entries => (
        entries.length === 0 ? (
          <Card><EmptyState title="Chưa có lần truy cập cấp cứu nào">Nếu có, bạn sẽ thấy ở đây: nơi nào, lúc nào, và kết quả rà soát.</EmptyState></Card>
        ) : (
          <>
            <AlertBanner level="info" title="Ai rà soát?">Cơ quan quản lý của Junctura xem lý do và kết luận hợp lý hay không. Bạn được báo kết quả ở đây; nếu thấy không đúng, hãy liên hệ nơi đã xem hoặc cơ quan quản lý.</AlertBanner>
            <ul className="space-y-3">{[...entries].sort((a, b) => b.at.localeCompare(a.at)).map(entry => (
              <li key={entry.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <PlaceAvatar who={entry.who} large />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-lg font-semibold text-ink">{entry.who}</p>
                      <p className="text-base text-ink-2">Xem {entry.what.toLowerCase()} · {entry.purposeLabel}</p>
                      <p className="text-sm text-muted">{formatDateTime(entry.at)}</p>
                    </div>
                    <Badge tone={tone(entry.review)}>{reviewLabel(entry.review)}</Badge>
                  </div>
                </Card>
              </li>
            ))}</ul>
          </>
        )
      )}</Remote>
    </div>
  );
}
