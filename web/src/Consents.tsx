// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, PageHeader, SelectField, Section, formatDate, useToast } from "@junctura/health-ui";
import { Lock, Plus, ShieldCheck } from "lucide-react";
import { PlaceAvatar } from "./parts";
import { useEffect, useMemo, useState } from "react";
import { ApiError, getConsents, getOptions, grantConsent, revokeConsent } from "./api";
import { BUNDLES, bundleOptions, canRenew, notAllowed, renewalOption, runAll, type Bundle } from "./consentTools";
import { DURATIONS, consentStateLabel, remaining } from "./format";
import { Remote, useRemote, useSession } from "./session";
import type { Consent, ConsentOption } from "./types";

export function Consents() {
  const { settings, expire } = useSession();
  const { notify } = useToast();
  const { state, reload } = useRemote(async signal => ({ consents: await getConsents(settings, signal), options: await getOptions(settings, signal) }), [settings]);
  const [adding, setAdding] = useState(false);
  const [preset, setPreset] = useState("");
  const [revoking, setRevoking] = useState<Consent | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockAll, setLockAll] = useState<Consent[] | null>(null);
  const [bundle, setBundle] = useState<{ bundle: Bundle; options: ConsentOption[] } | null>(null);
  const [renewing, setRenewing] = useState<string | null>(null);

  const revokeEverything = async () => {
    if (!lockAll) return;
    setBusy(true);
    const { done, failed } = await runAll(lockAll, item => revokeConsent(settings, item.id));
    setBusy(false);
    if (failed.length === 0) notify(`Đã tạm khóa tất cả. ${done.length} đồng thuận đã thu hồi, không nơi nào xem được nữa.`, "ok");
    else notify(`Đã thu hồi ${done.length}, còn ${failed.length} chưa thu hồi được. Hãy thử lại.`, "danger");
    setLockAll(null);
    reload();
  };

  const renew = async (item: Consent, options: ConsentOption[]) => {
    const option = renewalOption(item, options);
    if (!option) return;
    setRenewing(item.id);
    try {
      await grantConsent(settings, { optionId: option.id, purposes: item.purposes.map(purpose => purpose.value), days: 90 });
      await revokeConsent(settings, item.id).catch(() => undefined);
      notify(`Đã gia hạn thêm 90 ngày cho ${item.who}.`, "ok");
      reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return expire();
      notify("Chưa gia hạn được. Đồng thuận cũ vẫn giữ nguyên.", "danger");
    } finally {
      setRenewing(null);
    }
  };

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    try {
      await revokeConsent(settings, revoking.id);
      notify(`Đã thu hồi. ${revoking.who} không xem được nữa.`, "ok");
      setRevoking(null);
      reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return expire();
      notify("Chưa thu hồi được. Hãy thử lại.", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Đồng thuận" description="Chọn nơi nào được xem loại dữ liệu nào, để làm gì, trong bao lâu. Thu hồi bất cứ lúc nào."
        actions={<Button size="lg" icon={<Plus aria-hidden className="size-4" />} onClick={() => { setPreset(""); setAdding(true); }}>Cho phép thêm</Button>} />
      <Remote state={state} reload={reload}>{({ consents, options }) => {
        const active = consents.filter(item => item.state === "active");
        const history = consents.filter(item => item.state !== "active");
        return (
          <>
            {active.length > 0 && (
              <div className="flex justify-end">
                <Button variant="danger" size="lg" icon={<Lock aria-hidden className="size-4" />} onClick={() => setLockAll(active)}>Tạm khóa tất cả</Button>
              </div>
            )}
            <Section title="Đang cho phép" count={active.length}>
              {active.length === 0
                ? <EmptyState title="Chưa có nơi nào được phép xem" action={<Button onClick={() => { setPreset(""); setAdding(true); }}>Cho phép một nơi</Button>}>Khi bạn chưa đồng ý, các nơi khác không xem được dữ liệu của bạn, trừ khi là cấp cứu.</EmptyState>
                : <div className="grid gap-4 lg:grid-cols-2">{groupPlaces(active).map(place => <PlaceCard key={place.who} who={place.who} consents={place.consents} onRevoke={setRevoking} renewing={renewing} onRenew={item => void renew(item, options)} canRenewItem={item => canRenew(item) && renewalOption(item, options) !== undefined} />)}</div>}
            </Section>
            {BUNDLES.some(item => bundleOptions(item, options, active).length > 0) && (
              <Section title="Gói cho phép nhanh" description="Chọn theo việc bạn sắp làm. Bạn xem lại từng mục trước khi đồng ý.">
                <ul className="grid gap-3 sm:grid-cols-2">{BUNDLES.map(item => ({ item, missing: bundleOptions(item, options, active) })).filter(entry => entry.missing.length > 0).map(({ item, missing }) => (
                  <li key={item.id}>
                    <Card className="flex h-full flex-col gap-3">
                      <div className="flex items-center gap-2"><ShieldCheck aria-hidden className="size-5 text-brand" /><p className="text-base font-semibold text-ink">{item.title}</p></div>
                      <p className="flex-1 text-sm text-muted">{item.description}</p>
                      <Button variant="secondary" aria-label={`Xem gói ${item.title}`} onClick={() => setBundle({ bundle: item, options: missing })}>Xem gói ({missing.length} mục)</Button>
                    </Card>
                  </li>
                ))}</ul>
              </Section>
            )}
            {suggestions(options, active).length > 0 && (
              <Section title="Có thể bạn muốn cho phép" description="Các nơi này chưa được xem dữ liệu nào của bạn. Chỉ cho phép khi bạn thấy cần.">
                <ul className="grid gap-3 sm:grid-cols-2">{suggestions(options, active).map(option => (
                  <li key={option.id}>
                    <Card className="flex h-full items-center gap-3">
                      <PlaceAvatar who={option.consumerName} />
                      <p className="min-w-0 flex-1 text-base text-ink"><span className="font-semibold">{option.consumerName}</span> xem {option.shares.toLowerCase()}</p>
                      <Button variant="secondary" aria-label={`Cho phép ${option.consumerName} xem ${option.shares.toLowerCase()}`} onClick={() => { setPreset(option.id); setAdding(true); }}>Cho phép</Button>
                    </Card>
                  </li>
                ))}</ul>
              </Section>
            )}
            {history.length > 0 && (
              <Section title="Lịch sử đồng thuận" description="Đã hết hạn hoặc đã thu hồi." count={history.length}>
                <ul className="space-y-3">{history.map(item => <HistoryRow key={item.id} consent={item} />)}</ul>
              </Section>
            )}
            <BundleDialog entry={bundle} onClose={() => setBundle(null)} onDone={() => { setBundle(null); reload(); }} />
            <GrantDialog open={adding} initialId={preset} options={options} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />
          </>
        );
      }}</Remote>
      <ConfirmDialog open={lockAll !== null} danger loading={busy} title="Tạm khóa tất cả?" confirmLabel="Thu hồi tất cả" onCancel={() => setLockAll(null)} onConfirm={() => void revokeEverything()}
        description={lockAll && <>Sẽ thu hồi <strong>{lockAll.length} đồng thuận</strong> của {new Set(lockAll.map(item => item.who)).size} nơi. Không nơi nào xem được dữ liệu của bạn nữa, có hiệu lực ngay, trừ cấp cứu. Bạn có thể cho phép lại từng nơi sau.</>} />
      <ConfirmDialog open={revoking !== null} danger loading={busy} title="Thu hồi đồng thuận?" confirmLabel="Thu hồi" onCancel={() => setRevoking(null)} onConfirm={() => void revoke()}
        description={revoking && <>{revoking.who} sẽ <strong>không xem được</strong> {revoking.what.toLowerCase()} của bạn nữa, có hiệu lực ngay. Bạn có thể cho phép lại sau.</>} />
    </div>
  );
}

/** Active consents grouped by place, keeping the order they first appear. */
function groupPlaces(consents: Consent[]): { who: string; consents: Consent[] }[] {
  const map = new Map<string, Consent[]>();
  for (const item of consents) map.set(item.who, [...(map.get(item.who) ?? []), item]);
  return [...map].map(([who, list]) => ({ who, consents: list }));
}

/** Options the patient has not yet allowed, so the page can offer them. At most four. */
function suggestions(options: ConsentOption[], active: Consent[]): ConsentOption[] {
  return notAllowed(options, active).slice(0, 4);
}

function PlaceCard({ who, consents, onRevoke, onRenew, canRenewItem, renewing }: { who: string; consents: Consent[]; onRevoke: (consent: Consent) => void; onRenew: (consent: Consent) => void; canRenewItem: (consent: Consent) => boolean; renewing: string | null }) {
  return (
    <Card>
      <div className="flex items-center gap-3"><PlaceAvatar who={who} large /><p className="text-lg font-semibold text-ink">{who}</p></div>
      <ul className="mt-3 divide-y divide-line">{consents.map(item => (
        <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 space-y-0.5">
            <p className="text-base text-ink">{item.what}</p>
            <p className="text-sm text-muted">{item.purposes.map(purpose => purpose.label).join(" · ")}</p>
            <p className="text-sm text-muted">Đến {formatDate(item.expiresAt)}</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Badge tone={Date.parse(item.expiresAt) - Date.now() <= 14 * 86_400_000 ? "warn" : "ok"}>{remaining(item.expiresAt)}</Badge>
            <div className="flex flex-wrap gap-2">
              {canRenewItem(item) && <Button variant="secondary" loading={renewing === item.id} onClick={() => onRenew(item)} aria-label={`Gia hạn 90 ngày cho ${item.who}, ${item.what}`}>Gia hạn</Button>}
              <Button variant="danger" onClick={() => onRevoke(item)} aria-label={`Thu hồi đồng thuận của ${item.who}`}>Thu hồi</Button>
            </div>
          </div>
        </li>
      ))}</ul>
    </Card>
  );
}

function HistoryRow({ consent }: { consent: Consent }) {
  return (
    <li>
      <Card className="flex flex-wrap items-center gap-3">
        <PlaceAvatar who={consent.who} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">{consent.who}</p>
          <p className="text-sm text-muted">{consent.what} · {consent.revokedAt ? `Thu hồi ${formatDate(consent.revokedAt)}` : `Hết hạn ${formatDate(consent.expiresAt)}`}</p>
        </div>
        <Badge tone={consent.state === "expired" ? "warn" : "neutral"}>{consentStateLabel[consent.state]}</Badge>
      </Card>
    </li>
  );
}

function GrantDialog({ open, initialId, options, onClose, onDone }: { open: boolean; initialId: string; options: ConsentOption[]; onClose: () => void; onDone: () => void }) {
  const { settings, expire } = useSession();
  const { notify } = useToast();
  const [optionId, setOptionId] = useState("");
  const [purposes, setPurposes] = useState<string[]>([]);
  const [days, setDays] = useState("90");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const option = useMemo(() => options.find(item => item.id === optionId), [options, optionId]);
  useEffect(() => {
    if (!open || !initialId) return;
    setOptionId(initialId);
    setPurposes(options.find(item => item.id === initialId)?.purposes.map(item => item.value) ?? []);
  }, [open, initialId, options]);

  const choose = (id: string) => {
    setOptionId(id);
    setPurposes(options.find(item => item.id === id)?.purposes.map(item => item.value) ?? []);
    setError(null);
  };
  const toggle = (value: string) => setPurposes(current => (current.includes(value) ? current.filter(item => item !== value) : [...current, value]));
  const close = () => { setOptionId(""); setPurposes([]); setError(null); onClose(); };

  const submit = async () => {
    if (!option) return setError("Chọn nơi và loại dữ liệu.");
    if (purposes.length === 0) return setError("Chọn ít nhất một mục đích.");
    setBusy(true);
    try {
      await grantConsent(settings, { optionId: option.id, purposes, days: Number(days) });
      notify(`Đã cho phép ${option.consumerName} xem ${option.shares.toLowerCase()}.`, "ok");
      setOptionId(""); setPurposes([]); setError(null);
      onDone();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return expire();
      setError(failure instanceof ApiError && failure.status === 503 ? "Chưa kết nối được với Junctura. Hãy thử lại sau." : "Chưa lưu được. Kiểm tra lại lựa chọn rồi thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} title="Cho phép một nơi xem dữ liệu" onClose={close}
      footer={<><Button variant="secondary" onClick={close}>Huỷ</Button><Button loading={busy} onClick={() => void submit()} disabled={options.length === 0}>Đồng ý cho phép</Button></>}>
      {options.length === 0 ? (
        <p>Chưa có nơi nào để chọn. Hệ thống demo cần được dựng xong (lệnh <code>npm run demo:setup</code> ở junctura-health) rồi mở lại trang này.</p>
      ) : (
        <div className="space-y-4">
          <SelectField label="Nơi và loại dữ liệu" value={optionId} onChange={event => choose(event.target.value)} placeholder="Chọn…"
            options={options.map(item => ({ value: item.id, label: `${item.consumerName} xem ${item.shares.toLowerCase()}` }))} />
          {option && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-ink">Để làm gì</legend>
              {option.purposes.map(item => (
                <label key={item.value} className="flex min-h-11 items-center gap-3 text-base text-ink">
                  <input type="checkbox" className="size-5" checked={purposes.includes(item.value)} onChange={() => toggle(item.value)} />{item.label}
                </label>
              ))}
            </fieldset>
          )}
          <SelectField label="Trong bao lâu" value={days} onChange={event => setDays(event.target.value)} options={DURATIONS} hint="Hết hạn thì tự dừng. Bạn có thể thu hồi sớm hơn." />
          {option?.emergencyAccess && <p className="text-sm text-muted">Lưu ý: với loại dữ liệu này, trong cấp cứu nơi khám vẫn có thể xin xem mà không cần đồng ý. Mọi lần như vậy đều hiện ở mục Cấp cứu.</p>}
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        </div>
      )}
    </Dialog>
  );
}

function BundleDialog({ entry, onClose, onDone }: { entry: { bundle: Bundle; options: ConsentOption[] } | null; onClose: () => void; onDone: () => void }) {
  const { settings } = useSession();
  const { notify } = useToast();
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!entry) return;
    setBusy(true);
    setError(null);
    const { done, failed } = await runAll(entry.options, option => grantConsent(settings, { optionId: option.id, purposes: option.purposes.map(item => item.value), days: Number(days) }));
    setBusy(false);
    if (failed.length === 0) { notify(`Đã cho phép gói "${entry.bundle.title}" (${done.length} mục).`, "ok"); onDone(); return; }
    setError(`Đã cho phép ${done.length} mục, còn ${failed.length} mục chưa lưu được. Hãy thử lại.`);
    if (done.length > 0) onDone();
  };

  return (
    <Dialog open={entry !== null} title={entry ? `Gói: ${entry.bundle.title}` : ""} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Huỷ</Button><Button loading={busy} onClick={() => void submit()}>Đồng ý cho phép</Button></>}>
      {entry && (
        <div className="space-y-4">
          <p>Các nơi dưới đây sẽ được xem đúng những loại dữ liệu này, với mọi mục đích ghi kèm:</p>
          <ul className="space-y-2">{entry.options.map(option => (
            <li key={option.id} className="text-base text-ink"><span className="font-semibold">{option.consumerName}</span> xem {option.shares.toLowerCase()}<span className="block text-sm text-muted">{option.purposes.map(item => item.label).join(" · ")}</span></li>
          ))}</ul>
          <SelectField label="Trong bao lâu" value={days} onChange={event => setDays(event.target.value)} options={DURATIONS} hint="Hết hạn thì tự dừng. Bạn có thể thu hồi sớm hơn." />
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        </div>
      )}
    </Dialog>
  );
}
