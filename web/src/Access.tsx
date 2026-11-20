// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { AlertBanner, Badge, Card, EmptyState, PageHeader, SegmentedControl, SelectField, Section, StatStrip } from "@junctura/health-ui";
import { useMemo, useState } from "react";
import { getAccess } from "./api";
import { dayHeading, groupByDay, timeOf, withinDays } from "./format";
import { OutcomeBadge, PlaceAvatar } from "./parts";
import { Remote, useRemote, useSession } from "./session";

export function Access() {
  const { settings } = useSession();
  const { state, reload } = useRemote(signal => getAccess(settings, signal), [settings]);
  const [who, setWho] = useState("");
  const [days, setDays] = useState<"7" | "30" | "0">("30");
  const entries = state.status === "ready" ? state.data.entries : [];
  const names = useMemo(() => [...new Set(entries.map(entry => entry.who))].sort((a, b) => a.localeCompare(b, "vi")), [entries]);
  const shown = useMemo(() => withinDays(entries.filter(entry => !who || entry.who === who), Number(days)).sort((a, b) => b.at.localeCompare(a.at)), [entries, who, days]);
  const groups = useMemo(() => groupByDay(shown), [shown]);

  return (
    <div className="space-y-6">
      <PageHeader title="Ai đã xem dữ liệu của tôi" description="Mỗi lần có nơi hỏi dữ liệu của bạn qua Junctura đều được ghi lại ở đây, kể cả lần bị chặn." />
      <Remote state={state} reload={reload}>{data => (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <SegmentedControl label="Khoảng thời gian" value={days} onChange={setDays} options={[{ value: "7", label: "7 ngày" }, { value: "30", label: "30 ngày" }, { value: "0", label: "Tất cả" }]} />
            {names.length > 1 && <div className="min-w-56"><SelectField label="Nơi xem" value={who} onChange={event => setWho(event.target.value)} options={[{ value: "", label: "Tất cả" }, ...names.map(name => ({ value: name, label: name }))]} /></div>}
          </div>
          <StatStrip items={[
            { label: "Lượt truy cập", value: shown.length },
            { label: "Số nơi", value: new Set(shown.map(entry => entry.who)).size },
            { label: "Bị chặn", value: shown.filter(entry => entry.outcome === "blocked").length, tone: shown.some(entry => entry.outcome === "blocked") ? "warn" : "neutral" },
            { label: "Cấp cứu", value: shown.filter(entry => entry.emergency).length, tone: shown.some(entry => entry.emergency) ? "danger" : "neutral" },
          ]} />
          {data.truncated && <AlertBanner level="info" title="Chỉ hiện 200 lần gần nhất">Nhật ký đầy đủ nằm ở Junctura.</AlertBanner>}
          {groups.length === 0 ? (
            <Card><EmptyState title="Không có lần truy cập nào">Trong khoảng thời gian này không có ai xem dữ liệu của bạn.</EmptyState></Card>
          ) : groups.map(group => (
            <Section key={group.day} title={dayHeading(group.day)} count={group.items.length}>
              <Card>
                <ul className="divide-y divide-line">{group.items.map(entry => (
                  <li key={entry.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <PlaceAvatar who={entry.who} />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium text-ink">{`${entry.who} ${entry.outcome === "blocked" ? "xin xem" : "xem"} ${entry.what.toLowerCase()}`}</p>
                      <p className="text-sm text-muted">{timeOf(entry.at)} · {entry.purposeLabel}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">{entry.emergency && <Badge tone="danger">Cấp cứu</Badge>}<OutcomeBadge outcome={entry.outcome} /></div>
                  </li>
                ))}</ul>
              </Card>
            </Section>
          ))}
          <p className="text-sm text-muted">Nhật ký chỉ cho biết ai, khi nào, loại dữ liệu và mục đích. Nội dung đã xem không được lưu ở đây.</p>
        </>
      )}</Remote>
    </div>
  );
}
