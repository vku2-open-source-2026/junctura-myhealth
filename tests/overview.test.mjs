// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthSummary } from "../server/overview.mjs";

const NOW = new Date("2026-11-20T10:00:00.000Z");
const look = (at, patch = {}) => ({ id: at, at, who: "Bệnh viện Đà Nẵng", whoAppId: "h", outcome: "done", emergency: false, ...patch });
const consent = (patch = {}) => ({ id: "c", who: "x", createdAt: "2026-11-02T00:00:00.000Z", revokedAt: null, ...patch });

test("a month with no looks says so and has nothing else to report", () => {
  const summary = buildMonthSummary({ consents: [], access: [], now: NOW });
  assert.equal(summary.month, "2026-11");
  assert.deepEqual(summary.lines, ["Tháng 11/2026 chưa có ai truy cập dữ liệu của bạn."]);
});

test("counts this month's looks and places, and names the place that looked most", () => {
  const access = [look("2026-11-03T03:00:00.000Z"), look("2026-11-05T03:00:00.000Z"), look("2026-11-06T03:00:00.000Z", { who: "Nhà thuốc", whoAppId: "p" })];
  const summary = buildMonthSummary({ consents: [], access, now: NOW });
  assert.equal(summary.looks, 3);
  assert.equal(summary.places, 2);
  assert.deepEqual(summary.topPlace, { who: "Bệnh viện Đà Nẵng", count: 2 });
  assert.ok(summary.lines.includes("Tháng 11/2026 có 3 lượt truy cập dữ liệu của bạn từ 2 nơi."));
  assert.ok(summary.lines.includes("Nơi xem nhiều nhất là Bệnh viện Đà Nẵng (2 lượt)."));
});

test("months follow Vietnam time: late evening on the last day belongs to the next month", () => {
  const access = [look("2026-10-31T17:30:00.000Z"), look("2026-10-31T16:30:00.000Z")];
  const summary = buildMonthSummary({ consents: [], access, now: NOW });
  assert.equal(summary.looks, 1);
  assert.equal(summary.previousLooks, 1);
});

test("compares with last month, also across the new year", () => {
  const more = buildMonthSummary({ consents: [], access: [look("2026-11-03T03:00:00.000Z"), look("2026-11-04T03:00:00.000Z"), look("2026-10-04T03:00:00.000Z")], now: NOW });
  assert.ok(more.lines.includes("Nhiều hơn tháng trước (1 lượt)."));
  const fewer = buildMonthSummary({ consents: [], access: [look("2026-11-03T03:00:00.000Z"), look("2026-10-04T03:00:00.000Z"), look("2026-10-05T03:00:00.000Z")], now: NOW });
  assert.ok(fewer.lines.includes("Ít hơn tháng trước (2 lượt)."));
  const same = buildMonthSummary({ consents: [], access: [look("2026-11-03T03:00:00.000Z"), look("2026-10-04T03:00:00.000Z")], now: NOW });
  assert.ok(same.lines.includes("Bằng tháng trước (1 lượt)."));
  const january = buildMonthSummary({ consents: [], access: [look("2026-12-20T03:00:00.000Z"), look("2027-01-10T03:00:00.000Z")], now: new Date("2027-01-15T03:00:00.000Z") });
  assert.equal(january.previousLooks, 1);
  assert.equal(january.month, "2027-01");
});

test("reports blocked looks, emergency looks, and consents given and revoked this month", () => {
  const access = [look("2026-11-03T03:00:00.000Z", { outcome: "blocked" }), look("2026-11-04T03:00:00.000Z", { emergency: true })];
  const consents = [consent(), consent({ createdAt: "2026-10-01T00:00:00.000Z", revokedAt: "2026-11-10T00:00:00.000Z" }), consent({ createdAt: "2026-09-01T00:00:00.000Z" })];
  const { lines } = buildMonthSummary({ consents, access, now: NOW });
  assert.ok(lines.includes("1 lượt bị chặn hoặc không thành công."));
  assert.ok(lines.includes("1 lượt là truy cập cấp cứu."));
  assert.ok(lines.includes("Bạn đã cho phép 1 lần và thu hồi 1 lần."));
});

test("the summary says nothing about what was read", () => {
  const text = JSON.stringify(buildMonthSummary({ consents: [], access: [look("2026-11-03T03:00:00.000Z")], now: NOW }));
  assert.ok(!/dị ứng|chẩn đoán|đơn thuốc/i.test(text));
});
