// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { AlertBanner, Badge, Button, Card, EmptyState, PageHeader, SegmentedControl, SelectField, Section, StatStrip, useToast } from "@junctura/health-ui";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { ApiError, flagAccess, getAccess, unflagAccess } from "./api";
import { accessCsv, dayHeading, dayKey, groupByDay, timeOf, withinDays } from "./format";
import { OutcomeBadge, PlaceAvatar } from "./parts";
import { Link } from "./router";
import { Remote, useRemote, useSession } from "./session";

export function Access() {
  const { settings, expire } = useSession();
  const { notify } = useToast();
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [marking, setMarking] = useState<string | null>(null);
  const { state, reload } = useRemote(signal => getAccess(settings, signal), [settings]);
  const [who, setWho] = useState("");
  const [days, setDays] = useState<"7" | "30" | "0">("30");
  const entries = useMemo(() => (state.status === "ready" ? state.data.entries : []).map(entry => ({ ...entry, flagged: marks[entry.id] ?? entry.flagged === true })), [state, marks]);
  const names = useMemo(() => [...new Set(entries.map(entry => entry.who))].sort((a, b) => a.localeCompare(b, "vi")), [entries]);
  const shown = useMemo(() => withinDays(entries.filter(entry => !who || entry.who === who), Number(days)).sort((a, b) => b.at.localeCompare(a.at)), [entries, who, days]);
  const groups = useMemo(() => groupByDay(shown), [shown]);

  const mark = async (id: string, flagged: boolean) => {
    setMarking(id);
    try {
      await (flagged ? flagAccess(settings, id) : unflagAccess(settings, id));
      setMarks(current => ({ ...current, [id]: flagged }));
      if (flagged) notify("Đã đánh dấu lần xem này. Bạn có thể thu hồi quyền của nơi đó ở mục Đồng thuận.", "ok");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return expire();
      notify("Chưa đánh dấu được. Hãy thử lại.", "danger");
    } finally {
      setMarking(null);
    }
  };

  const download = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([accessCsv(shown)], { type: "text/csv;charset=utf-8" }));
    link.download = `nhat-ky-truy-cap-${dayKey(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Ai đã xem dữ liệu của tôi" description="Mỗi lần có nơi hỏi dữ liệu của bạn qua Junctura đều được ghi lại ở đây, kể cả lần bị chặn."
        actions={<Button variant="secondary" disabled={shown.length === 0} icon={<Download aria-hidden className="size-4" />} onClick={download}>Tải nhật ký (CSV)</Button>} />
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
                  <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <PlaceAvatar who={entry.who} />
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-medium text-ink">{`${entry.who} ${entry.outcome === "blocked" ? "xin xem" : "xem"} ${entry.what.toLowerCase()}`}</p>
                        <p className="text-sm text-muted">{timeOf(entry.at)} · {entry.purposeLabel}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">{entry.flagged && <Badge tone="warn">Đã đánh dấu</Badge>}{entry.emergency && <Badge tone="danger">Cấp cứu</Badge>}<OutcomeBadge outcome={entry.outcome} /></div>
                    </div>
                    {entry.flagged ? (
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-14 text-sm text-ink">
                        <span>Bạn không nhận ra lần xem này. Nếu không muốn {entry.who} xem nữa, hãy thu hồi đồng thuận.</span>
                        <Link to="/dong-thuan" className="font-semibold text-brand underline">Mở Đồng thuận</Link>
                        <Button variant="secondary" loading={marking === entry.id} onClick={() => void mark(entry.id, false)} aria-label={`Bỏ đánh dấu lần xem của ${entry.who} lúc ${timeOf(entry.at)}`}>Bỏ đánh dấu</Button>
                      </div>
                    ) : entry.outcome !== "blocked" && (
                      <div className="mt-1 pl-14">
                        <Button variant="secondary" loading={marking === entry.id} onClick={() => void mark(entry.id, true)} aria-label={`Tôi không nhận ra lần xem của ${entry.who} lúc ${timeOf(entry.at)}`}>Tôi không nhận ra lần này</Button>
                      </div>
                    )}
                  </li>
                ))}</ul>
              </Card>
            </Section>
          ))}
          <p className="text-sm text-muted">Nhật ký chỉ cho biết ai, khi nào, loại dữ liệu và mục đích. Nội dung đã xem không được lưu ở đây. Dấu "Đã đánh dấu" chỉ lưu trong Sổ sức khỏe của bạn để nhắc bạn, không báo cho nơi đã xem. Tệp CSV gồm đúng các dòng đang hiện ở trên.</p>
        </>
      )}</Remote>
    </div>
  );
}
