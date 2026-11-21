// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { accessCsv, dayHeading, dayKey, daysLeft, fold, groupByDay, remaining, reviewLabel, timeOf, withinDays } from "./format";
import type { AccessEntry } from "./types";

const NOW = new Date("2026-11-20T10:00:00.000Z");

describe("format", () => {
  it("counts whole days left and never goes below zero", () => {
    expect(daysLeft("2026-12-20T10:00:00.000Z", NOW)).toBe(30);
    expect(daysLeft("2026-11-20T11:00:00.000Z", NOW)).toBe(1);
    expect(daysLeft("2026-11-01T10:00:00.000Z", NOW)).toBe(0);
  });
  it("says in words how long a consent lasts", () => {
    expect(remaining("2026-12-04T10:00:00.000Z", NOW)).toBe("Còn 14 ngày");
    expect(remaining("2026-11-19T10:00:00.000Z", NOW)).toBe("Hết hạn hôm nay");
  });
  it("labels emergency review states; a missing review means still waiting", () => {
    expect(reviewLabel("justified")).toBe("Đã rà soát: hợp lý");
    expect(reviewLabel("unjustified")).toBe("Đã rà soát: không hợp lý");
    expect(reviewLabel(null)).toMatch(/chờ/);
  });
  it("filters by period and keeps everything for 0", () => {
    const items = [{ at: "2026-11-19T10:00:00.000Z" }, { at: "2026-10-01T10:00:00.000Z" }];
    expect(withinDays(items, 7, NOW)).toHaveLength(1);
    expect(withinDays(items, 0, NOW)).toHaveLength(2);
  });
  it("folds diacritics", () => expect(fold("Bệnh viện Đà Nẵng")).toBe("benh vien da nang"));
});

describe("days in Vietnam time", () => {
  it("puts late evening UTC on the next Vietnamese day", () => {
    expect(dayKey("2026-11-19T18:30:00.000Z")).toBe("2026-11-20");
    expect(timeOf("2026-11-19T18:30:00.000Z")).toBe("01:30");
  });
  it("names today, yesterday and older days", () => {
    expect(dayHeading("2026-11-20", NOW)).toBe("Hôm nay");
    expect(dayHeading("2026-11-19", NOW)).toBe("Hôm qua");
    expect(dayHeading("2026-11-18", NOW)).toBe("Thứ Tư, 18/11/2026");
  });
  it("groups newest-first entries by day and keeps their order", () => {
    const groups = groupByDay([{ at: "2026-11-20T05:00:00.000Z", n: 1 }, { at: "2026-11-20T01:00:00.000Z", n: 2 }, { at: "2026-11-18T05:00:00.000Z", n: 3 }]);
    expect(groups.map(group => [group.day, group.items.map(item => item.n)])).toEqual([["2026-11-20", [1, 2]], ["2026-11-18", [3]]]);
  });
});

describe("access log as CSV", () => {
  const entry = (patch: Partial<AccessEntry> = {}): AccessEntry => ({
    id: "e1", at: "2026-11-19T18:30:00.000Z", who: "Bệnh viện Đà Nẵng", what: "Danh sách dị ứng", purpose: "treatment", purposeLabel: "Để điều trị",
    provider: null, outcome: "done", emergency: false, review: null, ...patch,
  });

  it("writes one row per look, newest first, in Vietnam time, after a byte order mark", () => {
    const csv = accessCsv([entry({ id: "old", at: "2026-11-10T03:00:00.000Z" }), entry()]);
    expect(csv.startsWith("\uFEFFThời gian,Nơi xem,Loại dữ liệu,Mục đích,Kết quả,Cấp cứu,Rà soát cấp cứu\r\n")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines[1]).toBe("20/11/2026 01:30,Bệnh viện Đà Nẵng,Danh sách dị ứng,Để điều trị,Đã xem,Không,");
    expect(lines[2].startsWith("10/11/2026 10:00,")).toBe(true);
  });
  it("marks an emergency look with its review state, and a blocked look as blocked", () => {
    const csv = accessCsv([entry({ emergency: true, review: "unjustified", outcome: "blocked" })]);
    expect(csv).toContain(",Bị chặn hoặc không thành công,Có,Đã rà soát: không hợp lý");
  });
  it("defuses spreadsheet formulas, and quotes commas and quotes", () => {
    const csv = accessCsv([entry({ who: "=HYPERLINK(\"x\")", what: "Một, hai" })]);
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csv).toContain("\"Một, hai\"");
  });
  it("has only the header when there is nothing to export", () => expect(accessCsv([]).trim().split("\r\n")).toHaveLength(1));
});
