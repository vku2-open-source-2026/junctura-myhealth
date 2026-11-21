// @vitest-environment jsdom
// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { SignInPage, ToastProvider } from "@junctura/health-ui";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Access } from "./Access";
import { NAV, currentNav } from "./App";
import { ApiError, getAccess, getConsents, getEmergency, getOptions, getOverview, getProfile, grantConsent, revokeConsent, saveProfile } from "./api";
import { Consents } from "./Consents";
import { Emergency } from "./Emergency";
import { Landing } from "./Landing";
import { Overview } from "./Overview";
import { Profile } from "./Profile";
import { SessionProvider, type SessionValue } from "./session";
import type { AccessEntry, Consent, ConsentOption } from "./types";

vi.mock("./api", async importOriginal => ({
  ...(await importOriginal<typeof import("./api")>()),
  getAccess: vi.fn(), getConsents: vi.fn(), getEmergency: vi.fn(), getOptions: vi.fn(), getOverview: vi.fn(), getProfile: vi.fn(),
  grantConsent: vi.fn(), revokeConsent: vi.fn(), saveProfile: vi.fn(),
}));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,AAAA") } }));

// The shared dialog uses the native <dialog>, which jsdom does not implement.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});

const session = (extra: Partial<SessionValue> = {}): SessionValue => ({
  settings: { issuer: "https://id.test", clientId: "c" }, me: { username: "benhnhan.an", displayName: "Nguyễn Văn An", role: "patient", patientCode: "P0001" }, expire: () => {}, ...extra,
});
const wrap = (node: React.ReactNode, extra: Partial<SessionValue> = {}) => render(<ToastProvider><SessionProvider value={session(extra)}>{node}</SessionProvider></ToastProvider>);
afterEach(() => { cleanup(); vi.clearAllMocks(); history.replaceState(null, "", "/"); });

const FUTURE = new Date(Date.now() + 60 * 86_400_000).toISOString();
const consent = (patch: Partial<Consent> = {}): Consent => ({
  id: "c1", who: "Bệnh viện Đà Nẵng", what: "Danh sách dị ứng", capabilityId: "urn:x", purposes: [{ value: "treatment", label: "Để điều trị" }],
  createdAt: "2026-11-01T00:00:00.000Z", expiresAt: FUTURE, revokedAt: null, state: "active", ...patch,
});
const option: ConsentOption = { id: "junctura-hospital:allergy-list", consumerAppId: "app-h", consumerName: "Bệnh viện", capabilityId: "urn:y", capabilitySlug: "allergy-list", shares: "Danh sách dị ứng", fromName: "Trạm Y tế",
  purposes: [{ value: "treatment", label: "Để điều trị" }, { value: "dispensing", label: "Để phát thuốc" }], emergencyAccess: true };
const entry = (patch: Partial<AccessEntry> = {}): AccessEntry => ({
  id: "e1", at: new Date(Date.now() - 86_400_000).toISOString(), who: "Bệnh viện Đà Nẵng", provider: "Trạm Y tế", what: "Danh sách dị ứng", purpose: "treatment", purposeLabel: "Để điều trị",
  outcome: "done", emergency: false, review: null, ...patch,
});

describe("consents", () => {
  it("lists what is allowed and what is history, and revokes after confirmation", async () => {
    vi.mocked(getConsents).mockResolvedValue([consent(), consent({ id: "c2", who: "Nhà thuốc", state: "revoked", revokedAt: "2026-11-10T00:00:00.000Z" })]);
    vi.mocked(getOptions).mockResolvedValue([option]);
    vi.mocked(revokeConsent).mockResolvedValue(consent({ state: "revoked" }));
    wrap(<Consents />);
    expect(await screen.findByText("Bệnh viện Đà Nẵng")).toBeTruthy();
    expect(screen.getByText("Lịch sử đồng thuận")).toBeTruthy();
    expect(screen.getAllByText("Đã thu hồi").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /Thu hồi đồng thuận của Bệnh viện Đà Nẵng/ }));
    expect(vi.mocked(revokeConsent)).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole("button", { name: "Thu hồi" }).at(-1)!);
    await waitFor(() => expect(vi.mocked(revokeConsent)).toHaveBeenCalledWith(expect.anything(), "c1"));
  });

  it("grants a consent with the chosen purposes and duration", async () => {
    vi.mocked(getConsents).mockResolvedValue([]);
    vi.mocked(getOptions).mockResolvedValue([option]);
    vi.mocked(grantConsent).mockResolvedValue(consent());
    wrap(<Consents />);
    expect(await screen.findByText("Chưa có nơi nào được phép xem")).toBeTruthy();
    await userEvent.click(screen.getAllByRole("button", { name: /Cho phép thêm/ })[0]);
    await userEvent.selectOptions(screen.getByLabelText("Nơi và loại dữ liệu"), option.id);
    await userEvent.click(screen.getByLabelText("Để phát thuốc"));
    await userEvent.selectOptions(screen.getByLabelText("Trong bao lâu"), "180");
    await userEvent.click(screen.getByRole("button", { name: "Đồng ý cho phép" }));
    await waitFor(() => expect(vi.mocked(grantConsent)).toHaveBeenCalledWith(expect.anything(), { optionId: option.id, purposes: ["treatment"], days: 180 }));
  });

  it("offers places that have no consent yet and opens the form with that choice", async () => {
    vi.mocked(getConsents).mockResolvedValue([]);
    vi.mocked(getOptions).mockResolvedValue([option]);
    vi.mocked(grantConsent).mockResolvedValue(consent());
    wrap(<Consents />);
    await userEvent.click(await screen.findByRole("button", { name: /Cho phép Bệnh viện xem danh sách dị ứng/ }));
    expect((screen.getByLabelText("Nơi và loại dữ liệu") as HTMLSelectElement).value).toBe(option.id);
    await userEvent.click(screen.getByRole("button", { name: "Đồng ý cho phép" }));
    await waitFor(() => expect(vi.mocked(grantConsent)).toHaveBeenCalledWith(expect.anything(), { optionId: option.id, purposes: ["treatment", "dispensing"], days: 90 }));
  });

  it("will not send a grant with no purpose chosen", async () => {
    vi.mocked(getConsents).mockResolvedValue([]);
    vi.mocked(getOptions).mockResolvedValue([option]);
    wrap(<Consents />);
    await userEvent.click((await screen.findAllByRole("button", { name: /Cho phép thêm/ }))[0]);
    await userEvent.selectOptions(screen.getByLabelText("Nơi và loại dữ liệu"), option.id);
    await userEvent.click(screen.getByLabelText("Để điều trị"));
    await userEvent.click(screen.getByLabelText("Để phát thuốc"));
    await userEvent.click(screen.getByRole("button", { name: "Đồng ý cho phép" }));
    expect(await screen.findByText("Chọn ít nhất một mục đích.")).toBeTruthy();
    expect(vi.mocked(grantConsent)).not.toHaveBeenCalled();
  });

  it("says plainly when Junctura cannot be reached instead of showing an empty list", async () => {
    vi.mocked(getConsents).mockRejectedValue(new ApiError(503, "x", { error: "junctura-unreachable" }));
    vi.mocked(getOptions).mockResolvedValue([]);
    wrap(<Consents />);
    expect(await screen.findByText(/Chưa kết nối được với Junctura/)).toBeTruthy();
    expect(screen.queryByText("Chưa có nơi nào được phép xem")).toBeNull();
  });

  it("ends the session when the token is no longer accepted", async () => {
    vi.mocked(getConsents).mockRejectedValue(new ApiError(401, "x"));
    vi.mocked(getOptions).mockResolvedValue([]);
    const expire = vi.fn();
    wrap(<Consents />, { expire });
    await waitFor(() => expect(expire).toHaveBeenCalled());
  });
});

describe("who has looked", () => {
  it("shows each access with the place, the purpose and how it ended", async () => {
    vi.mocked(getAccess).mockResolvedValue({ truncated: false, generatedAt: "", entries: [
      entry({ id: "old", at: new Date(Date.now() - 3 * 86_400_000).toISOString(), who: "Nhà thuốc", outcome: "blocked", purposeLabel: "Để phát thuốc" }), entry(),
    ] });
    wrap(<Access />);
    expect(await screen.findByText(/Nhà thuốc xin xem/)).toBeTruthy();
    expect(screen.getByText(/Bệnh viện Đà Nẵng xem danh sách dị ứng/)).toBeTruthy();
    expect(screen.getByText(/Bị chặn hoặc không thành công/)).toBeTruthy();
    expect(screen.getByText(/Nội dung đã xem không được lưu ở đây/)).toBeTruthy();
  });
  it("narrows to one place", async () => {
    vi.mocked(getAccess).mockResolvedValue({ truncated: false, generatedAt: "", entries: [entry(), entry({ id: "e2", who: "Nhà thuốc" })] });
    wrap(<Access />);
    await screen.findByText(/Nhà thuốc xem/);
    await userEvent.selectOptions(screen.getByLabelText("Nơi xem"), "Nhà thuốc");
    expect(screen.queryByText(/Bệnh viện Đà Nẵng xem/)).toBeNull();
    expect(screen.getByText(/Nhà thuốc xem/)).toBeTruthy();
  });
  it("tells the person when nobody has looked", async () => {
    vi.mocked(getAccess).mockResolvedValue({ truncated: false, generatedAt: "", entries: [] });
    wrap(<Access />);
    expect(await screen.findByText("Không có lần truy cập nào")).toBeTruthy();
  });
});

describe("download the access log", () => {
  it("saves exactly the rows on screen as a CSV file, and is disabled when there are none", async () => {
    const created = vi.fn(() => "blob:x");
    URL.createObjectURL = created;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.mocked(getAccess).mockResolvedValue({ truncated: false, generatedAt: "", entries: [entry(), entry({ id: "e2", who: "Nhà thuốc" })] });
    wrap(<Access />);
    await userEvent.click(await screen.findByRole("button", { name: "Tải nhật ký (CSV)" }));
    expect(created).toHaveBeenCalledTimes(1);
    const blob = (created.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toMatch(/text\/csv/);
    // jsdom has no Blob.text(), so read it the old way.
    const text = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); });
    expect(text).toContain("Nhà thuốc");
    expect(click).toHaveBeenCalled();
    cleanup();
    vi.mocked(getAccess).mockResolvedValue({ truncated: false, generatedAt: "", entries: [] });
    wrap(<Access />);
    expect((await screen.findByRole("button", { name: "Tải nhật ký (CSV)" }) as HTMLButtonElement).disabled).toBe(true);
    click.mockRestore();
  });
});

describe("emergency", () => {
  it("lists emergency accesses with their review state", async () => {
    vi.mocked(getEmergency).mockResolvedValue([entry({ emergency: true, review: "pending" }), entry({ id: "e9", who: "Bệnh viện B", emergency: true, review: "unjustified" })]);
    wrap(<Emergency />);
    expect(await screen.findByText("Đang chờ cơ quan quản lý rà soát")).toBeTruthy();
    expect(screen.getByText("Đã rà soát: không hợp lý")).toBeTruthy();
  });
  it("is calm when there is none", async () => {
    vi.mocked(getEmergency).mockResolvedValue([]);
    wrap(<Emergency />);
    expect(await screen.findByText("Chưa có lần truy cập cấp cứu nào")).toBeTruthy();
  });
});

describe("overview", () => {
  it("flags emergency accesses waiting for review and shows the sentences", async () => {
    vi.mocked(getOverview).mockResolvedValue({ activeConsents: 2, parties: 2, accessLast30Days: 5, pendingEmergency: 1, lastAccess: entry(), expiringSoon: [consent()], places: [{ who: "Bệnh viện Đà Nẵng", consents: [consent()] }], daily: [{ date: "2026-11-19", count: 2, blocked: 1 }, { date: "2026-11-20", count: 0, blocked: 0 }], recent: [entry()], lines: ["Hiện có 2 nơi được phép xem dữ liệu của bạn."] });
    wrap(<Overview />);
    expect(await screen.findByText("1 lần truy cập cấp cứu đang chờ rà soát")).toBeTruthy();
    expect(screen.getByText("Hiện có 2 nơi được phép xem dữ liệu của bạn.")).toBeTruthy();
    expect(screen.getByText("Ai đang được xem dữ liệu của bạn")).toBeTruthy();
    expect(screen.getByText("Gần đây")).toBeTruthy();
    expect(screen.getByRole("img", { name: /tổng 2, trong đó 1 bị chặn/ })).toBeTruthy();
  });
});

describe("my information", () => {
  const profile = { contactName: "", contactPhone: "", bloodType: "", note: "", updatedAt: null, patientCode: "P0001" };
  it("shows the code to hand to a clinic and saves what the person wrote", async () => {
    vi.mocked(getProfile).mockResolvedValue(profile);
    vi.mocked(saveProfile).mockResolvedValue({ ...profile, contactName: "Lan", updatedAt: "2026-11-20T10:00:00.000Z" });
    wrap(<Profile />);
    expect(await screen.findByText("P0001")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Người liên hệ khi khẩn cấp"), "Lan");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(vi.mocked(saveProfile)).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ contactName: "Lan" })));
  });
  it("shows the server's field messages", async () => {
    vi.mocked(getProfile).mockResolvedValue(profile);
    vi.mocked(saveProfile).mockRejectedValue(new ApiError(422, "x", { error: "invalid", fields: { contactPhone: "Số điện thoại không đúng định dạng." } }));
    wrap(<Profile />);
    await userEvent.click(await screen.findByRole("button", { name: "Lưu" }));
    expect(await screen.findByText("Số điện thoại không đúng định dạng.")).toBeTruthy();
  });
});

describe("public pages and navigation", () => {
  it("landing promises what MyHealth is for and starts sign-in", async () => {
    const onSignIn = vi.fn();
    render(<Landing onSignIn={onSignIn} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/quyết định ai được xem/);
    await userEvent.click(screen.getAllByRole("button", { name: /Đăng nhập/ })[0]);
    expect(onSignIn).toHaveBeenCalled();
  });
  it("sign-in page explains a failed attempt", () => {
    render(<SignInPage product="MyHealth" onSignIn={() => {}} onBack={() => {}} message="Phiên đăng nhập đã hết hạn." />);
    expect(within(document.body).getByText("Phiên đăng nhập đã hết hạn.")).toBeTruthy();
  });
  it("the navigation has the six areas and marks the current one", () => {
    expect(NAV.map(item => item.id)).toEqual(["/", "/dong-thuan", "/ai-da-xem", "/cap-cuu", "/thong-tin", "/cai-dat"]);
    expect(currentNav("/dong-thuan")).toBe("/dong-thuan");
    expect(currentNav("/khong-co")).toBe("");
  });
});
