// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { Badge } from "@junctura/health-ui";
import { Building2, Hospital, Pill, ShieldCheck, Stethoscope } from "lucide-react";
import { fold, outcomeLabel } from "./format";
import type { DayCount, Outcome } from "./types";

type IconType = typeof Hospital;
/** Picks a recognisable icon for a place from its name; anything else gets a neutral building. */
export const placeIcon = (who: string): IconType => {
  const name = fold(who);
  if (name.includes("benh vien")) return Hospital;
  if (name.includes("nha thuoc")) return Pill;
  if (name.includes("bao hiem")) return ShieldCheck;
  if (name.includes("tram")) return Stethoscope;
  return Building2;
};

export function PlaceAvatar({ who, large = false }: { who: string; large?: boolean }) {
  const Icon = placeIcon(who);
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full bg-brand/10 text-brand ${large ? "size-12" : "size-10"}`}>
      <Icon className={large ? "size-6" : "size-5"} />
    </span>
  );
}

export const OutcomeBadge = ({ outcome }: { outcome: Outcome }) => (
  outcome === "done" ? <Badge tone="ok">Đã xem</Badge>
    : outcome === "blocked" ? <Badge tone="warn">{outcomeLabel.blocked}</Badge>
      : outcome === "pending" ? <Badge tone="neutral">Đang xử lý</Badge>
        : <Badge tone="neutral">Chưa rõ</Badge>
);

/**
 * Looks per day as bars. Blocked looks are drawn in a second colour and also counted in the text
 * alternative, so the chart never relies on colour alone.
 */
export function ActivityChart({ daily }: { daily: DayCount[] }) {
  const max = Math.max(1, ...daily.map(day => day.count));
  const total = daily.reduce((sum, day) => sum + day.count, 0);
  const blocked = daily.reduce((sum, day) => sum + day.blocked, 0);
  return (
    <figure className="space-y-3">
      <div role="img" aria-label={`Lượt truy cập dữ liệu của bạn trong ${daily.length} ngày qua: tổng ${total}, trong đó ${blocked} bị chặn.`} className="flex h-32 items-end gap-1.5">
        {daily.map(day => {
          const height = day.count === 0 ? 3 : Math.max(10, Math.round((day.count / max) * 100));
          const share = day.count === 0 ? 0 : (day.blocked / day.count) * 100;
          return (
            <div key={day.date} title={`${day.date.split("-").reverse().join("/")}: ${day.count} lượt${day.blocked ? `, ${day.blocked} bị chặn` : ""}`} className="flex h-full flex-1 items-end">
              <div className={`flex w-full flex-col-reverse overflow-hidden rounded-t-md ${day.count === 0 ? "bg-line" : "bg-brand"}`} style={{ height: `${height}%` }}>
                {share > 0 && <div className="bg-warn" style={{ height: `${share}%` }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div aria-hidden className="flex gap-1.5 text-center text-xs text-muted">
        {daily.map((day, index) => <span key={day.date} className="flex-1">{index % 2 === daily.length % 2 ? day.date.slice(8) : ""}</span>)}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-sm bg-brand" />Đã xem</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-sm bg-warn" />Bị chặn</span>
        <span className="ml-auto">{total} lượt trong {daily.length} ngày</span>
      </figcaption>
    </figure>
  );
}
