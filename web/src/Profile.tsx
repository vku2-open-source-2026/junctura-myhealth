// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { AlertBanner, Button, Card, IdChip, PageHeader, SelectField, TextAreaField, TextField, formatDateTime, useToast } from "@junctura/health-ui";
import QRCode from "qrcode";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, getProfile, saveProfile } from "./api";
import { Remote, useRemote, useSession } from "./session";
import type { Profile as ProfileData, ProfileInput } from "./types";

const BLOOD = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(value => ({ value, label: value || "Chưa rõ" }));

export function Profile() {
  const { settings } = useSession();
  const { state, reload } = useRemote(signal => getProfile(settings, signal), [settings]);
  return (
    <div className="space-y-5">
      <PageHeader title="Thông tin của tôi" description="Chính bạn tự khai. Không phải hồ sơ bệnh án; bệnh án do trạm và bệnh viện giữ." />
      <Remote state={state} reload={reload}>{profile => <ProfileForm profile={profile} />}</Remote>
    </div>
  );
}

function CodeCard({ code }: { code: string }) {
  const [image, setImage] = useState<string>("");
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(code, { margin: 2, width: 280, errorCorrectionLevel: "M" }).then(url => { if (live) setImage(url); }, () => undefined);
    return () => { live = false; };
  }, [code]);
  return (
    <Card title="Mã để đưa cho nơi khám">
      <div className="flex flex-wrap items-center gap-5">
        {image && <img src={image} alt={`Mã QR của mã người bệnh ${code}`} className="size-40 rounded-lg border border-line bg-white p-1" />}
        <div className="space-y-2 text-base text-ink">
          <IdChip value={code} label="Mã người bệnh" />
          <p className="text-sm text-muted">Đưa mã này khi đến trạm hoặc bệnh viện để họ tìm đúng hồ sơ. Có mã chưa có nghĩa là họ được xem: việc xem vẫn cần bạn đồng ý.</p>
        </div>
      </div>
    </Card>
  );
}

function ProfileForm({ profile }: { profile: ProfileData }) {
  const { settings, expire } = useSession();
  const { notify } = useToast();
  const [form, setForm] = useState<ProfileInput>({ contactName: profile.contactName, contactPhone: profile.contactPhone, bloodType: profile.bloodType, note: profile.note });
  const [saved, setSaved] = useState(profile.updatedAt);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: keyof ProfileInput) => (event: { target: { value: string } }) => setForm(current => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const next = await saveProfile(settings, form);
      setSaved(next.updatedAt);
      notify("Đã lưu thông tin của bạn.", "ok");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return expire();
      if (error instanceof ApiError && error.status === 422) setErrors(error.fields);
      else notify("Chưa lưu được. Hãy thử lại.", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {profile.patientCode ? <CodeCard code={profile.patientCode} /> : <AlertBanner level="info" title="Chưa có mã người bệnh">Tài khoản này chưa gắn với hồ sơ ở trạm y tế.</AlertBanner>}
      <Card title="Liên hệ khẩn cấp và ghi chú">
        <form onSubmit={event => void submit(event)} className="space-y-4" noValidate>
          <TextField label="Người liên hệ khi khẩn cấp" value={form.contactName} onChange={set("contactName")} error={errors.contactName} autoComplete="off" />
          <TextField label="Số điện thoại người liên hệ" value={form.contactPhone} onChange={set("contactPhone")} error={errors.contactPhone} inputMode="tel" autoComplete="off" hint="Ví dụ 0901234567" />
          <SelectField label="Nhóm máu" value={form.bloodType} onChange={set("bloodType")} options={BLOOD} error={errors.bloodType} />
          <TextAreaField label="Ghi chú cho nơi khám" value={form.note} onChange={set("note")} error={errors.note} rows={3} hint="Ví dụ: thuốc đang tự dùng, điều cần lưu ý. Tối đa 500 ký tự." />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" loading={busy}>Lưu</Button>
            {saved && <span className="text-sm text-muted">Lưu lần cuối {formatDateTime(saved)}</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}
