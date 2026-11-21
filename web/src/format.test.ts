// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { dayHeading, dayKey, daysLeft, fold, groupByDay, remaining, reviewLabel, timeOf, withinDays } from "./format";

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
