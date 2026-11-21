// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { AlertBanner, Badge, Button, Card, EmptyState, PageHeader, Section } from "@junctura/health-ui";
import { ArrowRight } from "lucide-react";
import { getOverview } from "./api";
import { remaining, timeOf, dayHeading, dayKey } from "./format";
import { ActivityChart, OutcomeBadge, PlaceAvatar } from "./parts";
import { Link } from "./router";
import { Remote, useRemote, useSession } from "./session";

export function Overview() {
  const { settings, me } = useSession();
  const { state, reload } = useRemote(signal => getOverview(settings, signal), [settings]);
  return (
    <div className="space-y-7">
      <PageHeader title={`Xin chào, ${me.displayName}`} description="Bạn quyết định ai được xem dữ liệu sức khỏe của mình, và luôn biết ai đã xem." />
      <Remote state={state} reload={reload}>{overview => (
        <>
          {overview.pendingEmergency > 0 && (
            <AlertBanner level="warning" title={`${overview.pendingEmergency} lần truy cập cấp cứu đang chờ rà soát`}
              action={<Link to="/cap-cuu" className="font-semibold underline">Xem chi tiết</Link>}>
              Có nơi đã xem dữ liệu của bạn khi chưa có đồng ý, vì lý do cấp cứu.
            </AlertBanner>
          )}

          {overview.flagged > 0 && (
            <AlertBanner level="notice" title={`Bạn đã đánh dấu ${overview.flagged} lần xem không nhận ra`}
              action={<Link to="/ai-da-xem" className="font-semibold underline">Xem lại</Link>}>
              Nếu không muốn nơi đó xem nữa, hãy thu hồi đồng thuận ở mục Đồng thuận.
            </AlertBanner>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <Card className="bg-brand/5">
              <p className="text-sm font-medium text-muted">Đang được phép xem dữ liệu của bạn</p>
              <p className="mt-1 flex items-baseline gap-2"><span className="text-6xl font-bold tracking-tight text-brand">{overview.parties}</span><span className="text-xl text-ink-2">nơi</span></p>
              <ul className="mt-4 space-y-2 text-base text-ink">{overview.lines.slice(0, 2).map(line => <li key={line} className="flex gap-2"><span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand" /><span>{line}</span></li>)}</ul>
              <p className="mt-4 text-sm text-muted">Chỉ đếm từ nhật ký của Junctura. Nội dung hồ sơ không có trong đây.</p>
            </Card>
            <Card title="Lượt truy cập 14 ngày qua" actions={<Badge tone="neutral">{overview.accessLast30Days} lượt / 30 ngày</Badge>}>
              <ActivityChart daily={overview.daily} />
            </Card>
          </div>

          <Card title={`Tháng ${overview.month.label} của bạn`} actions={<Badge tone="neutral">Tính đến hôm nay</Badge>}>
            <ul className="space-y-2 text-lg text-ink">{overview.month.lines.map(line => <li key={line} className="flex gap-2"><span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-brand" /><span>{line}</span></li>)}</ul>
            <p className="mt-4 text-sm text-muted">Tóm tắt soạn theo quy tắc cố định từ nhật ký của Junctura, không dùng AI và không nói về nội dung đã xem.</p>
          </Card>

          <Section title="Ai đang được xem dữ liệu của bạn" description="Mỗi thẻ là một nơi bạn đã cho phép." count={overview.places.length}
            actions={<Link to="/dong-thuan" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">Quản lý <ArrowRight aria-hidden className="size-4" /></Link>}>
            {overview.places.length === 0 ? (
              <Card><EmptyState title="Chưa có nơi nào được phép xem" action={<Link to="/dong-thuan"><Button>Cho phép một nơi</Button></Link>}>Khi bạn chưa đồng ý, các nơi khác không xem được dữ liệu của bạn, trừ khi là cấp cứu.</EmptyState></Card>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">{overview.places.map(place => (
                <li key={place.whoAppId ?? place.who}>
                  <Card className="h-full">
                    <div className="flex items-center gap-3"><PlaceAvatar who={place.who} large /><p className="text-lg font-semibold text-ink">{place.who}</p></div>
                    <ul className="mt-3 space-y-2">{place.consents.map(item => (
                      <li key={item.id} className="flex items-start justify-between gap-3 text-base">
                        <span><span className="text-ink">{item.what}</span><span className="block text-sm text-muted">{item.purposes.map(purpose => purpose.label).join(" · ")}</span></span>
                        <Badge tone={Date.parse(item.expiresAt) - Date.now() <= 14 * 86_400_000 ? "warn" : "ok"}>{remaining(item.expiresAt)}</Badge>
                      </li>
                    ))}</ul>
                  </Card>
                </li>
              ))}</ul>
            )}
          </Section>

          <Section title="Gần đây" description="Các lần có nơi hỏi dữ liệu của bạn."
            actions={<Link to="/ai-da-xem" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">Xem tất cả <ArrowRight aria-hidden className="size-4" /></Link>}>
            <Card>
              {overview.recent.length === 0 ? <EmptyState title="Chưa có lần truy cập nào">Khi có nơi hỏi dữ liệu của bạn, bạn sẽ thấy ở đây.</EmptyState> : (
                <ul className="divide-y divide-line">{overview.recent.map(entry => (
                  <li key={entry.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <PlaceAvatar who={entry.who} />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium text-ink">{entry.who} {entry.outcome === "blocked" ? "xin xem" : "xem"} {entry.what.toLowerCase()}</p>
                      <p className="text-sm text-muted">{dayHeading(dayKey(entry.at))}, {timeOf(entry.at)} · {entry.purposeLabel}</p>
                    </div>
                    {entry.emergency ? <Badge tone="danger">Cấp cứu</Badge> : <OutcomeBadge outcome={entry.outcome} />}
                  </li>
                ))}</ul>
              )}
            </Card>
          </Section>
        </>
      )}</Remote>
    </div>
  );
}
